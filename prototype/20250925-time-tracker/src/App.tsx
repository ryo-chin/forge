import { useEffect, useMemo, useState } from 'react';

type Session = {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
};

const formatTimer = (seconds: number) => {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
};

const formatSessionMeta = (session: Session) => {
  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt);
  const timeRange = `${start.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })} – ${end.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  return `${timeRange} / ${formatTimer(session.durationSeconds)}`;
};

export default function App() {
  const [inputValue, setInputValue] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!isRunning || startedAt === null) return;

    const update = () => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startedAt) / 1000));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning, startedAt]);

  const canStart = useMemo(
    () => inputValue.trim().length > 0 && !isRunning,
    [inputValue, isRunning],
  );

  const handleStart = () => {
    if (!canStart) return;
    setIsRunning(true);
    const now = Date.now();
    setStartedAt(now);
    setElapsedSeconds(0);
  };

  const handleStop = () => {
    if (!isRunning || startedAt === null) return;

    const now = Date.now();
    const durationSeconds = Math.max(1, Math.floor((now - startedAt) / 1000));
    const session: Session = {
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
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleStart();
    }
  };

  return (
    <main>
      <header>
        <h1>Training Tracker</h1>
        <p>キーワードを入力して Enter でタイマーを開始します。</p>
      </header>

      <section className="timer-shell">
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
          <button type="button" className="primary" onClick={handleStart} disabled={!canStart}>
            スタート
          </button>
          <button type="button" className="secondary" onClick={handleStop} disabled={!isRunning}>
            ストップ
          </button>
        </div>
      </section>

      <section className="session-log">
        <h2>最近のログ</h2>
        {sessions.length === 0 ? (
          <div className="empty-state">まだ記録がありません。</div>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id} className="session-item">
                <strong>{session.title}</strong>
                <span className="session-meta">{formatSessionMeta(session)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
