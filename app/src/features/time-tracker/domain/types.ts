export type TimeTrackerSession = {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  tags?: string[];
  skill?: string;
  project?: string;
  intensity?: 'low' | 'medium' | 'high';
  notes?: string;
};

export type SessionDraft = {
  id: string;       // 【追加】セッションの一意識別子（UUID、開始時に生成）
  title: string;
  startedAt: number;
  tags?: string[];
  skill?: string;
  project?: string;
  intensity?: 'low' | 'medium' | 'high';
  notes?: string;
};

export type RunningSessionState =
  | {
      status: 'idle';
      draft: null;
      elapsedSeconds: 0;
    }
  | {
      status: 'running';
      draft: SessionDraft;
      elapsedSeconds: number;
    };
