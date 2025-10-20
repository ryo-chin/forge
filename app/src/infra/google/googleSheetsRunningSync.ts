import type { SessionDraft, TimeTrackerSession } from '../../features/time-tracker/domain/types';

/**
 * Google Sheets Running Session同期
 *
 * このモジュールは、Google Sheets APIを直接呼び出してRunning状態のセッションを同期します。
 * 既存のバックエンドAPI経由の同期とは独立して動作します。
 */

// Google Sheets API (gapi) の型定義
declare const gapi: {
  client: {
    sheets: {
      spreadsheets: {
        values: {
          append: (params: {
            spreadsheetId: string;
            range: string;
            valueInputOption: string;
            resource: { values: unknown[][] };
          }) => Promise<{ result: { updates: { updatedRows: number } } }>;
          get: (params: {
            spreadsheetId: string;
            range: string;
          }) => Promise<{ result: { values?: unknown[][] } }>;
          batchUpdate: (params: {
            spreadsheetId: string;
            resource: {
              data: { range: string; values: unknown[][] }[];
              valueInputOption: string;
            };
          }) => Promise<{ result: { replies: unknown[] } }>;
        };
      };
    };
  };
};

export type GoogleSheetsOptions = {
  spreadsheetId: string;
  sheetName: string;
  mappings: {
    id?: string;
    status?: string;
    title: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: string;
    project?: string;
    tags?: string;
    skill?: string;
    intensity?: string;
    notes?: string;
  };
};

/**
 * Running中のセッションを新しい行として追加
 */
export const appendRunningSession = async (
  draft: SessionDraft,
  options: GoogleSheetsOptions,
): Promise<void> => {
  if (!draft.id) {
    throw new Error('id is required for running session');
  }

  const { spreadsheetId, sheetName } = options;

  // 列の順序を構築（実際の列マッピングに基づく）
  const values = [
    [
      draft.id, // id
      'Running', // status
      draft.title, // title
      new Date(draft.startedAt).toISOString(), // startedAt
      '', // endedAt (空)
      '', // durationSeconds (空)
      draft.project || '', // project
      Array.isArray(draft.tags) ? draft.tags.join(',') : '', // tags
      draft.skill || '', // skill
      draft.intensity || '', // intensity
      draft.notes || '', // notes
    ],
  ];

  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:K`, // 全列を対象
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
};

/**
 * Running中のセッションを更新
 */
export const updateRunningSession = async (
  draft: SessionDraft,
  options: GoogleSheetsOptions,
): Promise<void> => {
  if (!draft.id) {
    throw new Error('id is required for running session');
  }

  const { spreadsheetId, sheetName, mappings } = options;

  // id列でセッションを検索
  const idColumn = mappings.id || 'A';
  const searchResult = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${idColumn}:${idColumn}`,
  });

  const values = searchResult.result.values || [];
  const rowIndex = values.findIndex((row: unknown[]) => row[0] === draft.id);

  if (rowIndex === -1) {
    console.warn('[Google Sheets] Running session not found:', draft.id);
    return;
  }

  // 行番号（1-indexed）
  const rowNumber = rowIndex + 1;

  // 経過時間を計算
  const elapsedSeconds = Math.floor((Date.now() - draft.startedAt) / 1000);

  // 更新するフィールド
  const updates = [
    {
      range: `${sheetName}!${mappings.title}${rowNumber}`,
      values: [[draft.title]],
    },
    {
      range: `${sheetName}!${mappings.project || 'G'}${rowNumber}`,
      values: [[draft.project || '']],
    },
    {
      range: `${sheetName}!${mappings.tags || 'H'}${rowNumber}`,
      values: [[Array.isArray(draft.tags) ? draft.tags.join(',') : '']],
    },
    {
      range: `${sheetName}!${mappings.skill || 'I'}${rowNumber}`,
      values: [[draft.skill || '']],
    },
    {
      range: `${sheetName}!${mappings.intensity || 'J'}${rowNumber}`,
      values: [[draft.intensity || '']],
    },
    {
      range: `${sheetName}!${mappings.notes || 'K'}${rowNumber}`,
      values: [[draft.notes || '']],
    },
    {
      range: `${sheetName}!${mappings.durationSeconds}${rowNumber}`,
      values: [[elapsedSeconds]],
    },
  ];

  await gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: {
      data: updates,
      valueInputOption: 'USER_ENTERED',
    },
  });
};

/**
 * Running中のセッションを完了状態に変更
 */
export const completeRunningSession = async (
  session: TimeTrackerSession,
  options: GoogleSheetsOptions,
): Promise<void> => {
  if (!session.id) {
    throw new Error('id is required for session');
  }

  const { spreadsheetId, sheetName, mappings } = options;

  // id列でセッションを検索
  const idColumn = mappings.id || 'A';
  const searchResult = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${idColumn}:${idColumn}`,
  });

  const values = searchResult.result.values || [];
  const rowIndex = values.findIndex((row: unknown[]) => row[0] === session.id);

  if (rowIndex === -1) {
    console.warn('[Google Sheets] Running session not found:', session.id);
    return;
  }

  // 行番号（1-indexed）
  const rowNumber = rowIndex + 1;

  // 更新するフィールド
  const updates = [
    {
      range: `${sheetName}!${mappings.status || 'B'}${rowNumber}`,
      values: [['Completed']],
    },
    {
      range: `${sheetName}!${mappings.endedAt}${rowNumber}`,
      values: [[new Date(session.endedAt).toISOString()]],
    },
    {
      range: `${sheetName}!${mappings.durationSeconds}${rowNumber}`,
      values: [[session.durationSeconds]],
    },
    {
      range: `${sheetName}!${mappings.title}${rowNumber}`,
      values: [[session.title]],
    },
    {
      range: `${sheetName}!${mappings.project || 'G'}${rowNumber}`,
      values: [[session.project || '']],
    },
    {
      range: `${sheetName}!${mappings.tags || 'H'}${rowNumber}`,
      values: [[Array.isArray(session.tags) ? session.tags.join(',') : '']],
    },
  ];

  await gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: {
      data: updates,
      valueInputOption: 'USER_ENTERED',
    },
  });
};
