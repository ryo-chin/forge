# 実装パターン集

> このドキュメントは既存コードから抽出したパターン集です。
> 新機能実装時の参考として使用してください。

## コンポーネント実装パターン

### サイドカーファイルパターン

コンポーネントと密結合だが再利用可能なロジックを分離する。

```
components/
└── Composer/
    ├── Composer.tsx      # UIとイベント処理
    ├── logic.ts          # 再利用可能なロジック
    └── index.ts
```

**Composer.tsx**:
```typescript
import { calculateDuration, formatTitle } from './logic';

export function Composer({ session, onSave }) {
  const duration = calculateDuration(session.startedAt);
  const title = formatTitle(session.title);
  // ...
}
```

**logic.ts**:
```typescript
export function calculateDuration(startedAt: number): number {
  return Math.floor((Date.now() - startedAt) / 1000);
}

export function formatTitle(title: string): string {
  return title.trim() || 'Untitled';
}
```

### フック分離パターン

複雑なフックロジックを別ファイルに分離する。

```
components/
└── Modal/
    ├── Modal.tsx
    ├── Modal.hooks.ts    # フック専用ファイル
    └── index.ts
```

**Modal.hooks.ts**:
```typescript
export function useModalKeyboard(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
}
```

## データ取得パターン

### Feature内データフック

機能固有のデータ取得は `features/<feature>/hooks/data/` に配置。

```typescript
// features/time-tracker/hooks/data/useRunningSession.ts
export function useRunningSession() {
  const [state, setState] = useState<RunningSessionState>({ status: 'idle' });

  const start = useCallback((draft: SessionDraft) => {
    setState({ status: 'running', draft, elapsedSeconds: 0 });
    persistRunningState(draft);
  }, []);

  const stop = useCallback(() => {
    setState({ status: 'idle', draft: null, elapsedSeconds: 0 });
    clearRunningState();
  }, []);

  return { state, start, stop };
}
```

### Repository Pattern

データソースを抽象化し、切り替え可能にする。

```typescript
// infra/repository/TimeTracker/types.ts
export interface TimeTrackerDataSource {
  getSessions(): Promise<Session[]>;
  saveSession(session: Session): Promise<void>;
  deleteSession(id: string): Promise<void>;
}

// infra/repository/TimeTracker/localStorageDataSource.ts
export const localStorageDataSource: TimeTrackerDataSource = {
  async getSessions() {
    return JSON.parse(localStorage.getItem('sessions') ?? '[]');
  },
  // ...
};

// infra/repository/TimeTracker/supabaseDataSource.ts
export const supabaseDataSource: TimeTrackerDataSource = {
  async getSessions() {
    const { data } = await supabase.from('sessions').select('*');
    return data ?? [];
  },
  // ...
};
```

## ドメインロジックパターン

### 純粋関数によるビジネスロジック

```typescript
// features/time-tracker/domain/runningSession.ts
export function calculateElapsedSeconds(startedAt: number): number {
  return Math.floor((Date.now() - startedAt) / 1000);
}

export function isSessionValid(draft: SessionDraft): boolean {
  return draft.title.trim().length > 0 && draft.startedAt > 0;
}

export function toCompletedSession(
  draft: SessionDraft,
  endedAt: number
): Session {
  return {
    id: draft.id,
    title: draft.title,
    startedAt: draft.startedAt,
    endedAt,
    durationSeconds: Math.floor((endedAt - draft.startedAt) / 1000),
    project: draft.project,
    tags: draft.tags ?? [],
  };
}
```

### Reducer Pattern

状態遷移を明示的に管理する。

```typescript
// features/time-tracker/domain/sessionReducer.ts
type Action =
  | { type: 'START'; payload: { title: string; startedAt: number } }
  | { type: 'UPDATE'; payload: Partial<SessionDraft> }
  | { type: 'STOP' };

export function sessionReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START':
      return {
        status: 'running',
        draft: {
          id: crypto.randomUUID(),
          title: action.payload.title,
          startedAt: action.payload.startedAt,
        },
      };
    case 'UPDATE':
      if (state.status !== 'running') return state;
      return {
        ...state,
        draft: { ...state.draft, ...action.payload },
      };
    case 'STOP':
      return { status: 'idle', draft: null };
  }
}
```

## テストパターン

### コンポーネントテスト

```typescript
// components/SyncStatusBanner/__tests__/SyncStatusBanner.test.tsx
import { render, screen } from '@testing-library/react';
import { SyncStatusBanner } from '../SyncStatusBanner';

describe('SyncStatusBanner', () => {
  it('同期中はローディング状態を表示する', () => {
    render(<SyncStatusBanner status="syncing" />);
    expect(screen.getByRole('status')).toHaveTextContent('同期中');
  });

  it('エラー時はエラーメッセージを表示する', () => {
    render(<SyncStatusBanner status="error" message="接続失敗" />);
    expect(screen.getByRole('alert')).toHaveTextContent('接続失敗');
  });
});
```

### ドメインロジックテスト

```typescript
// features/time-tracker/domain/runningSession.test.ts
import { calculateElapsedSeconds, toCompletedSession } from './runningSession';

describe('calculateElapsedSeconds', () => {
  it('開始時刻から経過秒数を計算する', () => {
    const startedAt = Date.now() - 3000; // 3秒前
    const elapsed = calculateElapsedSeconds(startedAt);
    expect(elapsed).toBeGreaterThanOrEqual(3);
    expect(elapsed).toBeLessThan(5);
  });
});

describe('toCompletedSession', () => {
  it('draftから完了セッションを生成する', () => {
    const draft = { id: '1', title: 'Test', startedAt: 1000 };
    const session = toCompletedSession(draft, 4000);
    expect(session.durationSeconds).toBe(3);
    expect(session.endedAt).toBe(4000);
  });
});
```

### フックテスト

```typescript
// features/time-tracker/hooks/data/__tests__/useRunningSession.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useRunningSession } from '../useRunningSession';

describe('useRunningSession', () => {
  it('セッションを開始できる', () => {
    const { result } = renderHook(() => useRunningSession());

    act(() => {
      result.current.start({ title: 'Test', startedAt: Date.now() });
    });

    expect(result.current.state.status).toBe('running');
    expect(result.current.state.draft?.title).toBe('Test');
  });
});
```

## 副作用の閉じ込めパターン

### useEffectによるイベントリスナー

```typescript
function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === key && !e.repeat) {
        callback();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, callback]);
}
```

### attach*ヘルパーパターン

```typescript
// lib/accessibility/focus.ts
export function attachFocusTrap(element: HTMLElement) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  element.addEventListener('keydown', handler);
  return () => element.removeEventListener('keydown', handler);
}
```
