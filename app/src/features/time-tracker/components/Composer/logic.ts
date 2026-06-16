/* ===========================
 * Composer 固有のユーティリティ
 * 検索/候補/Enter/clickaway 等の汎用ロジックは ../SearchPicker に集約済み。
 * =========================== */

/** ⌘/Ctrl+K で任意要素にフォーカス */
export function attachGlobalFocusShortcut(focus: () => void) {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      focus();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
