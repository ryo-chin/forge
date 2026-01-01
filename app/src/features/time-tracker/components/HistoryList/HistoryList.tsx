import React from 'react';
import { formatTimer } from '../../../../lib/time.ts';
import { describeHistorySession } from './logic.ts';
import type { ThemeProjectTree } from '../../pages/TimeTracker/logic.ts';

type HistoryListProps = {
  tree: ThemeProjectTree;
  onEdit: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

export const HistoryList: React.FC<HistoryListProps> = ({
  tree,
  onEdit,
  onDelete,
}) => {
  if (tree.length === 0) return null;

  return (
    <section className="time-tracker__history" aria-label="最近の記録">
      <h2>最近の記録</h2>
      <div className="time-tracker__history-tree">
        {tree.map((themeNode) => {
          const themeKey = themeNode.themeId ?? 'none';
          const sessionCount = themeNode.projects.reduce(
            (sum, project) => sum + project.sessions.length,
            0,
          );
          return (
            <article
              key={themeKey}
              className="time-tracker__history-theme"
              aria-label={`${themeNode.themeName}の記録`}
            >
              <header className="time-tracker__history-theme-header">
                <h3>{themeNode.themeName}</h3>
                <span>{sessionCount}件</span>
              </header>
              <div className="time-tracker__history-projects">
                {themeNode.projects.map((projectNode) => {
                  const projectKey = `${themeKey}-${projectNode.projectName}`;
                  const projectLabel =
                    projectNode.projectName === 'プロジェクトなし'
                      ? projectNode.projectName
                      : `#${projectNode.projectName}`;
                  return (
                    <div
                      key={projectKey}
                      className="time-tracker__history-project-card"
                    >
                      <h4>{projectLabel}</h4>
                      <ul>
                        {projectNode.sessions.map((session) => {
                          const titleId = `history-session-${session.id}-title`;
                          const descriptionId = `history-session-${session.id}-description`;
                          return (
                            <li
                              key={session.id}
                              className="time-tracker__history-item"
                              aria-labelledby={titleId}
                              aria-describedby={descriptionId}
                            >
                              <span
                                className="time-tracker__sr-only"
                                id={descriptionId}
                              >
                                {describeHistorySession(session)}
                              </span>
                              <div className="time-tracker__history-main">
                                <strong id={titleId}>{session.title}</strong>
                                <span>{formatTimer(session.durationSeconds)}</span>
                              </div>
                              <div className="time-tracker__history-meta">
                                {session.project ? (
                                  <span>#{session.project}</span>
                                ) : null}
                                {session.tags?.length ? (
                                  <span>
                                    {session.tags.map((tag) => `#${tag}`).join(' ')}
                                  </span>
                                ) : null}
                                {session.skill ? (
                                  <span>@{session.skill}</span>
                                ) : null}
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
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
