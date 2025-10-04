import type { TimeTrackerSession } from '@features/time-tracker/src/types';
import { formatDurationForAria } from '@lib/time';

/* ===========================
 * 純粋ユーティリティ（副作用なし）
 * =========================== */

/** 履歴セッションのARIA説明文を生成 */
export function describeHistorySession(session: TimeTrackerSession): string {
  const parts = [
    `タイトル ${session.title}`,
    `所要時間 ${formatDurationForAria(session.durationSeconds)}`,
  ];
  if (session.project) parts.push(`プロジェクト ${session.project}`);
  if (session.tags?.length) parts.push(`タグ ${session.tags.join('、')}`);
  if (session.skill) parts.push(`スキル ${session.skill}`);
  return parts.join('、');
}
