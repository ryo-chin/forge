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
