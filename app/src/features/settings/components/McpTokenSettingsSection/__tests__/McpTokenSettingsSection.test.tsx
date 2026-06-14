import type { CreateMcpTokenPayload, CreateMcpTokenResponse, McpToken } from '@infra/mcp';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpTokenSettingsSection } from '../McpTokenSettingsSection.tsx';

const tokenFactory = (overrides: Partial<McpToken> = {}): McpToken => ({
  id: 'token-1',
  name: 'Codex MCP',
  scopes: ['time-tracker:read', 'time-tracker:write'],
  expiresAt: '2099-08-01T00:00:00.000Z',
  revokedAt: null,
  lastUsedAt: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...overrides,
});

describe('McpTokenSettingsSection', () => {
  const defaultProps = {
    authStatus: 'authenticated' as const,
    isAvailable: true,
    tokens: [] as McpToken[],
    onCreate: vi.fn<[CreateMcpTokenPayload], Promise<CreateMcpTokenResponse>>(),
    onRevoke: vi.fn<[string], Promise<McpToken>>(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onCreate.mockResolvedValue({
      token: 'forge_mcp_raw-token',
      mcpToken: tokenFactory(),
    });
    defaultProps.onRevoke.mockResolvedValue(
      tokenFactory({ revokedAt: '2026-05-01T01:00:00.000Z' }),
    );
  });

  it('renders unavailable state when the Forge API URL is missing', () => {
    render(<McpTokenSettingsSection {...defaultProps} isAvailable={false} />);

    expect(screen.getByText('API未設定')).toBeInTheDocument();
    expect(screen.getByText('Forge API URL が未設定です。')).toBeInTheDocument();
  });

  it('renders login prompt when unauthenticated', () => {
    render(<McpTokenSettingsSection {...defaultProps} authStatus="unauthenticated" />);

    expect(screen.getByText('未ログイン')).toBeInTheDocument();
    expect(screen.getByText('ログイン後に MCP token を管理できます。')).toBeInTheDocument();
  });

  it('creates a token and shows the raw token once', async () => {
    const user = userEvent.setup();
    render(<McpTokenSettingsSection {...defaultProps} />);

    await user.clear(screen.getByLabelText('名前'));
    await user.type(screen.getByLabelText('名前'), 'Local Codex');
    await user.clear(screen.getByLabelText('有効日数'));
    await user.type(screen.getByLabelText('有効日数'), '30');
    await user.click(screen.getByRole('button', { name: '発行' }));

    expect(defaultProps.onCreate).toHaveBeenCalledWith({
      name: 'Local Codex',
      scopes: ['time-tracker:read', 'time-tracker:write'],
      expiresInDays: 30,
    });
    expect(await screen.findByLabelText('発行済み token')).toHaveValue('forge_mcp_raw-token');
    expect(screen.getByText('この値は再表示できません。')).toBeInTheDocument();
  });

  it('requires at least one scope before creating a token', async () => {
    const user = userEvent.setup();
    render(<McpTokenSettingsSection {...defaultProps} />);

    await user.click(screen.getByLabelText('読み取り'));
    await user.click(screen.getByLabelText('書き込み'));

    expect(screen.getByRole('button', { name: '発行' })).toBeDisabled();
  });

  it('renders issued token metadata and revokes an active token', async () => {
    const user = userEvent.setup();
    const activeToken = tokenFactory({ name: 'Workspace Token' });
    render(<McpTokenSettingsSection {...defaultProps} tokens={[activeToken]} />);

    expect(screen.getByText('Workspace Token')).toBeInTheDocument();
    expect(screen.getByText('読み取り / 書き込み')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '失効' }));

    await waitFor(() => {
      expect(defaultProps.onRevoke).toHaveBeenCalledWith('token-1');
    });
  });

  it('does not allow revoking an already revoked token', () => {
    render(
      <McpTokenSettingsSection
        {...defaultProps}
        tokens={[tokenFactory({ revokedAt: '2026-05-01T01:00:00.000Z' })]}
      />,
    );

    expect(screen.getByRole('button', { name: '失効' })).toBeDisabled();
  });
});
