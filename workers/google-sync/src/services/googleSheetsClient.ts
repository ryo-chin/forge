const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

export type AppendRowOptions = {
  valueInputOption?: 'RAW' | 'USER_ENTERED';
  insertDataOption?: 'OVERWRITE' | 'INSERT_ROWS';
};

export type SpreadsheetSummary = {
  id: string;
  name: string;
  url: string;
};

export type SheetSummary = {
  sheetId: number;
  title: string;
  index: number;
};

export type AppendRowResponse = {
  spreadsheetId: string;
  tableRange?: string;
  updates?: {
    updatedRange?: string;
    updatedRows?: number;
    updatedColumns?: number;
    updatedCells?: number;
  };
};

export class GoogleSheetsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GoogleSheetsApiError';
    this.status = status;
  }
}

export class GoogleSheetsClient {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  static fromAccessToken(accessToken: string) {
    return new GoogleSheetsClient(accessToken);
  }

  private async request<T>(
    input: string | URL,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(input, { ...init, headers });
    if (!response.ok) {
      let detail: unknown;
      try {
        detail = await response.json();
      } catch {
        detail = await response.text();
      }
      throw new GoogleSheetsApiError(
        `Google API request failed (${response.status}) ${JSON.stringify(
          detail,
        )}`,
        response.status,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }
    if (
      response.headers.get('content-type')?.includes('application/json') ?? false
    ) {
      return (await response.json()) as T;
    }
    const text = await response.text();
    return text as unknown as T;
  }

  async appendRow(
    spreadsheetId: string,
    sheetTitle: string,
    values: (string | number | null)[],
    options: AppendRowOptions = {},
  ): Promise<AppendRowResponse> {
    const range = encodeURIComponent(`${sheetTitle}!A1`);
    const url = new URL(
      `${spreadsheetId}/values/${range}:append`,
      `${SHEETS_BASE_URL}/`,
    );
    url.searchParams.set(
      'valueInputOption',
      options.valueInputOption ?? 'USER_ENTERED',
    );
    url.searchParams.set(
      'insertDataOption',
      options.insertDataOption ?? 'INSERT_ROWS',
    );

    return this.request<AppendRowResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        values: [values],
      }),
    });
  }

  async getRange(
    spreadsheetId: string,
    range: string,
  ): Promise<{ values?: (string | number)[][] }> {
    const encodedRange = encodeURIComponent(range);
    const url = new URL(
      `${spreadsheetId}/values/${encodedRange}`,
      `${SHEETS_BASE_URL}/`,
    );

    return this.request<{ values?: (string | number)[][] }>(url);
  }

  async getSpreadsheetSheets(spreadsheetId: string): Promise<SheetSummary[]> {
    const url = new URL(`${spreadsheetId}`, `${SHEETS_BASE_URL}/`);
    url.searchParams.set(
      'fields',
      'spreadsheetId,properties/title,sheets(properties(sheetId,title,index))',
    );

    type ResponsePayload = {
      sheets?: Array<{
        properties?: {
          sheetId?: number;
          title?: string;
          index?: number;
        };
      }>;
    };

    const payload = await this.request<ResponsePayload>(url);
    return (payload.sheets ?? [])
      .map((sheet) => sheet.properties)
      .filter(
        (props): props is Required<SheetSummary> =>
          !!props &&
          typeof props.sheetId === 'number' &&
          typeof props.title === 'string' &&
          typeof props.index === 'number',
      )
      .map((props) => ({
        sheetId: props.sheetId,
        title: props.title,
        index: props.index,
      }));
  }

  async listSpreadsheets(
    query: string | undefined = undefined,
    pageToken: string | undefined = undefined,
  ): Promise<{ items: SpreadsheetSummary[]; nextPageToken?: string }> {
    const url = new URL(DRIVE_FILES_URL);
    const conditions = [
      "mimeType='application/vnd.google-apps.spreadsheet'",
      'trashed=false',
    ];
    if (query) {
      const sanitized = query.replace(/['"]/g, '').trim();
      if (sanitized.length > 0) {
        conditions.push(`name contains '${sanitized}'`);
      }
    }
    url.searchParams.set('q', conditions.join(' and '));
    url.searchParams.set('fields', 'files(id,name,webViewLink),nextPageToken');
    url.searchParams.set('pageSize', '50');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    type ResponsePayload = {
      files?: Array<{
        id?: string;
        name?: string;
        webViewLink?: string;
      }>;
      nextPageToken?: string;
    };

    const payload = await this.request<ResponsePayload>(url);
    const items: SpreadsheetSummary[] =
      payload.files?.reduce<SpreadsheetSummary[]>((acc, file) => {
        if (file.id && file.name) {
          acc.push({
            id: file.id,
            name: file.name,
            url: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}`,
          });
        }
        return acc;
      }, []) ?? [];

    return {
      items,
      nextPageToken: payload.nextPageToken,
    };
  }
}
