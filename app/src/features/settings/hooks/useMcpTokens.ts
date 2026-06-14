import { getAccessToken, useAuth } from '@infra/auth';
import {
  type CreateMcpTokenPayload,
  type CreateMcpTokenResponse,
  createMcpToken,
  isMcpTokenClientEnabled,
  type ListMcpTokensResponse,
  listMcpTokens,
  type McpToken,
  revokeMcpToken,
} from '@infra/mcp';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export const MCP_TOKENS_QUERY_KEY = ['mcp-tokens'] as const;

export const useMcpTokens = () => {
  const { status: authStatus } = useAuth();
  const queryClient = useQueryClient();
  const isAvailable = isMcpTokenClientEnabled();
  const isAuthenticated = authStatus === 'authenticated';
  const isEnabled = isAvailable && isAuthenticated;

  const tokensQuery = useQuery<ListMcpTokensResponse>({
    queryKey: MCP_TOKENS_QUERY_KEY,
    enabled: isEnabled,
    queryFn: async () => {
      const token = await getAccessToken();
      return listMcpTokens(token);
    },
  });

  const createTokenMutation = useMutation({
    mutationFn: async (payload: CreateMcpTokenPayload): Promise<CreateMcpTokenResponse> => {
      const token = await getAccessToken();
      return createMcpToken(token, payload);
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ListMcpTokensResponse>(MCP_TOKENS_QUERY_KEY, (current) => ({
        tokens: [
          data.mcpToken,
          ...(current?.tokens.filter((item) => item.id !== data.mcpToken.id) ?? []),
        ],
      }));
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (tokenId: string): Promise<McpToken> => {
      const token = await getAccessToken();
      const response = await revokeMcpToken(token, tokenId);
      return response.token;
    },
    onSuccess: (revokedToken) => {
      queryClient.setQueryData<ListMcpTokensResponse>(MCP_TOKENS_QUERY_KEY, (current) => ({
        tokens: current?.tokens.map((item) =>
          item.id === revokedToken.id ? revokedToken : item,
        ) ?? [revokedToken],
      }));
    },
  });

  const createToken = useCallback(
    async (payload: CreateMcpTokenPayload) => createTokenMutation.mutateAsync(payload),
    [createTokenMutation],
  );

  const revokeToken = useCallback(
    async (tokenId: string) => revokeTokenMutation.mutateAsync(tokenId),
    [revokeTokenMutation],
  );

  const refetchTokens = useCallback(async () => {
    await tokensQuery.refetch();
  }, [tokensQuery]);

  return {
    authStatus,
    isAvailable,
    isAuthenticated,
    tokens: tokensQuery.data?.tokens ?? [],
    isLoading: isEnabled && tokensQuery.isLoading,
    isRefreshing: isEnabled && tokensQuery.isFetching,
    error: tokensQuery.error ?? createTokenMutation.error ?? revokeTokenMutation.error,
    createToken,
    isCreating: createTokenMutation.isPending,
    revokeToken,
    revokingTokenId: revokeTokenMutation.isPending ? (revokeTokenMutation.variables ?? null) : null,
    refetchTokens,
  };
};
