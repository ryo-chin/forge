import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleSpreadsheetSettingsDialog } from '../GoogleSpreadsheetSettingsDialog.tsx';
import { GoogleSyncClientError } from '@infra/google';
import type {
  SpreadsheetOption,
  SheetOption,
} from '../../../domain/googleSyncTypes.ts';

describe('GoogleSpreadsheetSettingsDialog', () => {
  const mockSpreadsheets: SpreadsheetOption[] = [
    {
      id: 'spreadsheet-1',
      name: 'TimeTracker Main',
      url: 'https://docs.google.com/spreadsheets/d/spreadsheet-1',
    },
    {
      id: 'spreadsheet-2',
      name: 'Reports 2024',
      url: 'https://docs.google.com/spreadsheets/d/spreadsheet-2',
    },
  ];

  const mockSheets: SheetOption[] = [
    { sheetId: 0, title: 'Sheet1', index: 0 },
    { sheetId: 1, title: 'Summary', index: 1 },
  ];

  const defaultProps = {
    isOpen: true,
    isConnected: true,
    currentSpreadsheetId: undefined,
    currentSheetId: undefined,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onStartOAuth: vi.fn(),
    onFetchSpreadsheets: vi.fn().mockResolvedValue({ items: mockSpreadsheets }),
    onFetchSheets: vi.fn().mockResolvedValue({ items: mockSheets }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(<GoogleSpreadsheetSettingsDialog {...defaultProps} />);

    expect(
      screen.getByRole('dialog', { name: /Google スプレッドシート設定/i }),
    ).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<GoogleSpreadsheetSettingsDialog {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByRole('dialog', { name: /Google スプレッドシート設定/i }),
    ).not.toBeInTheDocument();
  });

  it('shows OAuth button when not connected', async () => {
    render(
      <GoogleSpreadsheetSettingsDialog
        {...defaultProps}
        isConnected={false}
      />,
    );

    const oauthButton = screen.getByRole('button', {
      name: /Google アカウントと連携/i,
    });
    expect(oauthButton).toBeInTheDocument();

    await userEvent.click(oauthButton);
    expect(defaultProps.onStartOAuth).toHaveBeenCalledTimes(1);
  });

  it('loads spreadsheets on mount when connected', async () => {
    render(<GoogleSpreadsheetSettingsDialog {...defaultProps} />);

    await waitFor(() => {
      expect(defaultProps.onFetchSpreadsheets).toHaveBeenCalled();
    });
  });

  it('allows selecting spreadsheet and loads sheets', async () => {
    const user = userEvent.setup();
    render(<GoogleSpreadsheetSettingsDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('TimeTracker Main')).toBeInTheDocument();
    });

    const spreadsheetSelect = document.getElementById('spreadsheet-select') as HTMLSelectElement;
    await user.selectOptions(spreadsheetSelect, 'spreadsheet-1');

    await waitFor(() => {
      expect(defaultProps.onFetchSheets).toHaveBeenCalledWith('spreadsheet-1');
    });
  });

  it('allows selecting sheet', async () => {
    const user = userEvent.setup();
    render(
      <GoogleSpreadsheetSettingsDialog
        {...defaultProps}
        currentSpreadsheetId="spreadsheet-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sheet1')).toBeInTheDocument();
    });

    const sheetSelect = document.getElementById('sheet-select') as HTMLSelectElement;
    await user.selectOptions(sheetSelect, '1');

    expect(sheetSelect).toHaveValue('1');
  });

  it('calls onSave with selected values when save is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GoogleSpreadsheetSettingsDialog
        {...defaultProps}
        currentSpreadsheetId="spreadsheet-1"
        currentSheetId={1}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /保存/i });
    await user.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-1',
      sheetId: 1,
      sheetTitle: 'Summary',
    });
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<GoogleSpreadsheetSettingsDialog {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('disables save button when no spreadsheet or sheet is selected', () => {
    render(<GoogleSpreadsheetSettingsDialog {...defaultProps} />);

    const saveButton = screen.getByRole('button', { name: /保存/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when both spreadsheet and sheet are selected', async () => {
    render(
      <GoogleSpreadsheetSettingsDialog
        {...defaultProps}
        currentSpreadsheetId="spreadsheet-1"
        currentSheetId={0}
      />,
    );

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /保存/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('closes dialog on Escape key press', async () => {
    const user = userEvent.setup();
    render(<GoogleSpreadsheetSettingsDialog {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    await user.type(dialog, '{Escape}');

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('prompts reauthentication when spreadsheets fetch returns 401', async () => {
    const fetchError = new GoogleSyncClientError('Unauthorized', 401);
    render(
      <GoogleSpreadsheetSettingsDialog
        {...defaultProps}
        onFetchSpreadsheets={vi.fn().mockRejectedValue(fetchError)}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Google アカウントとの連携が期限切れになりました。再度連携を行ってください。',
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: 'Google アカウントを再連携' }),
    ).toBeInTheDocument();
  });
});
