import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { TimeTrackerTheme } from '../../domain/types.ts';
import type { UseThemesResult } from '../../hooks/data/useThemes.ts';

type ThemeManagerProps = {
  state: UseThemesResult;
};

type ThemeListProps = {
  title: string;
  emptyLabel: string;
  themes: TimeTrackerTheme[];
  editingThemeId: string | null;
  editingValue: string;
  onStartEdit: (theme: TimeTrackerTheme) => void;
  onEditNameChange: (value: string) => void;
  onSaveEdit: (theme: TimeTrackerTheme) => void;
  onCancelEdit: () => void;
  onToggleArchive: (theme: TimeTrackerTheme) => void;
  busy: boolean;
};

const ThemeList: React.FC<ThemeListProps> = ({
  title,
  emptyLabel,
  themes,
  editingThemeId,
  editingValue,
  onStartEdit,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
  onToggleArchive,
  busy,
}) => (
  <div className="time-tracker__theme-column" aria-label={title}>
    <h3>{title}</h3>
    {themes.length === 0 ? (
      <p className="time-tracker__theme-empty">{emptyLabel}</p>
    ) : (
      <ul className="time-tracker__theme-list">
        {themes.map((theme) => {
          const isEditing = editingThemeId === theme.id;
          return (
            <li key={theme.id} className="time-tracker__theme-item">
              {isEditing ? (
                <div className="time-tracker__theme-edit">
                  <label htmlFor={`edit-theme-${theme.id}`} className="time-tracker__sr-only">
                    {theme.name} を編集
                  </label>
                  <input
                    id={`edit-theme-${theme.id}`}
                    type="text"
                    value={editingValue}
                    onChange={(event) => onEditNameChange(event.target.value)}
                    disabled={busy}
                    placeholder="テーマ名"
                  />
                  <div className="time-tracker__theme-edit-actions">
                    <button
                      type="button"
                      onClick={() => onSaveEdit(theme)}
                      disabled={busy || editingValue.trim().length === 0}
                    >
                      保存
                    </button>
                    <button type="button" onClick={onCancelEdit} disabled={busy}>
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="time-tracker__theme-row">
                  <span className="time-tracker__theme-name">{theme.name}</span>
                  <div className="time-tracker__theme-actions">
                    <button
                      type="button"
                      onClick={() => onStartEdit(theme)}
                      disabled={busy}
                    >
                      名称変更
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleArchive(theme)}
                      disabled={busy}
                    >
                      {theme.status === 'active' ? 'アーカイブ' : '復元'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

export const ThemeManager: React.FC<ThemeManagerProps> = ({ state }) => {
  const {
    themes,
    isLoading,
    error,
    createTheme,
    updateTheme,
    archiveTheme,
    isCreating,
    isUpdating,
    isArchiving,
  } = state;

  const [newThemeName, setNewThemeName] = useState('');
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'テーマの読み込みに失敗しました';
  }, [error]);

  const activeThemes = useMemo(
    () => themes.filter((theme) => theme.status === 'active'),
    [themes],
  );
  const archivedThemes = useMemo(
    () => themes.filter((theme) => theme.status === 'archived'),
    [themes],
  );

  useEffect(() => {
    if (!editingThemeId) return;
    if (!themes.some((theme) => theme.id === editingThemeId)) {
      setEditingThemeId(null);
      setEditingValue('');
    }
  }, [editingThemeId, themes]);

  const busy = isCreating || isUpdating || isArchiving;

  const handleCreateTheme = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = newThemeName.trim();
      if (!trimmed) return;
      await createTheme({ name: trimmed });
      setNewThemeName('');
    },
    [createTheme, newThemeName],
  );

  const handleStartEdit = useCallback((theme: TimeTrackerTheme) => {
    setEditingThemeId(theme.id);
    setEditingValue(theme.name);
  }, []);

  const handleSaveEdit = useCallback(
    async (theme: TimeTrackerTheme) => {
      const trimmed = editingValue.trim();
      if (!trimmed || busy) return;
      await updateTheme({ id: theme.id, name: trimmed });
      setEditingThemeId(null);
      setEditingValue('');
    },
    [busy, editingValue, updateTheme],
  );

  const handleToggleArchive = useCallback(
    async (theme: TimeTrackerTheme) => {
      if (busy) return;
      if (theme.status === 'active') {
        await archiveTheme(theme.id);
      } else {
        await updateTheme({ id: theme.id, status: 'active' });
      }
    },
    [archiveTheme, busy, updateTheme],
  );

  return (
    <section
      className="time-tracker__theme-manager"
      aria-labelledby="theme-manager-heading"
    >
      <div className="time-tracker__theme-manager-header">
        <div>
          <p className="time-tracker__theme-eyebrow">テーマ</p>
          <h2 id="theme-manager-heading">上位テーマの管理</h2>
        </div>
        {isLoading ? <span className="time-tracker__theme-status">読込中…</span> : null}
      </div>

      <form className="time-tracker__theme-form" onSubmit={handleCreateTheme}>
        <label htmlFor="new-theme-name">新しいテーマ</label>
        <div className="time-tracker__theme-form-controls">
          <input
            id="new-theme-name"
            type="text"
            value={newThemeName}
            onChange={(event) => setNewThemeName(event.target.value)}
            placeholder="例: 経営者鍛錬"
            disabled={isCreating}
            aria-describedby="theme-form-hint"
          />
          <button
            type="submit"
            disabled={isCreating || newThemeName.trim().length === 0}
          >
            追加
          </button>
        </div>
        <p id="theme-form-hint" className="time-tracker__theme-hint">
          セッションを大きなカテゴリで整理できます
        </p>
      </form>

      {errorMessage ? (
        <p className="time-tracker__theme-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="time-tracker__theme-columns">
        <ThemeList
          title="アクティブ"
          emptyLabel="未作成です。テーマを追加してください。"
          themes={activeThemes}
          editingThemeId={editingThemeId}
          editingValue={editingValue}
          onStartEdit={handleStartEdit}
          onEditNameChange={setEditingValue}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => {
            setEditingThemeId(null);
            setEditingValue('');
          }}
          onToggleArchive={handleToggleArchive}
          busy={busy}
        />
        <ThemeList
          title="アーカイブ"
          emptyLabel="アーカイブされたテーマはありません。"
          themes={archivedThemes}
          editingThemeId={editingThemeId}
          editingValue={editingValue}
          onStartEdit={handleStartEdit}
          onEditNameChange={setEditingValue}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => {
            setEditingThemeId(null);
            setEditingValue('');
          }}
          onToggleArchive={handleToggleArchive}
          busy={busy}
        />
      </div>
    </section>
  );
};
