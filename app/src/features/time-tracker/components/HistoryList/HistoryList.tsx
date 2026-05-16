import { formatTimer } from '@lib/time.ts';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimeTrackerSession } from '../../domain/types.ts';
import { describeHistorySession, filterHistorySessions, formatHistoryTimeRange } from './logic.ts';

type HistoryListProps = {
  sessions: TimeTrackerSession[];
  onEdit: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onRestart: (session: TimeTrackerSession) => boolean;
  isRunning: boolean;
};

const HISTORY_PAGE_SIZE = 10;

export const HistoryList: React.FC<HistoryListProps> = ({
  sessions,
  onEdit,
  onDelete,
  onRestart,
  isRunning,
}) => {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filteredSessions = useMemo(() => filterHistorySessions(sessions, query), [sessions, query]);
  const visibleSessions = useMemo(
    () => filteredSessions.slice(0, visibleCount),
    [filteredSessions, visibleCount],
  );
  const hasMore = visibleCount < filteredSessions.length;
  const remainingCount = Math.max(0, filteredSessions.length - visibleSessions.length);

  const loadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(current + HISTORY_PAGE_SIZE, filteredSessions.length));
  }, [filteredSessions.length]);

  const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setVisibleCount(HISTORY_PAGE_SIZE);
  }, []);

  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === 'undefined') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: '160px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (sessions.length === 0) return null;

  return (
    <section className="time-tracker__history" aria-label="最近の記録">
      <div className="time-tracker__history-header">
        <h2>最近の記録</h2>
        <span>
          {visibleSessions.length}/{filteredSessions.length}
        </span>
      </div>
      <label className="time-tracker__history-search">
        <span>履歴を検索</span>
        <input
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder="タイトル・プロジェクト・タグ"
          aria-label="最近の記録を検索"
        />
      </label>
      {visibleSessions.length === 0 ? (
        <p className="time-tracker__history-empty" role="status">
          一致する記録はありません
        </p>
      ) : (
        <ul>
          {visibleSessions.map((session) => {
            const titleId = `history-session-${session.id}-title`;
            const descriptionId = `history-session-${session.id}-description`;
            return (
              <li
                key={session.id}
                className="time-tracker__history-item"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
              >
                <span className="time-tracker__sr-only" id={descriptionId}>
                  {describeHistorySession(session)}
                </span>
                <div className="time-tracker__history-main">
                  <strong id={titleId}>{session.title}</strong>
                  <span>{formatTimer(session.durationSeconds)}</span>
                </div>
                <div className="time-tracker__history-range">{formatHistoryTimeRange(session)}</div>
                <div className="time-tracker__history-meta">
                  {session.project ? (
                    <span className="time-tracker__history-meta-item">#{session.project}</span>
                  ) : null}
                  {session.tags?.map((tag) => (
                    <span className="time-tracker__history-meta-item" key={tag}>
                      #{tag}
                    </span>
                  ))}
                  {session.skill ? (
                    <span className="time-tracker__history-meta-item">@{session.skill}</span>
                  ) : null}
                </div>
                <div className="time-tracker__history-actions">
                  <button
                    type="button"
                    className="time-tracker__history-button"
                    onClick={() => onRestart(session)}
                    disabled={isRunning}
                    aria-label={`「${session.title}」を再開始`}
                  >
                    再開始
                  </button>
                  <button
                    type="button"
                    className="time-tracker__history-button"
                    onClick={() => onEdit(session.id)}
                    aria-label={`「${session.title}」を編集`}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="time-tracker__history-button time-tracker__history-button--danger"
                    onClick={() => onDelete(session.id)}
                    aria-label={`「${session.title}」を削除`}
                  >
                    削除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore ? (
        <div className="time-tracker__history-load-more" ref={sentinelRef}>
          <button type="button" className="time-tracker__history-button" onClick={loadMore}>
            さらに表示（残り{remainingCount}件）
          </button>
        </div>
      ) : null}
    </section>
  );
};
