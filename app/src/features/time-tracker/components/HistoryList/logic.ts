import { formatDurationForAria } from '@lib/time.ts';
import type { TimeTrackerSession } from '../../domain/types.ts';

/* ===========================
 * 純粋ユーティリティ（副作用なし）
 * =========================== */

/** 履歴セッションのARIA説明文を生成 */
export function describeHistorySession(session: TimeTrackerSession): string {
  const parts = [
    `タイトル ${session.title}`,
    `記録時間 ${formatHistoryTimeRange(session)}`,
    `所要時間 ${formatDurationForAria(session.durationSeconds)}`,
  ];
  if (session.project) parts.push(`プロジェクト ${session.project}`);
  if (session.tags?.length) parts.push(`タグ ${session.tags.join('、')}`);
  if (session.skill) parts.push(`スキル ${session.skill}`);
  return parts.join('、');
}

const pad2 = (value: number) => value.toString().padStart(2, '0');

const formatDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

const formatTime = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const isSameLocalDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function formatHistoryTimeRange(session: TimeTrackerSession): string {
  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt);
  const startLabel = `${formatDate(start)} ${formatTime(start)}`;
  const endLabel = isSameLocalDate(start, end)
    ? formatTime(end)
    : `${formatDate(end)} ${formatTime(end)}`;
  return `${startLabel} - ${endLabel}`;
}
