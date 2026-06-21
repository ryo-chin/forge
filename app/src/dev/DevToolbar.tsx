// ローカル検証用の dev ツールバー（import.meta.env.DEV のときだけ描画）。
// 本番ビルドでは main.tsx 側のガードによりマウントされない。

import { useState } from 'react';
import { resetLocalData, seedLocalData } from './seedLocalData.ts';

export function DevToolbar(): JSX.Element {
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      window.location.reload(); // react-query の initialData を読み直すため再読込
    } catch (error) {
      console.error('[forge dev] 操作に失敗しました', error);
      setBusy(false);
    }
  };

  return (
    <div className="dev-toolbar" role="group" aria-label="開発用ツール">
      <span className="dev-toolbar__label">DEV</span>
      <button
        type="button"
        className="dev-toolbar__button"
        disabled={busy}
        onClick={() => run(seedLocalData)}
      >
        サンプル投入
      </button>
      <button
        type="button"
        className="dev-toolbar__button dev-toolbar__button--ghost"
        disabled={busy}
        onClick={() => run(resetLocalData)}
      >
        全消去
      </button>
    </div>
  );
}
