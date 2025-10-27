import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleSpreadsheetSettingsSection } from '../GoogleSpreadsheetSettingsSection.tsx';
import { GoogleSyncClientError } from '@infra/google';
import type {
  SpreadsheetOption,
  SheetOption,
} from '@features/time-tracker/domain/googleSyncTypes.ts';

describe('GoogleSpreadsheetSettingsSection', () => {
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
    isConnected: true,
    currentSpreadsheetId: undefined as string | undefined,
    currentSheetId: undefined as number | undefined,
    currentColumnMapping: undefined,
    onSave: vi.fn(),
    onStartOAuth: vi.fn(),
    onFetchSpreadsheets: vi.fn().mockResolvedValue({ items: mockSpreadsheets }),
    onFetchSheets: vi.fn().mockResolvedValue({ items: mockSheets }),
    isSaving: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section title', async () => {
    render(
      <GoogleSpreadsheetSettingsSection
        {...defaultProps}
        isConnected={false}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Google スプレッドシート連携' }),
    ).toBeInTheDocument();
  });

  it('shows OAuth button when not connected', async () => {
    render(
      <GoogleSpreadsheetSettingsSection
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
    render(<GoogleSpreadsheetSettingsSection {...defaultProps} />);

    await waitFor(() => {
      expect(defaultProps.onFetchSpreadsheets).toHaveBeenCalled();
    });
  });

  it('allows selecting spreadsheet and loads sheets', async () => {
    const user = userEvent.setup();
    render(<GoogleSpreadsheetSettingsSection {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('TimeTracker Main')).toBeInTheDocument();
    });

    const spreadsheetSelect = screen.getByLabelText('スプレッドシート');
    await user.selectOptions(spreadsheetSelect, 'spreadsheet-1');

    await waitFor(() => {
      expect(defaultProps.onFetchSheets).toHaveBeenCalledWith('spreadsheet-1');
    });
  });

  it('allows selecting sheet and saving configuration', async () => {
    const user = userEvent.setup();
    render(
      <GoogleSpreadsheetSettingsSection
        {...defaultProps}
        currentSpreadsheetId="spreadsheet-1"
        currentSheetId={1}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: '保存' });
    await user.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-1',
      sheetId: 1,
      sheetTitle: 'Summary',
      columnMapping: undefined,
    });
  });

  it('disables save button when spreadsheet or sheet is not selected', async () => {
    render(<GoogleSpreadsheetSettingsSection {...defaultProps} />);

    const saveButton = await screen.findByRole('button', { name: '保存' });
    expect(saveButton).toBeDisabled();
  });

  it('shows reconnect prompt when spreadsheet fetch returns 401', async () => {
    const fetchError = new GoogleSyncClientError('Unauthorized', 401);
    render(
      <GoogleSpreadsheetSettingsSection
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
