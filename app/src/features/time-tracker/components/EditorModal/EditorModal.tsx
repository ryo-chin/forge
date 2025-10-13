import React, { useEffect, useRef } from 'react';
import { focusModalOnOpen, attachEscapeClose } from './logic.ts';
import { trapTabFocus } from '../../../../lib/accessibility/focus.ts';

export type EditorModalMode = 'running' | 'history';

type EditorModalProps = {
  mode: EditorModalMode;
  title: string;
  project: string;
  startTime: string;
  endTime: string;
  saveDisabled: boolean;
  onTitleChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSave: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export const EditorModal: React.FC<EditorModalProps> = ({
  mode,
  title,
  project,
  startTime,
  endTime,
  saveDisabled,
  onTitleChange,
  onProjectChange,
  onStartTimeChange,
  onEndTimeChange,
  onSave,
  onCancel,
}) => {
  const modalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return focusModalOnOpen(() => modalContainerRef.current);
  }, []);

  useEffect(() => {
    return attachEscapeClose(onCancel);
  }, [onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (modalContainerRef.current) {
      trapTabFocus(modalContainerRef.current, e);
    }
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
        <h2 id="session-editor-title">
          {mode === 'history' ? '記録を編集' : '計測中の詳細を編集'}
        </h2>
        <form className="time-tracker__modal-form" onSubmit={onSave}>
          <div className="time-tracker__field">
            <label htmlFor="modal-title">タイトル</label>
            <input
              id="modal-title"
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              autoComplete="off"
              data-autofocus="true"
            />
          </div>
          <div className="time-tracker__field">
            <label htmlFor="modal-project">プロジェクト</label>
            <input
              id="modal-project"
              type="text"
              value={project}
              onChange={(e) => onProjectChange(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="time-tracker__field">
            <label htmlFor="modal-start">開始時刻</label>
            <input
              id="modal-start"
              type="datetime-local"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
            />
          </div>
          {mode === 'history' ? (
            <div className="time-tracker__field">
              <label htmlFor="modal-end">終了時刻</label>
              <input
                id="modal-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
              />
            </div>
          ) : null}
          <div className="time-tracker__modal-actions">
            <button type="button" onClick={onCancel}>
              キャンセル
            </button>
            <button type="submit" disabled={saveDisabled}>
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
