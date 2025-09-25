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
});
