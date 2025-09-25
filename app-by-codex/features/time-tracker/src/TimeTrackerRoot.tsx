import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import { useRunningSession } from './hooks/useRunningSession';

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
  const inputRef = useRef<HTMLInputElement>(null);

  const { state, start, stop } = useRunningSession();
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
    if (runningDraftTitle) {
      setInputValue(runningDraftTitle);
    }
    stop();
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
      </div>
    </main>
  );
}
