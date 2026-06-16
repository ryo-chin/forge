import { trapTabFocus } from '@lib/accessibility/focus.ts';
import { formatDateTimeLocal, parseDateTimeLocal } from '@lib/date.ts';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchPicker } from '../SearchPicker';
import { attachEscapeClose, focusModalOnOpen, formatDurationLabel } from './logic.ts';

export type EditorModalMode = 'running' | 'history' | 'new';

export type EditorModalResult = {
  title: string;
  project: string;
  startMs: number;
  endMs: number;
};

type EditorModalProps = {
  mode: EditorModalMode;
  initialTitle: string;
  initialProject: string;
  initialStartMs: number;
  initialEndMs: number;
  titleSuggestions: string[];
  projectSuggestions: string[];
  /** 主アクション: new=記録する / history=保存 / running=保存して継続 */
  onSave: (result: EditorModalResult) => void;
  /** running モードのみ: この時刻で完了 */
  onFinalize?: (result: EditorModalResult) => void;
  onCancel: () => void;
};

const DURATION_NUDGES = [-30, -10, 10, 30, 60] as const;

const TITLE_BY_MODE: Record<EditorModalMode, string> = {
  new: '記録を追加',
  history: '記録を編集',
  running: '計測中の編集',
};

export const EditorModal: React.FC<EditorModalProps> = ({
  mode,
  initialTitle,
  initialProject,
  initialStartMs,
  initialEndMs,
  titleSuggestions,
  projectSuggestions,
  onSave,
  onFinalize,
  onCancel,
}) => {
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [project, setProject] = useState(initialProject);
  const [startStr, setStartStr] = useState(() => formatDateTimeLocal(initialStartMs));
  // 作業時間（分）を主軸に保持する。完了時刻 = 開始 + 作業時間 で常に算出するため、
  // 開始を動かすと完了が追従し、ナッジは「開始からの作業時間」を増減する。
  const [durationMinutes, setDurationMinutes] = useState(() =>
    Math.max(0, Math.round((initialEndMs - initialStartMs) / 60_000)),
  );

  const startMs = useMemo(() => parseDateTimeLocal(startStr), [startStr]);
  const endMs = startMs !== null ? startMs + durationMinutes * 60_000 : null;
  const endStr = endMs !== null ? formatDateTimeLocal(endMs) : '';
  const durationMs = startMs !== null ? durationMinutes * 60_000 : null;

  // running の保存（継続）は完了時刻不要。それ以外は作業時間 >= 0（完了 >= 開始）が必須
  const baseValid = title.trim().length > 0 && startMs !== null;
  const rangeValid = baseValid && durationMinutes >= 0;
  const isRunning = mode === 'running';
  const endLabel = isRunning ? '完了時刻' : '終了時刻';

  useEffect(() => focusModalOnOpen(() => modalContainerRef.current), []);
  useEffect(() => attachEscapeClose(onCancel), [onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (modalContainerRef.current) trapTabFocus(modalContainerRef.current, e);
  };

  // ナッジは作業時間（開始からの差分）を増減する → 完了 = 開始 + 作業時間 に反映
  const handleNudge = (deltaMinutes: number) => {
    setDurationMinutes((prev) => Math.max(0, prev + deltaMinutes));
  };

  // 完了時刻を直接編集したら、開始との差分から作業時間を再計算
  const handleEndChange = (value: string) => {
    const parsed = parseDateTimeLocal(value);
    if (parsed === null || startMs === null) return;
    setDurationMinutes(Math.max(0, Math.round((parsed - startMs) / 60_000)));
  };

  const buildResult = (): EditorModalResult | null => {
    if (startMs === null) return null;
    return {
      title: title.trim(),
      project: project.trim(),
      startMs,
      endMs: endMs ?? startMs,
    };
  };

  const submitPrimary = () => {
    const result = buildResult();
    if (!result) return;
    // 継続保存以外は範囲必須
    if (!isRunning && !rangeValid) return;
    if (isRunning && !baseValid) return;
    onSave(result);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitPrimary();
  };

  const handleFinalize = () => {
    if (!rangeValid) return;
    const result = buildResult();
    if (result && onFinalize) onFinalize(result);
  };

  return (
    <div className="time-tracker__modal-backdrop" role="presentation">
      <div
        ref={modalContainerRef}
        className="time-tracker__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-editor-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id="session-editor-title">{TITLE_BY_MODE[mode]}</h2>
        <form className="time-tracker__modal-form" onSubmit={handleSubmit}>
          <SearchPicker
            label="タイトル"
            value={title}
            suggestions={titleSuggestions}
            placeholder="何に取り組んだ？"
            autoFocus
            onChange={setTitle}
          />
          <SearchPicker
            label="プロジェクト"
            value={project}
            suggestions={projectSuggestions}
            placeholder="プロジェクトを検索・入力"
            itemPrefix="#"
            allowClear
            onChange={setProject}
          />
          <div className="time-tracker__field">
            <label htmlFor="modal-start">開始時刻</label>
            <input
              id="modal-start"
              type="datetime-local"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
            />
          </div>
          <div className="time-tracker__field">
            <label htmlFor="modal-end">{endLabel}</label>
            <input
              id="modal-end"
              type="datetime-local"
              value={endStr}
              onChange={(e) => handleEndChange(e.target.value)}
            />
          </div>
          <div className="time-tracker__duration">
            <div className="time-tracker__duration-header">
              <span className="time-tracker__duration-label">作業時間</span>
              <span className="time-tracker__duration-value" aria-live="polite">
                {formatDurationLabel(durationMs)}
              </span>
            </div>
            <div className="time-tracker__nudges" role="group" aria-label="作業時間を調整">
              {DURATION_NUDGES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleNudge(m)}
                  aria-label={
                    m > 0 ? `${endLabel}を${m}分後ろへ` : `${endLabel}を${Math.abs(m)}分手前へ`
                  }
                >
                  {m > 0 ? `+${m}分` : `${m}分`}
                </button>
              ))}
            </div>
          </div>
          <div className="time-tracker__modal-actions">
            <button type="button" className="time-tracker__modal-secondary" onClick={onCancel}>
              キャンセル
            </button>
            {isRunning ? (
              <>
                <button
                  type="button"
                  className="time-tracker__modal-secondary"
                  onClick={submitPrimary}
                  disabled={!baseValid}
                >
                  保存して継続
                </button>
                <button
                  type="button"
                  className="time-tracker__modal-primary"
                  onClick={handleFinalize}
                  disabled={!rangeValid}
                >
                  この時刻で完了
                </button>
              </>
            ) : (
              <button type="submit" className="time-tracker__modal-primary" disabled={!rangeValid}>
                {mode === 'new' ? '記録する' : '保存'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
