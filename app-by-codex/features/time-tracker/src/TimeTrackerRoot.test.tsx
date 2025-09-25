import { fireEvent, render, screen } from '@testing-library/react';
import { TimeTrackerRoot } from './TimeTrackerRoot';

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

  it('詳細編集で入力した内容が停止後の履歴に反映される', () => {
    render(<TimeTrackerRoot />);

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    fireEvent.click(screen.getByRole('button', { name: '開始' }));

    const toggleButton = screen.getByRole('button', { name: '＋ 詳細編集' });
    fireEvent.click(toggleButton);

    fireEvent.change(screen.getByLabelText('タイトル'), {
      target: { value: 'ギター練習 - 集中' },
    });
    fireEvent.change(screen.getByLabelText('タグ (カンマ区切り)'), {
      target: { value: 'guitar, scales' },
    });
    fireEvent.change(screen.getByLabelText('プロジェクト'), {
      target: { value: 'daily-practice' },
    });
    fireEvent.change(screen.getByLabelText('メモ'), {
      target: { value: 'スケールを重点的に練習' },
    });

    fireEvent.click(screen.getByRole('button', { name: '停止' }));

    expect(screen.getByText('ギター練習 - 集中')).toBeInTheDocument();
    expect(screen.getByText('#daily-practice')).toBeInTheDocument();
    expect(screen.getByText('#guitar #scales')).toBeInTheDocument();
  });
});
