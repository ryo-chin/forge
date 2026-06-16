import type { EditorModalResult } from '../../components/EditorModal';
import type { SessionDraft, TimeTrackerSession } from '../../domain/types.ts';

/* ===========================
 * 純粋ユーティリティ（副作用なし）
 * =========================== */

/**
 * モーダルの入力結果からセッションを生成する。
 * base を渡すと id とメタ情報（tags/skill/intensity/notes）を引き継ぐ
 * （履歴編集・計測中の完了）。base 無しは新規（id 採番）。
 */
export function composeSession(
  result: EditorModalResult,
  base?: SessionDraft | TimeTrackerSession,
): TimeTrackerSession {
  const durationSeconds = Math.max(1, Math.floor((result.endMs - result.startMs) / 1000));
  const session: TimeTrackerSession = {
    id: base?.id ?? crypto.randomUUID(),
    title: result.title.trim(),
    startedAt: result.startMs,
    endedAt: result.endMs,
    durationSeconds,
  };
  const project = result.project.trim();
  if (project) session.project = project;
  if (base?.tags?.length) session.tags = base.tags.slice();
  if (base?.skill) session.skill = base.skill;
  if (base?.intensity) session.intensity = base.intensity;
  if (base?.notes) session.notes = base.notes;
  return session;
}

/** 過去登録モーダルの初期値（開始 = 現在-30分を5分丸め、終了 = 開始+30分） */
export function defaultManualRange(nowMs: number): { startMs: number; endMs: number } {
  const rounded = Math.floor((nowMs - 30 * 60_000) / (5 * 60_000)) * (5 * 60_000);
  return { startMs: rounded, endMs: rounded + 30 * 60_000 };
}
