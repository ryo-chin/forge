import { useCallback, useEffect, useMemo, useState } from 'react';
import './index.css';
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
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessions, setSessions] = useState<TimeTrackerSession[]>([]);

  useEffect(() => {
    if (!isRunning || startedAt === null) return;

    const update = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, startedAt]);

  const canStart = useMemo(
    () => inputValue.trim().length > 0 && !isRunning,
    [inputValue, isRunning],
  );

  const handleStart = useCallback(() => {
    if (!canStart) return;
    const now = Date.now();
    setIsRunning(true);
    setStartedAt(now);
    setElapsedSeconds(0);
  }, [canStart]);

  const handleStop = useCallback(() => {
    if (!isRunning || startedAt === null) return;

    const now = Date.now();
    const durationSeconds = Math.max(1, Math.floor((now - startedAt) / 1000));
    const session: TimeTrackerSession = {
      id: `${now}`,
      title: inputValue.trim(),
      startedAt,
      endedAt: now,
      durationSeconds,
    };

    setSessions((prev) => [session, ...prev].slice(0, 5));
    setIsRunning(false);
    setStartedAt(null);
    setElapsedSeconds(0);
    setInputValue('');
  }, [inputValue, isRunning, startedAt]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleStart();
      }
    },
    [handleStart],
  );

  return (
    <main className="time-tracker">
      <header className="time-tracker__header">
        <h1>Training Tracker</h1>
        <p>キーワードを入力して Enter でタイマーを開始します。</p>
      </header>

      <section className="time-tracker__timer">
        <div className="timer-face" aria-live="polite">
          {formatTimer(elapsedSeconds)}
        </div>
        <input
          className="quick-input"
          type="text"
          autoFocus
          placeholder="何をやる？"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
        />
        <div className="controls" role="group" aria-label="タイマー操作">
          <button
            type="button"
            className="primary"
            onClick={handleStart}
            disabled={!canStart}
          >
            スタート
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleStop}
            disabled={!isRunning}
          >
            ストップ
          </button>
        </div>
      </section>

      <section className="time-tracker__log">
        <h2>最近のログ</h2>
        {sessions.length === 0 ? (
          <div className="empty-state">まだ記録がありません。</div>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id} className="session-item">
                <strong>{session.title}</strong>
                <span className="session-meta">
                  {new Date(session.startedAt).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {` / ${formatTimer(session.durationSeconds)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
