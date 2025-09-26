import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { TimeTrackerRoot } from './TimeTrackerRoot';

const STORAGE_KEY_SESSIONS = 'codex-time-tracker/sessions';
const STORAGE_KEY_RUNNING = 'codex-time-tracker/running';

const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TimeTrackerRoot', () => {
  it('入力内容があると開始ボタンが有効になる', () => {
    render(<TimeTrackerRoot />);

    const actionButton = screen.getByRole('button', { name: '開始' });
    expect(actionButton).toBeDisabled();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    expect(actionButton).toBeEnabled();
  });

  it('Enter キーで計測が開始され UI が計測中状態になる', () => {
    render(<TimeTrackerRoot />);

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
    render(<TimeTrackerRoot />);

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
    render(<TimeTrackerRoot />);

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    fireEvent.click(screen.getByRole('button', { name: '+5分' }));

    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('クイックナッジで作業時間を減算できるが0未満にはならない', () => {
    render(<TimeTrackerRoot />);

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    fireEvent.click(screen.getByRole('button', { name: '+5分' }));
    fireEvent.click(screen.getByRole('button', { name: '-5分' }));

    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('詳細編集で入力した内容が停止後の履歴に反映される', () => {
    render(<TimeTrackerRoot />);

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
    expect(screen.getByText('#daily-practice')).toBeInTheDocument();
  });

  it('履歴モーダルでタイトルと時刻を再編集できる', () => {
    render(<TimeTrackerRoot />);

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));
    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    fireEvent.click(screen.getByRole('button', { name: '編集' }));

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
  });

  it('履歴の削除はUndoで元に戻せる', () => {
    render(<TimeTrackerRoot />);

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));
    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    expect(screen.getByText('ギター練習')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    expect(screen.queryByText('ギター練習')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '元に戻す' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '元に戻す' }));

    expect(screen.getByText('ギター練習')).toBeInTheDocument();
  });

  it('履歴がlocalStorageへ保存される', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<TimeTrackerRoot />);

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

    render(<TimeTrackerRoot />);

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

    render(<TimeTrackerRoot />);

    expect(screen.getByRole('button', { name: '停止' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('継続中の作業')).toBeInTheDocument();
  });
});
