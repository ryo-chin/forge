import { ColumnMappingForm } from '@features/time-tracker/components/ColumnMappingForm';
import type {
  SheetOption,
  SpreadsheetOption,
} from '@features/time-tracker/domain/googleSyncTypes.ts';
import { GoogleSyncClientError } from '@infra/repository/GoogleSheets';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import './GoogleSpreadsheetSettingsSection.css';

type ColumnMapping = {
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

type SavePayload = {
  spreadsheetId: string;
  sheetId: number;
  sheetTitle: string;
  columnMapping?: ColumnMapping;
};

type FetchSpreadsheetsResult = { items: SpreadsheetOption[] };
type FetchSheetsResult = { items: SheetOption[] };

export type GoogleSpreadsheetSettingsSectionProps = {
  isConnected: boolean;
  currentSpreadsheetId?: string;
  currentSheetId?: number;
  currentColumnMapping?: ColumnMapping;
  onSave: (selection: SavePayload) => void | Promise<void>;
  onStartOAuth: () => void;
  onFetchSpreadsheets: (query?: string) => Promise<FetchSpreadsheetsResult>;
  onFetchSheets: (spreadsheetId: string) => Promise<FetchSheetsResult>;
  isSaving?: boolean;
};

const REAUTH_MESSAGE =
  'Google アカウントとの連携が期限切れになりました。再度連携を行ってください。';

export const GoogleSpreadsheetSettingsSection: React.FC<GoogleSpreadsheetSettingsSectionProps> = ({
  isConnected,
  currentSpreadsheetId,
  currentSheetId,
  currentColumnMapping,
  onSave,
  onStartOAuth,
  onFetchSpreadsheets,
  onFetchSheets,
  isSaving = false,
}) => {
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetOption[]>([]);
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string | undefined>(
    currentSpreadsheetId,
  );
  const [selectedSheetId, setSelectedSheetId] = useState<number | undefined>(currentSheetId);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | undefined>(
    currentColumnMapping,
  );
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [reconnectMessage, setReconnectMessage] = useState<string | null>(null);

  const handleAuthError = useCallback((error: unknown): boolean => {
    if (error instanceof GoogleSyncClientError && error.status === 401) {
      setNeedsReconnect(true);
      setReconnectMessage(REAUTH_MESSAGE);
      setSpreadsheets([]);
      setSheets([]);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    setSelectedSpreadsheetId(currentSpreadsheetId);
    setSelectedSheetId(currentSheetId);
    setColumnMapping(currentColumnMapping);
  }, [currentColumnMapping, currentSheetId, currentSpreadsheetId]);

  useEffect(() => {
    if (!isConnected || needsReconnect) {
      setSpreadsheets([]);
      return;
    }

    let isMounted = true;

    const loadSpreadsheets = async () => {
      setIsLoadingSpreadsheets(true);
      try {
        const result = await onFetchSpreadsheets();
        if (isMounted) {
          setSpreadsheets(result.items);
        }
      } catch (error) {
        const handled = handleAuthError(error);
        if (!handled && import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.error('Failed to load spreadsheets:', error);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSpreadsheets(false);
        }
      }
    };

    void loadSpreadsheets();

    return () => {
      isMounted = false;
    };
  }, [handleAuthError, isConnected, needsReconnect, onFetchSpreadsheets]);

  useEffect(() => {
    if (!selectedSpreadsheetId || needsReconnect) {
      setSheets([]);
      return;
    }

    let isMounted = true;

    const loadSheets = async () => {
      setIsLoadingSheets(true);
      try {
        const result = await onFetchSheets(selectedSpreadsheetId);
        if (isMounted) {
          setSheets(result.items);
        }
      } catch (error) {
        const handled = handleAuthError(error);
        if (!handled && import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.error('Failed to load sheets:', error);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSheets(false);
        }
      }
    };

    void loadSheets();

    return () => {
      isMounted = false;
    };
  }, [handleAuthError, needsReconnect, onFetchSheets, selectedSpreadsheetId]);

  useEffect(() => {
    if (!isConnected) {
      setNeedsReconnect(false);
      setReconnectMessage(null);
      setSpreadsheets([]);
      setSheets([]);
    }
  }, [isConnected]);

  const handleSpreadsheetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedSpreadsheetId(value || undefined);
    setSelectedSheetId(undefined);
  };

  const handleSheetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === '') {
      setSelectedSheetId(undefined);
    } else {
      const numValue = Number(value);
      setSelectedSheetId(Number.isNaN(numValue) ? undefined : numValue);
    }
  };

  const handleSave = () => {
    if (!selectedSpreadsheetId || selectedSheetId === undefined) {
      return;
    }

    const selectedSheet = sheets.find((sheet) => sheet.sheetId === selectedSheetId);
    if (!selectedSheet) {
      return;
    }

    onSave({
      spreadsheetId: selectedSpreadsheetId,
      sheetId: selectedSheetId,
      sheetTitle: selectedSheet.title,
      columnMapping,
    });
  };

  const saveDisabled = !selectedSpreadsheetId || selectedSheetId === undefined || isSaving;

  const showReconnectPrompt = needsReconnect || !isConnected;
  const oauthButtonLabel = needsReconnect ? 'Google アカウントを再連携' : 'Google アカウントと連携';
  const promptMessage = needsReconnect
    ? (reconnectMessage ?? REAUTH_MESSAGE)
    : 'Google アカウントと連携して、スプレッドシートへの同期を有効にします。';

  return (
    <section className="settings-section" aria-labelledby="google-settings-title">
      <header className="settings-section__header">
        <div>
          <h2 id="google-settings-title" className="settings-section__title">
            Google スプレッドシート連携
          </h2>
          <p className="settings-section__description">
            連携先のスプレッドシートとシートを選択し、列の対応関係を設定します。
          </p>
        </div>
        <div className="settings-section__status" aria-live="polite">
          {isConnected ? '連携中' : '未連携'}
        </div>
      </header>

      {showReconnectPrompt ? (
        <div className="settings-section__body">
          <p>{promptMessage}</p>
          <div className="settings-section__actions">
            <button
              type="button"
              onClick={onStartOAuth}
              className="settings-section__primary-button"
            >
              {oauthButtonLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="settings-section__body">
          <div className="time-tracker__field">
            <label htmlFor="settings-spreadsheet-select">スプレッドシート</label>
            <select
              id="settings-spreadsheet-select"
              value={selectedSpreadsheetId ?? ''}
              onChange={handleSpreadsheetChange}
              disabled={isLoadingSpreadsheets}
            >
              <option value="">選択してください</option>
              {spreadsheets.map((spreadsheet) => (
                <option key={spreadsheet.id} value={spreadsheet.id}>
                  {spreadsheet.name}
                </option>
              ))}
            </select>
            {isLoadingSpreadsheets ? (
              <p className="settings-section__hint">スプレッドシートを読み込んでいます...</p>
            ) : null}
          </div>

          <div className="time-tracker__field">
            <label htmlFor="settings-sheet-select">シート</label>
            <select
              id="settings-sheet-select"
              value={selectedSheetId !== undefined ? String(selectedSheetId) : ''}
              onChange={handleSheetChange}
              disabled={!selectedSpreadsheetId || isLoadingSheets}
            >
              <option value="">選択してください</option>
              {sheets.map((sheet) => (
                <option key={`${sheet.sheetId}-${sheet.index}`} value={sheet.sheetId}>
                  {sheet.title}
                </option>
              ))}
            </select>
            {isLoadingSheets ? (
              <p className="settings-section__hint">シートを読み込んでいます...</p>
            ) : null}
          </div>

          {selectedSpreadsheetId && selectedSheetId !== undefined ? (
            <ColumnMappingForm currentMapping={columnMapping} onChange={setColumnMapping} />
          ) : null}

          <div className="settings-section__actions">
            <button
              type="button"
              className="settings-section__primary-button"
              onClick={handleSave}
              disabled={saveDisabled}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
