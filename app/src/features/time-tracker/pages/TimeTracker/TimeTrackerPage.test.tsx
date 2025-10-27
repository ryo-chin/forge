import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, vi } from 'vitest';
import * as googleSyncHooks from '../../hooks/data/useGoogleSpreadsheetSync.ts';
import { TimeTrackerPage } from './TimeTrackerPage.tsx';
import { BrowserRouter } from 'react-router-dom';

const STORAGE_KEY_SESSIONS = 'codex-time-tracker/sessions';
const STORAGE_KEY_RUNNING = 'codex-time-tracker/running';

const syncSessionMock = vi.fn(async () => null);
const syncRunningSessionStartMock = vi.fn(async () => ({ success: true }));
const syncRunningSessionUpdateMock = vi.fn(async () => ({ success: true }));
const syncRunningSessionCancelMock = vi.fn(async () => ({ success: true }));
const deleteSessionRowMock = vi.fn(async () => ({ success: true }));

const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const renderTimeTrackerPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TimeTrackerPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  window.localStorage.clear();
});

beforeEach(() => {
  syncSessionMock.mockReset();
  syncRunningSessionStartMock.mockReset();
  syncRunningSessionUpdateMock.mockReset();
  syncRunningSessionCancelMock.mockReset();
  deleteSessionRowMock.mockReset();
  vi
    .spyOn(googleSyncHooks, 'useGoogleSpreadsheetSync')
    .mockImplementation(() => ({
      state: {
        status: 'idle',
        lastSessionId: null,
        lastSyncedAt: null,
        error: null,
      },
      syncSession: syncSessionMock,
      syncRunningSessionStart: syncRunningSessionStartMock,
      syncRunningSessionUpdate: syncRunningSessionUpdateMock,
      syncRunningSessionCancel: syncRunningSessionCancelMock,
      deleteSessionRow: deleteSessionRowMock,
    }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TimeTrackerRoot', () => {
  it('入力内容があると開始ボタンが有効になる', () => {
    renderTimeTrackerPage();

    const actionButton = screen.getByRole('button', { name: '開始' });
    expect(actionButton).toBeDisabled();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    expect(actionButton).toBeEnabled();
  });

  it('Enter キーで計測が開始され UI が計測中状態になる', () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });

    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
    });

    expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument();
    expect(screen.getByText('計測中')).toBeInTheDocument();
  });

  it('IME 変換中の Enter では計測が開始されない', () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });

    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 229,
      isComposing: true,
    });

    expect(screen.getByRole('button', { name: '開始' })).toBeInTheDocument();
    expect(screen.queryByText('計測中')).not.toBeInTheDocument();
  });

  it('クイックナッジで作業時間を加算できる', () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    const nudgeGroup = screen.getByRole('group', { name: '作業時間の調整' });
    expect(nudgeGroup).toHaveAttribute('aria-describedby', 'time-tracker-running-timer');

    const timerElement = screen.getByText('00:00');
    expect(timerElement).toHaveAttribute('id', 'time-tracker-running-timer');

    fireEvent.click(screen.getByRole('button', { name: '経過時間を5分延長' }));

    expect(timerElement).toHaveTextContent('05:00');
  });

  it('クイックナッジで作業時間を減算できるが0未満にはならない', () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    fireEvent.click(screen.getByRole('button', { name: '経過時間を5分延長' }));
    fireEvent.click(screen.getByRole('button', { name: '経過時間を5分短縮' }));

    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('詳細編集で入力した内容が停止後の履歴に反映される', () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    fireEvent.click(screen.getByRole('button', { name: '詳細編集' }));

    fireEvent.change(screen.getByLabelText('タイトル'), {
      target: { value: 'ギター練習 - 集中' },
    });
    fireEvent.change(screen.getByLabelText('プロジェクト'), {
      target: { value: 'daily-practice' },
    });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    expect(screen.getByText('ギター練習 - 集中')).toBeInTheDocument();
    const history = screen.getByRole('region', { name: '最近の記録' });
    expect(within(history).getByText('#daily-practice')).toBeInTheDocument();
    expect(
      within(history).getByRole('button', { name: '「ギター練習 - 集中」を編集' }),
    ).toBeInTheDocument();
    expect(
      within(history).getByRole('button', { name: '「ギター練習 - 集中」を削除' }),
    ).toBeInTheDocument();
  });

  it('詳細編集モーダルを開くとタイトル入力にフォーカスする', async () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    const detailButton = screen.getByRole('button', { name: '詳細編集' });
    fireEvent.click(detailButton);

    const titleField = screen.getByLabelText('タイトル');
    await waitFor(() => {
      expect(titleField).toHaveFocus();
    });

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
  });

  it('破棄ボタンで計測中セッションを取り消し履歴に残さない', async () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: '集中作業' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    const cancelButton = screen.getByRole('button', { name: '破棄' });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    const startButton = await screen.findByRole('button', { name: '開始' });
    expect(startButton).toBeEnabled();
    expect(screen.queryByText('計測中')).not.toBeInTheDocument();

    const history = screen.queryByRole('region', { name: '最近の記録' });
    expect(history).toBeNull();

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY_RUNNING)).toBeNull();
    });
  });

  it('履歴編集の保存時にGoogle同期を再実行する', async () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    fireEvent.click(screen.getByRole('button', { name: '停止' }));
    await waitFor(() => expect(syncSessionMock).toHaveBeenCalled());
    syncSessionMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: '「ギター練習」を編集' }));

    const titleField = screen.getByLabelText('タイトル');
    fireEvent.change(titleField, { target: { value: 'ギター練習（編集）' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(syncSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'ギター練習（編集）' }),
      ),
    );
  });

  it('モーダルを閉じると開いた時にフォーカスしていた要素へ戻る', async () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    const detailButton = screen.getByRole('button', { name: '詳細編集' });
    detailButton.focus();
    fireEvent.click(detailButton);

    const titleField = screen.getByLabelText('タイトル');
    await waitFor(() => {
      expect(titleField).toHaveFocus();
    });

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '詳細編集' }),
      ).toBeInTheDocument();
    });
  });

  it('履歴モーダルでタイトルと時刻を再編集できる', () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));
    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    fireEvent.click(screen.getByRole('button', { name: '「ギター練習」を編集' }));

    fireEvent.change(screen.getByLabelText('タイトル'), {
      target: { value: '基礎トレーニング' },
    });
    fireEvent.change(screen.getByLabelText('プロジェクト'), {
      target: { value: 'updated-project' },
    });

    const startInput = screen.getByLabelText('開始時刻') as HTMLInputElement;
    const endInput = screen.getByLabelText('終了時刻') as HTMLInputElement;
    const currentStart = new Date(startInput.value);
    const adjustedStart = new Date(currentStart.getTime() - 5 * 60 * 1000);
    fireEvent.change(startInput, {
      target: { value: formatDateTimeLocal(adjustedStart) },
    });
    fireEvent.change(endInput, {
      target: { value: formatDateTimeLocal(new Date(endInput.value)) },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(screen.getByText('基礎トレーニング')).toBeInTheDocument();
    expect(screen.getByText('#updated-project')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
    const history = screen.getByRole('region', { name: '最近の記録' });
    expect(
      within(history).getByRole('button', { name: '「基礎トレーニング」を編集' }),
    ).toBeInTheDocument();
    expect(
      within(history).getByRole('button', { name: '「基礎トレーニング」を削除' }),
    ).toBeInTheDocument();
  });

  it('プロジェクトメニューで選択した値が開始時に適用される', () => {
    renderTimeTrackerPage();

    fireEvent.click(screen.getByRole('button', { name: 'プロジェクトを選択' }));
    const projectInput = screen.getByLabelText('プロジェクトを検索・設定');
    fireEvent.change(projectInput, { target: { value: 'daily-practice' } });
    fireEvent.click(screen.getByRole('button', { name: '＋ 「daily-practice」を作成' }));

    expect(screen.getByRole('button', { name: 'プロジェクト: daily-practice' })).toBeInTheDocument();

    const taskInput = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(taskInput, { target: { value: 'コード練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));
    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    const history = screen.getByRole('region', { name: '最近の記録' });
    expect(within(history).getByText('#daily-practice')).toBeInTheDocument();
  });

  it('プロジェクトメニューを閉じるとトリガーボタンへフォーカスが戻る', async () => {
    renderTimeTrackerPage();

    const trigger = screen.getByRole('button', { name: 'プロジェクトを選択' });
    fireEvent.click(trigger);

    const projectInput = screen.getByLabelText('プロジェクトを検索・設定');
    await waitFor(() => {
      expect(projectInput).toHaveFocus();
    });

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('プロジェクトメニュー内でTabキーがダイアログ内を循環する', async () => {
    renderTimeTrackerPage();

    fireEvent.click(screen.getByRole('button', { name: 'プロジェクトを選択' }));

    const projectInput = screen.getByLabelText('プロジェクトを検索・設定');
    await waitFor(() => {
      expect(projectInput).toHaveFocus();
    });

    const popover = screen.getByRole('dialog', { name: 'プロジェクトを選択' });
    const actionButton = screen.getByRole('button', { name: 'プロジェクトを未設定にする' });

    fireEvent.keyDown(popover, { key: 'Tab', shiftKey: true });
    await waitFor(() => {
      expect(actionButton).toHaveFocus();
    });

    fireEvent.keyDown(popover, { key: 'Tab' });
    await waitFor(() => {
      expect(projectInput).toHaveFocus();
    });

    fireEvent.mouseDown(document.body);
  });

  it('履歴の削除はUndoで元に戻せる', () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));
    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    expect(screen.getByText('ギター練習')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '「ギター練習」を削除' }));

    expect(screen.queryByText('ギター練習')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '元に戻す' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '元に戻す' }));

    expect(screen.getByText('ギター練習')).toBeInTheDocument();
  });

  it('履歴を削除するとGoogle Sheetsの行も削除される', async () => {
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));
    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    await waitFor(() => expect(syncSessionMock).toHaveBeenCalled());
    syncSessionMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: '「ギター練習」を削除' }));

    await waitFor(() => expect(deleteSessionRowMock).toHaveBeenCalledTimes(1));
  });

  it('履歴がlocalStorageへ保存される', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    renderTimeTrackerPage();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));
    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        STORAGE_KEY_SESSIONS,
        expect.stringContaining('ギター練習'),
      );
    });
  });

  it('localStorageの履歴を初期表示で読み込む', () => {
    const storedSession = {
      id: 'stored-1',
      title: '保存済みタスク',
      startedAt: Date.now() - 60_000,
      endedAt: Date.now(),
      durationSeconds: 60,
      project: 'archive',
    };
    window.localStorage.setItem(
      STORAGE_KEY_SESSIONS,
      JSON.stringify([storedSession]),
    );

    renderTimeTrackerPage();

    expect(screen.getByText('保存済みタスク')).toBeInTheDocument();
    expect(screen.getByText('#archive')).toBeInTheDocument();
  });

  it('localStorageのランニングセッションを復元する', () => {
    const startedAt = Date.now() - 120_000;
    window.localStorage.setItem(
      STORAGE_KEY_RUNNING,
      JSON.stringify({
        status: 'running',
        draft: {
          title: '継続中の作業',
          startedAt,
        },
      }),
    );

    renderTimeTrackerPage();

    expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('継続中の作業')).toBeInTheDocument();
  });
});
