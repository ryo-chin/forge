import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TimeTrackerSession } from '../../domain/types.ts';
import { HistoryList } from './HistoryList.tsx';

const buildSession = (): TimeTrackerSession => ({
  id: 'session-1',
  title: 'Forge work-time tracking setup',
  project: 'yamamoto-ai-workspace',
  tags: ['work-time-infer', 'backfill', 'codex', 'claude-code', 'latest-start-to-now'],
  startedAt: new Date(2026, 4, 9, 0, 17).getTime(),
  endedAt: new Date(2026, 4, 9, 0, 47).getTime(),
  durationSeconds: 1832,
});

describe('HistoryList', () => {
  it('タグを個別の折り返し可能な項目として表示する', () => {
    render(
      <HistoryList
        sessions={[buildSession()]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestart={vi.fn()}
        onAddManual={vi.fn()}
        isRunning={false}
      />,
    );

    expect(screen.getByText('#yamamoto-ai-workspace')).toHaveClass(
      'time-tracker__history-meta-item',
    );
    expect(screen.getByText('#latest-start-to-now')).toHaveClass('time-tracker__history-meta-item');
    expect(screen.queryByText(/#work-time-infer #backfill/)).not.toBeInTheDocument();
  });

  it('タグごとの検索は維持する', () => {
    render(
      <HistoryList
        sessions={[buildSession()]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestart={vi.fn()}
        onAddManual={vi.fn()}
        isRunning={false}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: '最近の記録を検索' }), {
      target: { value: '#claude-code #latest-start-to-now' },
    });

    expect(screen.getByText('Forge work-time tracking setup')).toBeInTheDocument();
  });
});
