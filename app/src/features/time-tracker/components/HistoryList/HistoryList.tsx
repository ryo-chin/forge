import React from 'react';
import { formatTimer } from '../../../../lib/time.ts';
import type { TimeTrackerSession } from '../../domain/types.ts';
import { describeHistorySession } from './logic.ts';

type HistoryListProps = {
  sessions: TimeTrackerSession[];
  onEdit: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

export const HistoryList: React.FC<HistoryListProps> = ({
  sessions,
  onEdit,
  onDelete,
}) => {
  if (sessions.length === 0) return null;

  return (
    <section className="time-tracker__history" aria-label="最近の記録">
      <h2>最近の記録</h2>
      <ul>
        {sessions.map((session) => {
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
              <div className="time-tracker__history-meta">
                {session.project ? <span>#{session.project}</span> : null}
                {session.tags?.length ? (
                  <span>
                    {session.tags.map((tag) => `#${tag}`).join(' ')}
                  </span>
                ) : null}
                {session.skill ? <span>@{session.skill}</span> : null}
              </div>
              <div className="time-tracker__history-actions">
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
    </section>
  );
};
