import {
  type CreateMcpTokenPayload,
  type CreateMcpTokenResponse,
  MCP_TOKEN_SCOPES,
  type McpToken,
  type McpTokenScope,
} from '@infra/mcp';
import type React from 'react';
import { useMemo, useState } from 'react';
import './McpTokenSettingsSection.css';

type AuthStatus = 'disabled' | 'loading' | 'authenticated' | 'unauthenticated';

export type McpTokenSettingsSectionProps = {
  authStatus: AuthStatus;
  isAvailable: boolean;
  tokens: McpToken[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: unknown;
  onCreate: (payload: CreateMcpTokenPayload) => Promise<CreateMcpTokenResponse>;
  onRevoke: (tokenId: string) => Promise<McpToken>;
  isCreating?: boolean;
  revokingTokenId?: string | null;
  onRefresh?: () => void | Promise<void>;
};

const SCOPE_LABELS: Record<McpTokenScope, string> = {
  'time-tracker:read': '読み取り',
  'time-tracker:write': '書き込み',
};

const DEFAULT_TOKEN_NAME = 'Codex MCP';
const DEFAULT_EXPIRES_IN_DAYS = '90';
const MAX_EXPIRES_IN_DAYS = 365;

const formatDate = (value: string | null): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const resolveStatus = (
  isAvailable: boolean,
  authStatus: AuthStatus,
): { label: string; tone: 'ready' | 'warning' | 'neutral' } => {
  if (!isAvailable) {
    return { label: 'API未設定', tone: 'warning' };
  }
  if (authStatus === 'loading') {
    return { label: '確認中', tone: 'neutral' };
  }
  if (authStatus === 'authenticated') {
    return { label: '利用可能', tone: 'ready' };
  }
  return { label: '未ログイン', tone: 'warning' };
};

const resolveTokenStatus = (token: McpToken): { label: string; tone: 'ready' | 'warning' } => {
  if (token.revokedAt) {
    return { label: '失効済み', tone: 'warning' };
  }
  if (Date.parse(token.expiresAt) <= Date.now()) {
    return { label: '期限切れ', tone: 'warning' };
  }
  return { label: '有効', tone: 'ready' };
};

const getErrorMessage = (error: unknown): string | null => {
  if (!error) {
    return null;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'MCP token の操作に失敗しました。';
};

export const McpTokenSettingsSection: React.FC<McpTokenSettingsSectionProps> = ({
  authStatus,
  isAvailable,
  tokens,
  isLoading = false,
  isRefreshing = false,
  error,
  onCreate,
  onRevoke,
  isCreating = false,
  revokingTokenId = null,
  onRefresh,
}) => {
  const [name, setName] = useState(DEFAULT_TOKEN_NAME);
  const [expiresInDays, setExpiresInDays] = useState(DEFAULT_EXPIRES_IN_DAYS);
  const [selectedScopes, setSelectedScopes] = useState<McpTokenScope[]>([...MCP_TOKEN_SCOPES]);
  const [issuedToken, setIssuedToken] = useState<CreateMcpTokenResponse | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  const sectionStatus = resolveStatus(isAvailable, authStatus);
  const isAuthenticated = authStatus === 'authenticated';
  const parsedExpiresInDays = Number(expiresInDays);
  const normalizedScopes = useMemo(
    () => MCP_TOKEN_SCOPES.filter((scope) => selectedScopes.includes(scope)),
    [selectedScopes],
  );
  const isExpiresInDaysValid =
    Number.isFinite(parsedExpiresInDays) &&
    parsedExpiresInDays >= 1 &&
    parsedExpiresInDays <= MAX_EXPIRES_IN_DAYS;
  const createDisabled =
    !isAvailable ||
    !isAuthenticated ||
    isCreating ||
    name.trim().length === 0 ||
    normalizedScopes.length === 0 ||
    !isExpiresInDaysValid;
  const visibleError = localError ?? getErrorMessage(error);

  const handleScopeChange = (scope: McpTokenScope, checked: boolean) => {
    setSelectedScopes((current) => {
      if (checked) {
        return current.includes(scope) ? current : [...current, scope];
      }
      return current.filter((item) => item !== scope);
    });
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createDisabled) {
      return;
    }

    setLocalError(null);
    setCopyState('idle');
    try {
      const response = await onCreate({
        name: name.trim(),
        scopes: normalizedScopes,
        expiresInDays: Math.floor(parsedExpiresInDays),
      });
      setIssuedToken(response);
    } catch {
      setLocalError('MCP token の発行に失敗しました。');
    }
  };

  const handleCopy = async () => {
    if (!issuedToken) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(issuedToken.token);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleRevoke = async (tokenId: string) => {
    setLocalError(null);
    try {
      await onRevoke(tokenId);
    } catch {
      setLocalError('MCP token の失効に失敗しました。');
    }
  };

  return (
    <section className="settings-section mcp-token-settings" aria-labelledby="mcp-token-title">
      <header className="settings-section__header">
        <div>
          <h2 id="mcp-token-title" className="settings-section__title">
            MCP token
          </h2>
          <p className="settings-section__description">
            ローカル MCP クライアントから Time Tracker API を利用する token を管理します。
          </p>
        </div>
        <div
          className={`settings-section__status mcp-token-settings__status--${sectionStatus.tone}`}
          aria-live="polite"
        >
          {sectionStatus.label}
        </div>
      </header>

      {!isAvailable ? (
        <div className="settings-section__body">
          <p className="mcp-token-settings__notice">Forge API URL が未設定です。</p>
        </div>
      ) : authStatus === 'loading' ? (
        <div className="settings-section__body">
          <p className="mcp-token-settings__notice">ログイン状態を確認しています...</p>
        </div>
      ) : !isAuthenticated ? (
        <div className="settings-section__body">
          <p className="mcp-token-settings__notice">ログイン後に MCP token を管理できます。</p>
        </div>
      ) : (
        <div className="settings-section__body">
          {visibleError ? (
            <div className="mcp-token-settings__alert" role="alert">
              {visibleError}
            </div>
          ) : null}

          <form className="mcp-token-settings__form" onSubmit={(event) => void handleCreate(event)}>
            <div className="time-tracker__field">
              <label htmlFor="mcp-token-name">名前</label>
              <input
                id="mcp-token-name"
                type="text"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="time-tracker__field">
              <label htmlFor="mcp-token-expires">有効日数</label>
              <input
                id="mcp-token-expires"
                type="number"
                min={1}
                max={MAX_EXPIRES_IN_DAYS}
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
              />
            </div>

            <fieldset className="mcp-token-settings__scopes">
              <legend>権限</legend>
              {MCP_TOKEN_SCOPES.map((scope) => (
                <label key={scope} className="mcp-token-settings__scope-option">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={(event) => handleScopeChange(scope, event.target.checked)}
                  />
                  <span>{SCOPE_LABELS[scope]}</span>
                </label>
              ))}
            </fieldset>

            <div className="settings-section__actions">
              <button
                type="submit"
                className="settings-section__primary-button"
                disabled={createDisabled}
              >
                {isCreating ? '発行中...' : '発行'}
              </button>
            </div>
          </form>

          {issuedToken ? (
            <div className="mcp-token-settings__issued" role="status">
              <div className="time-tracker__field">
                <label htmlFor="mcp-token-issued-value">発行済み token</label>
                <textarea id="mcp-token-issued-value" value={issuedToken.token} readOnly rows={2} />
              </div>
              <div className="mcp-token-settings__issued-footer">
                <p className="settings-section__hint">この値は再表示できません。</p>
                <button
                  type="button"
                  className="mcp-token-settings__secondary-button"
                  onClick={() => void handleCopy()}
                >
                  コピー
                </button>
              </div>
              {copyState === 'copied' ? (
                <p className="mcp-token-settings__copy-state">コピーしました。</p>
              ) : null}
              {copyState === 'failed' ? (
                <p className="mcp-token-settings__copy-state mcp-token-settings__copy-state--error">
                  コピーできませんでした。
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mcp-token-settings__list-header">
            <h3 className="mcp-token-settings__list-title">発行済み token</h3>
            {onRefresh ? (
              <button
                type="button"
                className="mcp-token-settings__secondary-button"
                onClick={() => void onRefresh()}
                disabled={isRefreshing}
              >
                {isRefreshing ? '更新中...' : '更新'}
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <p className="mcp-token-settings__notice">token を読み込んでいます...</p>
          ) : tokens.length === 0 ? (
            <p className="mcp-token-settings__notice">発行済み token はありません。</p>
          ) : (
            <div className="mcp-token-settings__token-list">
              {tokens.map((token) => {
                const status = resolveTokenStatus(token);
                const canRevoke = !token.revokedAt;
                return (
                  <article key={token.id} className="mcp-token-settings__token-item">
                    <div className="mcp-token-settings__token-main">
                      <div>
                        <h4 className="mcp-token-settings__token-name">{token.name}</h4>
                        <p className="mcp-token-settings__token-scopes">
                          {token.scopes.map((scope) => SCOPE_LABELS[scope] ?? scope).join(' / ')}
                        </p>
                      </div>
                      <span
                        className={`mcp-token-settings__token-status mcp-token-settings__token-status--${status.tone}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <dl className="mcp-token-settings__token-meta">
                      <div>
                        <dt>発行</dt>
                        <dd>{formatDate(token.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>期限</dt>
                        <dd>{formatDate(token.expiresAt)}</dd>
                      </div>
                      <div>
                        <dt>最終利用</dt>
                        <dd>{formatDate(token.lastUsedAt)}</dd>
                      </div>
                    </dl>
                    <div className="mcp-token-settings__token-actions">
                      <button
                        type="button"
                        className="mcp-token-settings__danger-button"
                        onClick={() => void handleRevoke(token.id)}
                        disabled={!canRevoke || revokingTokenId === token.id}
                      >
                        {revokingTokenId === token.id ? '失効中...' : '失効'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
