import { parseDateTimeLocal } from '../../../../lib/date.ts';
import type {
  TimeTrackerSession,
  TimeTrackerTheme,
} from '../../domain/types.ts';

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

export type ThemeProjectTree = Array<{
  themeId: string | null;
  themeName: string;
  projects: Array<{
    projectName: string;
    sessions: TimeTrackerSession[];
  }>;
}>;

export const buildThemeProjectTree = (
  sessions: TimeTrackerSession[],
  themes: TimeTrackerTheme[],
): ThemeProjectTree => {
  if (sessions.length === 0) return [];
  const nameMap = new Map<string, string>();
  themes.forEach((theme) => {
    nameMap.set(theme.id, theme.name);
  });
  const groups = new Map<
    string,
    { themeId: string | null; themeName: string; projects: Map<string, TimeTrackerSession[]> }
  >();

  sessions.forEach((session) => {
    const themeId = session.themeId ?? null;
    const key = themeId ?? 'no-theme';
    let group = groups.get(key);
    if (!group) {
      const themeName = themeId
        ? nameMap.get(themeId) ?? '未登録のテーマ'
        : 'テーマなし';
      group = {
        themeId,
        themeName,
        projects: new Map(),
      };
      groups.set(key, group);
    }
    const projectName =
      session.project && session.project.trim().length > 0
        ? session.project
        : 'プロジェクトなし';
    const current = group.projects.get(projectName) ?? [];
    current.push(session);
    group.projects.set(projectName, current);
  });

  return Array.from(groups.values()).map((group) => ({
    themeId: group.themeId,
    themeName: group.themeName,
    projects: Array.from(group.projects.entries()).map(
      ([projectName, projectSessions]) => ({
        projectName,
        sessions: projectSessions,
      }),
    ),
  }));
};
