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
