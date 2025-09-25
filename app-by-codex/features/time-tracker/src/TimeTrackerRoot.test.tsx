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
});
