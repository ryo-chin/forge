import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import { useRunningSession } from './hooks/useRunningSession';
import type { TimeTrackerSession } from './types';

const formatTimer = (seconds: number) => {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
};

export function TimeTrackerRoot() {
  const [inputValue, setInputValue] = useState('');
  const [sessions, setSessions] = useState<TimeTrackerSession[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [projectInput, setProjectInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { state, start, stop, updateDraft, adjustDuration } = useRunningSession();
  const isRunning = state.status === 'running';
  const elapsedSeconds = state.elapsedSeconds;
  const runningDraftTitle = state.status === 'running' ? state.draft.title : null;

  useEffect(() => {
    const handleFocusShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleFocusShortcut);
    return () => window.removeEventListener('keydown', handleFocusShortcut);
  }, []);

  useEffect(() => {
    if (state.status === 'running') {
      const draft = state.draft;
      setProjectInput(draft.project ?? '');
    } else {
      setProjectInput('');
      setIsDetailsOpen(false);
    }
    // 起動時と停止時のみ初期値を同期するため、status 以外の依存は意図的に無視する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const canStart = useMemo(
    () => inputValue.trim().length > 0 && !isRunning,
    [inputValue, isRunning],
  );

  const handleStart = useCallback(() => {
    if (!canStart) return;
    const started = start(inputValue);
    if (started) {
      setInputValue('');
    }
  }, [canStart, inputValue, start]);

  const handleStop = useCallback(() => {
    const titleForInput = runningDraftTitle;
    const session = stop();
    if (!session) return;
    if (titleForInput) {
      setInputValue(titleForInput);
    }
    setSessions((prev) => [session, ...prev].slice(0, 5));
    setIsDetailsOpen(false);
  }, [runningDraftTitle, stop]);

  const handlePrimaryAction = useCallback(() => {
    if (isRunning) {
      handleStop();
    } else {
      handleStart();
    }
  }, [handleStart, handleStop, isRunning]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        const nativeEvent = event.nativeEvent;
        const isNativeComposing =
          (nativeEvent as { isComposing?: boolean }).isComposing === true;
        const isImeKey =
          (nativeEvent as { keyCode?: number }).keyCode === 229;
        if (isNativeComposing || isImeKey) {
          return;
        }
        event.preventDefault();
        handlePrimaryAction();
      }
    },
    [handlePrimaryAction],
  );

  const displayInputValue = isRunning
    ? runningDraftTitle ?? ''
    : inputValue;
  const primaryLabel = isRunning ? '停止' : '開始';
  const primaryDisabled = !isRunning && !canStart;
  const timerLabel = formatTimer(elapsedSeconds);

  const handleNudge = useCallback(
    (minutes: number) => {
      const deltaSeconds = minutes * 60;
      adjustDuration(deltaSeconds);
    },
    [adjustDuration],
  );
  const draftProject = projectInput;

  return (
    <main className="time-tracker">
      <div className="time-tracker__panel">
        <header className="time-tracker__header">
          <h1>Time Tracker</h1>
          <p>何をやりますか？</p>
        </header>

        <div className="time-tracker__composer">
          <input
            ref={inputRef}
            className="time-tracker__input"
            type="text"
            autoFocus
            placeholder="何をやる？"
            value={displayInputValue}
            onChange={(event) => {
              if (isRunning) return;
              setInputValue(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            aria-label="取り組む内容"
          />
          <button
            type="button"
            className="time-tracker__action"
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </button>
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
            <span className="time-tracker__timer">{timerLabel}</span>
          </div>
        ) : null}

        <div className="time-tracker__details">
          {isRunning ? (
            <div className="time-tracker__nudges" role="group" aria-label="作業時間の調整">
              <button type="button" onClick={() => handleNudge(-10)}>
                -10分
              </button>
              <button type="button" onClick={() => handleNudge(-5)}>
                -5分
              </button>
              <button type="button" onClick={() => handleNudge(5)}>
                +5分
              </button>
              <button type="button" onClick={() => handleNudge(10)}>
                +10分
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="time-tracker__details-toggle"
            onClick={() => setIsDetailsOpen((prev) => !prev)}
            disabled={!isRunning}
            aria-expanded={isDetailsOpen}
          >
            {isDetailsOpen ? '詳細を閉じる' : '＋ 詳細編集'}
          </button>

          {isDetailsOpen && (
            <form className="time-tracker__details-form">
              <div className="time-tracker__field">
                <label htmlFor="detail-title">タイトル</label>
                <input
                  id="detail-title"
                  type="text"
                  value={runningDraftTitle ?? ''}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="time-tracker__field">
                <label htmlFor="detail-project">プロジェクト</label>
                <input
                  id="detail-project"
                  type="text"
                  value={draftProject}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProjectInput(value);
                    updateDraft({ project: value || undefined });
                  }}
                  autoComplete="off"
                />
              </div>
            </form>
          )}
        </div>

        {sessions.length > 0 ? (
          <section className="time-tracker__history" aria-label="最近の記録">
            <h2>最近の記録</h2>
            <ul>
              {sessions.map((session) => (
                <li key={session.id} className="time-tracker__history-item">
                  <div className="time-tracker__history-main">
                    <strong>{session.title}</strong>
                    <span>{formatTimer(session.durationSeconds)}</span>
                  </div>
                  <div className="time-tracker__history-meta">
                    {session.project ? <span>#{session.project}</span> : null}
                    {session.tags?.length ? (
                      <span>{session.tags.map((tag) => `#${tag}`).join(' ')}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
