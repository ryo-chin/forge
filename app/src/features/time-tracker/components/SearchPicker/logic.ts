import type React from 'react';
import type { TimeTrackerSession } from '../../domain/types.ts';

/* ===========================
 * 候補生成（純粋）
 * =========================== */

/** 文字列配列からユニークな候補を生成（current を先頭に寄せ、重複除去・上限適用） */
export function buildSuggestions(values: Iterable<string>, current = '', limit = 12): string[] {
  const seen = new Set<string>();
  const add = (v?: string | null) => {
    const t = (v ?? '').trim();
    if (t) seen.add(t);
  };
  add(current);
  for (const v of values) add(v);
  return Array.from(seen).slice(0, limit);
}

/** プロジェクト候補（現在値を優先・履歴から抽出） */
export function buildProjectSuggestions(
  project: string,
  sessions: TimeTrackerSession[],
  limit = 12,
): string[] {
  return buildSuggestions(
    sessions.map((s) => s.project ?? ''),
    project,
    limit,
  );
}

/** タイトル候補（履歴から抽出） */
export function buildTitleSuggestions(
  current: string,
  sessions: TimeTrackerSession[],
  limit = 12,
): string[] {
  return buildSuggestions(
    sessions.map((s) => s.title ?? ''),
    current,
    limit,
  );
}

/** クエリで候補をフィルタ（部分一致・大文字小文字無視） */
export function filterSuggestions(candidates: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  return q ? candidates.filter((c) => c.toLowerCase().includes(q)) : candidates;
}

/* ===========================
 * キーボード（IME 対応）
 * =========================== */

/** IME合成中のEnterを検知（Enter判定の内部補助） */
function isImeComposingEnter(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return false;
  const ne = e.nativeEvent as { isComposing?: boolean; keyCode?: number };
  return ne.isComposing === true || ne.keyCode === 229;
}

/** Enterで実行（IME中は無視、必要ならpreventDefault） */
export function onEnterKey(
  run: () => void,
  opts: { preventDefault?: boolean } = { preventDefault: true },
) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || isImeComposingEnter(e)) return;
    if (opts.preventDefault) e.preventDefault();
    run();
  };
}

/** Enter / ⌘(Ctrl)+Enter を切り分けて実行 */
export function onEnterOrMetaEnter(
  handlers: {
    onEnter: (e: React.KeyboardEvent<HTMLElement>) => void;
    onMetaEnter?: (e: React.KeyboardEvent<HTMLElement>) => void;
  },
  opts: { preventDefault?: boolean } = { preventDefault: true },
) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || isImeComposingEnter(e)) return;
    if (opts.preventDefault) e.preventDefault();
    const useMeta = (e.metaKey || e.ctrlKey) && handlers.onMetaEnter;
    const handler = useMeta ? handlers.onMetaEnter : handlers.onEnter;
    if (handler) handler(e);
  };
}

/** Enterで「候補の先頭 pick」し、なければ submit する */
export function onEnterPickFirstElseSubmit<T>(
  getCandidates: () => readonly T[],
  pick: (t: T) => void,
  submit: () => void,
  opts: { preventDefault?: boolean } = { preventDefault: true },
) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || isImeComposingEnter(e)) return;
    if (opts.preventDefault) e.preventDefault();
    const list = getCandidates();
    list && list.length > 0 ? pick(list[0]) : submit();
  };
}

/* ===========================
 * attach 系（副作用を外出しした関数）
 * =========================== */

/** クリックアウェイと Esc で閉じる */
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
    if (ev.key === 'Escape') {
      opts.onTriggerd();
    }
  };
  window.addEventListener('mousedown', onClick);
  window.addEventListener('keydown', onEsc);
  return () => {
    window.removeEventListener('mousedown', onClick);
    window.removeEventListener('keydown', onEsc);
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
