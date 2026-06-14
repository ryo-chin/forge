export type GoogleSyncStatus = 'active' | 'revoked' | 'error';

export type SyncSessionPayload = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  project?: string | null;
  notes?: string | null;
  tags?: string[];
  skill?: string | null;
  intensity?: string | null;
};

export type SyncRequestBody = {
  session: SyncSessionPayload;
  source?: string;
};

export type SyncLogPayload = {
  id: string;
  sessionId: string;
  status: 'pending' | 'success' | 'failed';
  attemptedAt: string;
  failureReason?: string | null;
  retryCount: number;
};

export type SpreadsheetSummary = {
  id: string;
  name: string;
  url: string;
};

export type SheetSummary = {
  id: number;
  title: string;
  index: number;
};

export type ColumnMapping = {
  id?: string;
  status?: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: string;
  project?: string;
  notes?: string;
  tags?: string;
  skill?: string;
  intensity?: string;
};

export type RunningSessionDraftPayload = {
  id: string;
  title: string;
  startedAt: string;
  project?: string | null;
  tags?: string[];
  skill?: string | null;
  intensity?: string | null;
  notes?: string | null;
};

export type RunningSessionStartRequest = {
  draft: RunningSessionDraftPayload;
};

export type RunningSessionUpdateRequest = {
  draft: RunningSessionDraftPayload;
  elapsedSeconds: number;
};

export type RunningSessionCancelRequest = {
  id?: string;
};

export type RunningSessionStatePayload =
  | {
      status: 'idle';
      draft: null;
      elapsedSeconds: 0;
    }
  | {
      status: 'running';
      draft: RunningSessionDraftPayload;
      elapsedSeconds: number;
    };

export type RunningSessionStopRequest = {
  id?: string;
  stoppedAt?: string | number;
  title?: string;
  project?: string | null;
  notes?: string | null;
  tags?: string[];
  skill?: string | null;
  intensity?: string | null;
};

export type TimeTrackerSessionListRequest = {
  limit?: number;
  from?: string | number;
  to?: string | number;
  query?: string;
  project?: string;
  tags?: string[];
};

export type TimeTrackerSessionRecordRequest = {
  id?: string;
  title: string;
  startedAt: string | number;
  endedAt: string | number;
  project?: string | null;
  notes?: string | null;
  tags?: string[];
  skill?: string | null;
  intensity?: string | null;
  dryRun?: boolean;
};

export type TimeTrackerSessionPayload = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  project?: string | null;
  notes?: string | null;
  tags?: string[];
  skill?: string | null;
  intensity?: string | null;
};

// ===== 予実管理（タグ単位・曜日別予算） =====
export type BudgetPayload = {
  id: string;
  tag: string;
  label?: string | null;
  /** 長さ7・index 0=日曜の1日あたり予算「分」 */
  weekdayMinutes: number[];
  effectiveFrom: string; // 'YYYY-MM-DD'
  effectiveTo?: string | null;
};

export type BudgetUpsertRequest = {
  id?: string;
  tag: string;
  label?: string | null;
  weekdayMinutes: number[];
  effectiveFrom: string;
  effectiveTo?: string | null;
};

// ===== デイリーカスタム記録 =====
export type MetricKind = 'boolean' | 'number' | 'text' | 'single_select' | 'multi_select';

export type MetricOptionPayload = { value: string; label: string };

export type MetricDefinitionPayload = {
  id: string;
  name: string;
  kind: MetricKind;
  unit?: string | null;
  options?: MetricOptionPayload[] | null;
  targetNumber?: number | null;
  displayOrder: number;
  archivedAt?: string | null;
};

export type MetricDefinitionUpsertRequest = {
  id?: string;
  name: string;
  kind: MetricKind;
  unit?: string | null;
  options?: MetricOptionPayload[] | null;
  targetNumber?: number | null;
  displayOrder?: number;
};

export type MetricValuePayload = boolean | number | string | string[];

export type MetricEntryPayload = {
  id: string;
  metricId: string;
  entryDate: string; // 'YYYY-MM-DD'
  value: MetricValuePayload;
};

export type MetricEntryUpsertRequest = {
  metricId?: string;
  metricName?: string;
  entryDate: string;
  value: MetricValuePayload;
};

export type ColumnMappingConfig = {
  mappings: ColumnMapping;
  requiredColumns: string[];
  optionalColumns: string[];
};

export type GoogleSyncSettings = {
  connectionStatus: GoogleSyncStatus;
  spreadsheet?: {
    id: string;
    name?: string;
    url?: string;
    sheetId: number;
    sheetTitle: string;
  };
  columnMapping?: ColumnMappingConfig;
  updatedAt?: string;
};
