import type React from 'react';

/** ダイアログ内のTabでフォーカスをループさせる */
export function trapTabFocus(container: HTMLElement, e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'Tab') return;
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
  if (focusable.length === 0) {
    e.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  }
}
