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
