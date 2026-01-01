export type GoogleSyncStatus = 'active' | 'revoked' | 'error';

export type GoogleSyncSessionPayload = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  project?: string | null;
  theme?: string | null;
  notes?: string | null;
  tags?: string[];
  skill?: string | null;
  intensity?: string | null;
};

export type GoogleSyncRequestBody = {
  session: GoogleSyncSessionPayload;
  source?: string;
};

export type GoogleSyncLog = {
  id: string;
  sessionId: string;
  status: 'pending' | 'success' | 'failed';
  attemptedAt: string;
  failureReason?: string | null;
  retryCount: number;
};

export type SpreadsheetOption = {
  id: string;
  name: string;
  url: string;
};

export type SheetOption = {
  sheetId: number;
  title: string;
  index: number;
};

export type ColumnMappingConfig = {
  mappings: {
    id?: string;      // 【追加】セッションID列
    status?: string;  // 【追加】ステータス列（"Running" | "Completed"）
    title: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: string;
    project?: string;
    theme?: string;
    notes?: string;
    tags?: string;
    skill?: string;
    intensity?: string;
  };
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
