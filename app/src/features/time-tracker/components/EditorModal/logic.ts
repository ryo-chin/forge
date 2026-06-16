/** 作業時間（ms）を HH:MM 表示にする（例: 72:59 / 00:05）。null は '—' */
export function formatDurationLabel(durationMs: number | null): string {
  if (durationMs === null) return '—';
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/* ===========================
 * attach 系（副作用を外出しした関数）
 * =========================== */

/** モーダル open 時に autofocus 要素や最初の input へ focus */
export function focusModalOnOpen(getContainer: () => HTMLElement | null) {
  const id = requestAnimationFrame(() => {
    const container = getContainer();
    if (!container) return;
    const focusTarget =
      container.querySelector<HTMLElement>(
        '[data-autofocus="true"], input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      ) ?? container;
    focusTarget?.focus();
  });
  return () => cancelAnimationFrame(id);
}
/** Esc キーでモーダルを閉じる */
export function attachEscapeClose(onClose: () => void) {
  if (typeof window === 'undefined') return;
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}
