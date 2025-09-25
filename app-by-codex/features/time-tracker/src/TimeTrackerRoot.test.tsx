import { fireEvent, render, screen } from '@testing-library/react';
import { TimeTrackerRoot } from './TimeTrackerRoot';

describe('TimeTracker App', () => {
  it('タイマー開始前はボタンの活性状態が入力内容に連動する', async () => {
    render(<TimeTrackerRoot />);

    const startButton = screen.getByRole('button', { name: 'スタート' });
    expect(startButton).toBeDisabled();

    const input = screen.getByPlaceholderText('何をやる？');
    fireEvent.change(input, { target: { value: 'ギター練習' } });
    expect(startButton).toBeEnabled();
  });
});
