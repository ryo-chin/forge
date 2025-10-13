import type { TimeTrackerSession } from "../../domain/types.ts";
import React from 'react';

/* ===========================
 * 純粋ユーティリティ（副作用なし）
 * =========================== */

/** プロジェクト候補を生成（重複除去・上限） */
export function buildProjectSuggestions(
  project: string,
  sessions: TimeTrackerSession[],
  limit = 12
): string[] {
  const seen = new Set<string>();
  const add = (v?: string | null) => {
    const t = (v ?? "").trim();
    if (t) seen.add(t);
  };
  add(project);
  sessions.forEach((s) => add(s.project));
  return Array.from(seen).slice(0, limit);
}

/** クエリで候補をフィルタ */
export function filterSuggestions(candidates: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  return q ? candidates.filter((c) => c.toLowerCase().includes(q)) : candidates;
}

/** IME合成中のEnterを検知（Enter判定の内部補助） */
function isImeComposingEnter(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Enter") return false;
  const ne = e.nativeEvent as { isComposing?: boolean; keyCode?: number };
  return ne.isComposing === true || ne.keyCode === 229;
}

/** Enterで実行（IME中は無視、必要ならpreventDefault） */
export function onEnterKey(
  run: () => void,
  opts: { preventDefault?: boolean } = { preventDefault: true }
) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || isImeComposingEnter(e)) return;
    if (opts.preventDefault) e.preventDefault();
    run();
  };
}

/** Enter / ⌘(Ctrl)+Enter を切り分けて実行 */
export function onEnterOrMetaEnter(
  handlers: { onEnter: (e: React.KeyboardEvent<HTMLElement>) => void; onMetaEnter?: (e: React.KeyboardEvent<HTMLElement>) => void },
  opts: { preventDefault?: boolean } = { preventDefault: true }
) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter" || isImeComposingEnter(e)) return;
    if (opts.preventDefault) e.preventDefault();
    const useMeta = (e.metaKey || e.ctrlKey) && handlers.onMetaEnter;
    (useMeta ? handlers.onMetaEnter! : handlers.onEnter)(e);
  };
}

/** Enterで「候補の先頭 pick」し、なければ submit する */
export function onEnterPickFirstElseSubmit<T>(
  getCandidates: () => readonly T[],
  pick: (t: T) => void,
  submit: () => void,
  opts: { preventDefault?: boolean } = { preventDefault: true }
) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter" || isImeComposingEnter(e)) return;
    if (opts.preventDefault) e.preventDefault();
    const list = getCandidates();
    list && list.length > 0 ? pick(list[0]) : submit();
  };
}


/* ===========================
 * attach 系（副作用を外出しした関数）
 * =========================== */

/** ⌘/Ctrl+K で任意要素にフォーカス */
export function attachGlobalFocusShortcut(focus: () => void) {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      focus();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}

/** クリックアウェイと Esc で閉じる。閉じたらトリガへフォーカス */
export function attachClickAwayAndEsc(opts: {
  menuEl: () => HTMLElement | null;
  triggerEl: () => HTMLElement | null;
  onTriggerd: () => void;
}) {
  const onClick = (ev: MouseEvent) => {
    const target = ev.target as Node;
    const menu = opts.menuEl();
    const trigger = opts.triggerEl();
    if (menu && !menu.contains(target) && trigger && !trigger.contains(target)) {
      opts.onTriggerd();
    }
  };
  const onEsc = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      opts.onTriggerd();
    }
  };
  window.addEventListener("mousedown", onClick);
  window.addEventListener("keydown", onEsc);
  return () => {
    window.removeEventListener("mousedown", onClick);
    window.removeEventListener("keydown", onEsc);
  };
}

/** メニュー open 時に検索欄へ focus + select */
export function focusSearchOnOpen(getEl: () => HTMLInputElement | null) {
  const id = requestAnimationFrame(() => {
    const el = getEl();
    el?.focus();
    el?.select();
  });
  return () => cancelAnimationFrame(id);
}
