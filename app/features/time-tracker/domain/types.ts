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
