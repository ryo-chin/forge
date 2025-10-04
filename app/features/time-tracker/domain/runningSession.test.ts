import {
  createSessionFromDraft,
  initialRunningSessionState,
  runningSessionReducer,
} from './runningSession.ts';

const START_TIME = 1_700_000_000_000;

describe('runningSessionReducer', () => {
  it('START アクションでランニング状態になる', () => {
    const state = runningSessionReducer(initialRunningSessionState, {
      type: 'START',
      payload: { title: 'ギター練習', startedAt: START_TIME },
    });

    if (state.status !== 'running') {
      throw new Error('ランニング状態になっていません');
    }

    expect(state.status).toBe('running');
    expect(state.draft.title).toBe('ギター練習');
    expect(state.draft.startedAt).toBe(START_TIME);
    expect(state.elapsedSeconds).toBe(0);
  });

  it('TICK アクションで経過秒が更新される', () => {
    const runningState = runningSessionReducer(initialRunningSessionState, {
      type: 'START',
      payload: { title: 'ギター練習', startedAt: START_TIME },
    });

    if (runningState.status !== 'running') {
      throw new Error('ランニング状態になっていません');
    }

    const nextState = runningSessionReducer(runningState, {
      type: 'TICK',
      payload: { now: START_TIME + 6_500 },
    });

    expect(nextState.elapsedSeconds).toBe(6);
  });

  it('RESET で初期状態に戻る', () => {
    const runningState = runningSessionReducer(initialRunningSessionState, {
      type: 'START',
      payload: { title: 'ギター練習', startedAt: START_TIME },
    });

    const resetState = runningSessionReducer(runningState, { type: 'RESET' });
    expect(resetState).toEqual(initialRunningSessionState);
  });

  it('ADJUST_DURATION で作業時間を加算できる', () => {
    const runningState = runningSessionReducer(initialRunningSessionState, {
      type: 'START',
      payload: { title: 'ギター練習', startedAt: START_TIME },
    });

    const adjustedState = runningSessionReducer(runningState, {
      type: 'ADJUST_DURATION',
      payload: { deltaSeconds: 5 * 60, now: START_TIME + 60_000 },
    });

    if (adjustedState.status !== 'running') {
      throw new Error('ランニング状態になりませんでした');
    }

    expect(adjustedState.elapsedSeconds).toBe(6 * 60);
    expect(adjustedState.draft.startedAt).toBe(START_TIME - 5 * 60 * 1000);
  });

  it('ADJUST_DURATION は連続加算に追従する', () => {
    const runningState = runningSessionReducer(initialRunningSessionState, {
      type: 'START',
      payload: { title: 'ギター練習', startedAt: START_TIME },
    });

    const afterFirstAdjust = runningSessionReducer(runningState, {
      type: 'ADJUST_DURATION',
      payload: { deltaSeconds: 5 * 60, now: START_TIME + 60_000 },
    });

    if (afterFirstAdjust.status !== 'running') {
      throw new Error('ランニング状態になりませんでした');
    }

    const afterSecondAdjust = runningSessionReducer(afterFirstAdjust, {
      type: 'ADJUST_DURATION',
      payload: { deltaSeconds: 5 * 60, now: START_TIME + 180_000 },
    });

    if (afterSecondAdjust.status !== 'running') {
      throw new Error('ランニング状態になりませんでした');
    }

    expect(afterSecondAdjust.elapsedSeconds).toBe(13 * 60);
    expect(afterSecondAdjust.draft.startedAt).toBe(START_TIME - 10 * 60 * 1000);
  });

  it('ADJUST_DURATION で作業時間を減算できるが0未満にはならない', () => {
    const runningState = runningSessionReducer(initialRunningSessionState, {
      type: 'START',
      payload: { title: 'ギター練習', startedAt: START_TIME },
    });

    const afterIncrease = runningSessionReducer(runningState, {
      type: 'ADJUST_DURATION',
      payload: { deltaSeconds: 5 * 60, now: START_TIME + 60_000 },
    });

    if (afterIncrease.status !== 'running') {
      throw new Error('ランニング状態になりませんでした');
    }

    const afterDecrease = runningSessionReducer(afterIncrease, {
      type: 'ADJUST_DURATION',
      payload: { deltaSeconds: -10 * 60, now: START_TIME + 180_000 },
    });

    if (afterDecrease.status !== 'running') {
      throw new Error('ランニング状態になりませんでした');
    }

    expect(afterDecrease.elapsedSeconds).toBe(0);
    expect(afterDecrease.draft.startedAt).toBe(START_TIME + 180_000);
  });
});

describe('createSessionFromDraft', () => {
  it('最低1秒の継続時間でセッションを生成する', () => {
    const draft = {
      title: 'ギター練習',
      startedAt: START_TIME,
      tags: ['music'],
      project: 'daily-practice',
      intensity: 'medium' as const,
    };

    const session = createSessionFromDraft(draft, START_TIME + 500);

    expect(session.durationSeconds).toBe(1);
    expect(session.tags).toEqual(['music']);
    expect(session.project).toBe('daily-practice');
    expect(session.intensity).toBe('medium');
  });
});
