import { parseDateTimeLocal } from '../../../../lib/date.ts';
import type { TimeTrackerSession } from '../../domain/types.ts';

/* ===========================
 * 純粋ユーティリティ（副作用なし）
 * =========================== */

/** モーダル保存ボタンの無効化判定 */
export function isModalSaveDisabled(
  modalState: { type: 'running' } | { type: 'history'; sessionId: string } | null,
  titleInput: string,
  startInput: string,
  endInput: string,
): boolean {
  if (!modalState) return true;
  if (titleInput.trim().length === 0) return true;
  const parsedStart = parseDateTimeLocal(startInput);
  if (modalState.type === 'running') {
    return parsedStart === null;
  }
  const parsedEnd = parseDateTimeLocal(endInput);
  if (parsedStart === null || parsedEnd === null) return true;
  if (parsedEnd < parsedStart) return true;
  return false;
}

/** 履歴編集時のセッション更新オブジェクト生成 */
export function buildUpdatedSession(
  target: TimeTrackerSession,
  inputs: {
    title: string;
    project: string;
    startTime: string;
    endTime: string;
  },
): TimeTrackerSession | null {
  const trimmedTitle = inputs.title.trim();
  const trimmedProject = inputs.project.trim();

  const parsedStart = parseDateTimeLocal(inputs.startTime);
  const parsedEnd = parseDateTimeLocal(inputs.endTime);
  if (parsedStart === null || parsedEnd === null) {
    return null;
  }
  const clampedEnd = Math.max(parsedEnd, parsedStart);
  const durationSeconds = Math.max(
    1,
    Math.floor((clampedEnd - parsedStart) / 1000),
  );

  return {
    ...target,
    title: trimmedTitle,
    project: trimmedProject || undefined,
    startedAt: parsedStart,
    endedAt: clampedEnd,
    durationSeconds,
  };
}

/** 開始時刻変更時の経過時間調整計算 */
export function calculateDurationDelta(
  currentElapsedSeconds: number,
  newStartInput: string,
): number {
  const parsedStart = parseDateTimeLocal(newStartInput);
  if (parsedStart === null) return 0;

  const nowMs = Date.now();
  const clampedStart = Math.min(parsedStart, nowMs);
  const newDuration = Math.max(0, Math.floor((nowMs - clampedStart) / 1000));
  return newDuration - currentElapsedSeconds;
}
