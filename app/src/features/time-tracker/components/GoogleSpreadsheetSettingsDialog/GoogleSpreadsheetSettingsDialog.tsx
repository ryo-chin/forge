import React, { useEffect, useRef, useState } from 'react';
import { focusModalOnOpen, attachEscapeClose } from '../EditorModal/logic.ts';
import { trapTabFocus } from '../../../../lib/accessibility/focus.ts';
import { ColumnMappingForm } from '../ColumnMappingForm';
import type {
  SpreadsheetOption,
  SheetOption,
} from '../../domain/googleSyncTypes.ts';

export type GoogleSpreadsheetSettingsDialogProps = {
  isOpen: boolean;
  isConnected: boolean;
  currentSpreadsheetId?: string;
  currentSheetId?: number;
  currentColumnMapping?: {
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
  onClose: () => void;
  onSave: (selection: {
    spreadsheetId: string;
    sheetId: number;
    sheetTitle: string;
    columnMapping?: {
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
  }) => void;
  onStartOAuth: () => void;
  onFetchSpreadsheets: (query?: string) => Promise<{ items: SpreadsheetOption[] }>;
  onFetchSheets: (spreadsheetId: string) => Promise<{ items: SheetOption[] }>;
};

export const GoogleSpreadsheetSettingsDialog: React.FC<
  GoogleSpreadsheetSettingsDialogProps
> = ({
  isOpen,
  isConnected,
  currentSpreadsheetId,
  currentSheetId,
  currentColumnMapping,
  onClose,
  onSave,
  onStartOAuth,
  onFetchSpreadsheets,
  onFetchSheets,
}) => {
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetOption[]>([]);
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<
    string | undefined
  >(currentSpreadsheetId);
  const [selectedSheetId, setSelectedSheetId] = useState<number | undefined>(
    currentSheetId,
  );
  const [columnMapping, setColumnMapping] = useState<
    GoogleSpreadsheetSettingsDialogProps['currentColumnMapping']
  >(currentColumnMapping);
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  useEffect(() => {
    setSelectedSpreadsheetId(currentSpreadsheetId);
    setSelectedSheetId(currentSheetId);
    setColumnMapping(currentColumnMapping);
  }, [currentSpreadsheetId, currentSheetId, currentColumnMapping]);

  useEffect(() => {
    if (!isOpen) return;
    return focusModalOnOpen(() => modalContainerRef.current);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    return attachEscapeClose(onClose);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isConnected) return;

    const loadSpreadsheets = async () => {
      setIsLoadingSpreadsheets(true);
      try {
        const result = await onFetchSpreadsheets();
        setSpreadsheets(result.items);
      } catch (error) {
        console.error('Failed to load spreadsheets:', error);
      } finally {
        setIsLoadingSpreadsheets(false);
      }
    };

    loadSpreadsheets();
  }, [isOpen, isConnected, onFetchSpreadsheets]);

  useEffect(() => {
    if (!selectedSpreadsheetId) {
      setSheets([]);
      return;
    }

    const loadSheets = async () => {
      setIsLoadingSheets(true);
      try {
        const result = await onFetchSheets(selectedSpreadsheetId);
        setSheets(result.items);
      } catch (error) {
        console.error('Failed to load sheets:', error);
      } finally {
        setIsLoadingSheets(false);
      }
    };

    loadSheets();
  }, [selectedSpreadsheetId, onFetchSheets]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (modalContainerRef.current) {
      trapTabFocus(modalContainerRef.current, e);
    }
  };

  const handleSpreadsheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedSpreadsheetId(value || undefined);
    setSelectedSheetId(undefined);
  };

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      setSelectedSheetId(undefined);
    } else {
      const numValue = Number(value);
      setSelectedSheetId(isNaN(numValue) ? undefined : numValue);
    }
  };

  const handleSave = () => {
    if (!selectedSpreadsheetId || selectedSheetId === undefined) return;

    const selectedSheet = sheets.find((s) => s.sheetId === selectedSheetId);
    if (!selectedSheet) return;

    onSave({
      spreadsheetId: selectedSpreadsheetId,
      sheetId: selectedSheetId,
      sheetTitle: selectedSheet.title,
      columnMapping,
    });
  };

  const saveDisabled = !selectedSpreadsheetId || selectedSheetId === undefined;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="time-tracker__modal-backdrop" role="presentation">
      <div
        ref={modalContainerRef}
        className="time-tracker__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-settings-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id="google-settings-title">Google スプレッドシート設定</h2>

        {!isConnected ? (
          <div className="time-tracker__modal-content">
            <p>Google アカウントと連携して、スプレッドシートへの同期を有効にします。</p>
            <div className="time-tracker__modal-actions">
              <button type="button" onClick={onClose}>
                キャンセル
              </button>
              <button type="button" onClick={onStartOAuth}>
                Google アカウントと連携
              </button>
            </div>
          </div>
        ) : (
          <div className="time-tracker__modal-content">
            <div className="time-tracker__field">
              <label htmlFor="spreadsheet-select">スプレッドシート</label>
              <select
                id="spreadsheet-select"
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
            </div>

            <div className="time-tracker__field">
              <label htmlFor="sheet-select">シート</label>
              <select
                id="sheet-select"
                value={selectedSheetId !== undefined ? String(selectedSheetId) : ''}
                onChange={handleSheetChange}
                disabled={!selectedSpreadsheetId || isLoadingSheets}
              >
                <option value="">選択してください</option>
                {sheets.map((sheet, index) => (
                  <option key={`${sheet.sheetId}-${index}`} value={sheet.sheetId}>
                    {sheet.title}
                  </option>
                ))}
              </select>
            </div>
            {selectedSpreadsheetId && selectedSheetId !== undefined ? (
              <ColumnMappingForm
                currentMapping={columnMapping}
                onChange={setColumnMapping}
              />
            ) : null}

            <div className="time-tracker__modal-actions">
              <button type="button" onClick={onClose}>
                キャンセル
              </button>
              <button type="button" onClick={handleSave} disabled={saveDisabled}>
                保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
