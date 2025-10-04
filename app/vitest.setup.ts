import '@testing-library/jest-dom/vitest';

declare global {
  // Vitest 環境で act 確認フラグが未定義の場合に備える
  // eslint-disable-next-line vars-on-top, no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// React 18 で act(...) 警告を抑制するためのフラグ
if (typeof globalThis.IS_REACT_ACT_ENVIRONMENT === 'undefined') {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}
