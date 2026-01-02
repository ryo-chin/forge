/**
 * テスト用レンダリングラッパー
 *
 * React Testing Libraryのrender関数をプロバイダでラップし、
 * テストで必要な共通設定を提供する。
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

type ProvidersProps = {
  children: ReactNode;
  queryClient?: QueryClient;
};

/**
 * テスト用のQueryClientを作成する
 * リトライを無効化し、テストの安定性を確保
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * 全プロバイダをまとめたラッパーコンポーネント
 */
function AllProviders({ children, queryClient }: ProvidersProps) {
  const client = queryClient ?? createTestQueryClient();

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * プロバイダ付きのrender関数
 *
 * 使用例:
 * ```tsx
 * const { getByText } = renderWithProviders(<MyComponent />);
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient;
  },
) {
  const { queryClient, ...renderOptions } = options ?? {};

  return render(ui, {
    wrapper: ({ children }) => <AllProviders queryClient={queryClient}>{children}</AllProviders>,
    ...renderOptions,
  });
}

/**
 * hookテスト用のラッパーを作成する
 *
 * 使用例:
 * ```tsx
 * const wrapper = createHookWrapper();
 * const { result } = renderHook(() => useMyHook(), { wrapper });
 * ```
 */
export function createHookWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
