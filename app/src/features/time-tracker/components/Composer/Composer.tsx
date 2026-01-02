import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createNudgeLabel, formatTimer } from '../../../../lib/time.ts';
import type { TimeTrackerSession } from '../../domain/types.ts';

import {
  buildProjectSuggestions,
  filterSuggestions,
  onEnterKey,
  onEnterOrMetaEnter,
  onEnterPickFirstElseSubmit,
  attachGlobalFocusShortcut,
  attachClickAwayAndEsc,
  focusSearchOnOpen,
} from './logic.ts';
import { trapTabFocus } from '../../../../lib/accessibility/focus.ts';

type ComposerStopResult = {
  nextInputValue: string;
  nextProject: string;
};

type ComposerProps = {
  sessions: TimeTrackerSession[];
  project: string;
  runningDraftTitle: string | null;
  elapsedSeconds: number;
  timerId: string;
  isRunning: boolean;
  isRunningEditorOpen: boolean;
  onProjectChange: (value: string) => void;
  onStart: (title: string) => boolean;
  onStop: () => ComposerStopResult;
  onCancel: () => ComposerStopResult;
  onAdjustDuration: (deltaSeconds: number) => void;
  onOpenRunningEditor: () => void;
};

export const Composer: React.FC<ComposerProps> = ({
  sessions,
  project,
  runningDraftTitle,
  elapsedSeconds,
  timerId,
  isRunning,
  isRunningEditorOpen,
  onProjectChange,
  onStart,
  onStop,
  onCancel,
  onAdjustDuration,
  onOpenRunningEditor,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectSearchRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState('');
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');

  const timerLabel = useMemo(() => formatTimer(elapsedSeconds), [elapsedSeconds]);
  const displayInputValue = isRunning ? (runningDraftTitle ?? '') : inputValue;
  const canStart = inputValue.trim().length > 0 && !isRunning;
  const primaryLabel = isRunning ? '停止' : '開始';
  const projectButtonLabel = project || 'プロジェクト';

  const projectSuggestions = useMemo(
    () => buildProjectSuggestions(project, sessions),
    [project, sessions],
  );
  const filteredProjectSuggestions = useMemo(
    () => filterSuggestions(projectSuggestions, projectQuery),
    [projectSuggestions, projectQuery],
  );

  const handlePrimaryAction = () => {
    if (isRunning) {
      const { nextInputValue, nextProject } = onStop();
      setInputValue(nextInputValue);
      setProjectQuery(nextProject);
      setIsProjectMenuOpen(false);
    } else if (canStart) {
      const ok = onStart(inputValue);
      if (ok) {
        setInputValue('');
        setIsProjectMenuOpen(false);
        setProjectQuery(project);
      }
    }
  };

  const handleProjectChange = (value: string) => {
    const t = value.trim();
    onProjectChange(t);
    setProjectQuery(t);
    setIsProjectMenuOpen(false);
    projectTriggerRef.current?.focus();
  };

  const handleCancel = () => {
    if (!isRunning) return;
    const { nextInputValue, nextProject } = onCancel();
    setInputValue(nextInputValue);
    setProjectQuery(nextProject);
    setIsProjectMenuOpen(false);
  };

  useEffect(() => attachGlobalFocusShortcut(() => inputRef.current?.focus()), []);

  useEffect(() => {
    if (!isProjectMenuOpen) return;
    setProjectQuery(project);
    return focusSearchOnOpen(() => projectSearchRef.current);
  }, [isProjectMenuOpen, project]);

  useEffect(() => {
    if (!isProjectMenuOpen) return;
    return attachClickAwayAndEsc({
      menuEl: () => projectMenuRef.current,
      triggerEl: () => projectTriggerRef.current,
      onTriggerd: () => {
        setIsProjectMenuOpen(false);
        projectTriggerRef.current?.focus();
      },
    });
  }, [isProjectMenuOpen]);

  return (
    <>
      <div className="time-tracker__composer">
        <div className="time-tracker__project-control">
          <button
            ref={projectTriggerRef}
            type="button"
            className="time-tracker__project-button time-tracker__touch-target"
            onClick={() => setIsProjectMenuOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={isProjectMenuOpen}
            aria-controls="time-tracker-project-menu"
            title="プロジェクトを選択"
            aria-label={project ? `プロジェクト: ${project}` : 'プロジェクトを選択'}
          >
            <span className="time-tracker__project-icon" aria-hidden="true">
              ＃
            </span>
            <span className="time-tracker__project-label">{projectButtonLabel}</span>
          </button>

          {isProjectMenuOpen ? (
            <div
              id="time-tracker-project-menu"
              className="time-tracker__project-popover"
              ref={projectMenuRef}
              role="dialog"
              aria-label="プロジェクトを選択"
              aria-modal="true"
              tabIndex={-1}
              onKeyDown={(e) => {
                if (projectMenuRef.current) trapTabFocus(projectMenuRef.current, e);
              }}
            >
              <label className="time-tracker__sr-only" htmlFor="project-search">
                プロジェクトを検索・設定
              </label>

              <div className="time-tracker__project-search">
                <span className="time-tracker__project-search-icon" aria-hidden="true">
                  🔍
                </span>
                <input
                  id="project-search"
                  ref={projectSearchRef}
                  className="time-tracker__project-input"
                  type="text"
                  placeholder="プロジェクト、タスク、クライアントを検索"
                  value={projectQuery}
                  onChange={(e) => setProjectQuery(e.target.value)}
                  // ⌘/Ctrl+Enter: そのまま確定、通常Enter: 先頭候補 or フォールバック
                  onKeyDown={onEnterOrMetaEnter({
                    onMetaEnter: () => handleProjectChange(projectQuery),
                    onEnter: onEnterPickFirstElseSubmit(
                      () => filteredProjectSuggestions,
                      (first) => handleProjectChange(first),
                      () => handleProjectChange(projectQuery),
                    ),
                  })}
                  autoComplete="off"
                />
              </div>

              {filteredProjectSuggestions.length > 0 ? (
                <>
                  <p className="time-tracker__project-section">最近使ったプロジェクト</p>
                  <ul className="time-tracker__project-list">
                    {filteredProjectSuggestions.map((candidate) => (
                      <li key={candidate}>
                        <button
                          type="button"
                          onClick={() => handleProjectChange(candidate)}
                          className="time-tracker__project-list-item"
                        >
                          #{candidate}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="time-tracker__project-empty">
                  <p>一致するプロジェクトがありません</p>
                  <p className="time-tracker__project-hint">
                    ⌘Enter で新しいプロジェクトを作成できます
                  </p>
                </div>
              )}

              <div className="time-tracker__project-actions">
                <button type="button" onClick={() => handleProjectChange(projectQuery)}>
                  {projectQuery.trim().length > 0
                    ? `＋ 「${projectQuery.trim()}」を作成`
                    : 'プロジェクトを未設定にする'}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <input
          ref={inputRef}
          className="time-tracker__input"
          type="text"
          autoFocus
          placeholder="何をやる？"
          value={displayInputValue}
          onChange={(e) => {
            if (!isRunning) setInputValue(e.target.value);
          }}
          // Enterで開始/停止（IME中Enterは自動で無視）
          onKeyDown={onEnterKey(handlePrimaryAction)}
          aria-label="取り組む内容"
        />

        <div className="time-tracker__actions">
          {isRunning ? (
            <>
              <button
                type="button"
                className="time-tracker__action time-tracker__action--ghost time-tracker__touch-target"
                onClick={handleCancel}
              >
                破棄
              </button>
              <button
                type="button"
                className="time-tracker__action time-tracker__touch-target"
                onClick={handlePrimaryAction}
              >
                {primaryLabel}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="time-tracker__action time-tracker__touch-target"
              onClick={handlePrimaryAction}
              disabled={!canStart}
            >
              {primaryLabel}
            </button>
          )}
        </div>
      </div>

      <div className="time-tracker__hints">
        <span>
          <kbd>Enter</kbd> で{isRunning ? '停止' : '開始'}
        </span>
        <span className="time-tracker__dot">·</span>
        <span>
          <kbd>⌘K</kbd> でフォーカス
        </span>
      </div>

      {isRunning ? (
        <div className="time-tracker__status" aria-live="polite">
          <span>計測中</span>
          <span className="time-tracker__timer" id={timerId}>
            {timerLabel}
          </span>
        </div>
      ) : null}

      <div className="time-tracker__details">
        {isRunning ? (
          <div
            className="time-tracker__nudges"
            role="group"
            aria-label="作業時間の調整"
            aria-describedby={timerId}
          >
            {[-10, -5, 5, 10].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onAdjustDuration(m * 60)}
                className="time-tracker__touch-target"
                aria-label={createNudgeLabel(m)}
              >
                {m > 0 ? `+${m}分` : `${m}分`}
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="time-tracker__details-toggle time-tracker__touch-target"
          onClick={onOpenRunningEditor}
          disabled={!isRunning}
          aria-expanded={isRunningEditorOpen}
        >
          詳細編集
        </button>
      </div>
    </>
  );
};
