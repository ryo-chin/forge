import type {
  SheetOption,
  SpreadsheetOption,
} from '@features/time-tracker/domain/googleSyncTypes.ts';
import { GoogleSyncClientError } from '@infra/repository/GoogleSheets';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleSpreadsheetSettingsSection } from '../GoogleSpreadsheetSettingsSection.tsx';

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
    onDisconnect: vi.fn(),
    onFetchSpreadsheets: vi.fn().mockResolvedValue({ items: mockSpreadsheets }),
    onFetchSheets: vi.fn().mockResolvedValue({ items: mockSheets }),
    isSaving: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders section title', async () => {
    render(<GoogleSpreadsheetSettingsSection {...defaultProps} isConnected={false} />);

    expect(
      await screen.findByRole('heading', { name: 'Google スプレッドシート連携' }),
    ).toBeInTheDocument();
  });

  it('shows OAuth button when not connected', async () => {
    render(<GoogleSpreadsheetSettingsSection {...defaultProps} isConnected={false} />);

    const oauthButton = screen.getByRole('button', {
      name: /Google アカウントと連携/i,
    });
    expect(oauthButton).toBeInTheDocument();

    await userEvent.click(oauthButton);
    expect(defaultProps.onStartOAuth).toHaveBeenCalledTimes(1);
  });

  it('disables OAuth button while reconnect is starting', async () => {
    const user = userEvent.setup();
    const onStartOAuth = vi.fn(() => new Promise<void>(() => {}));
    render(
      <GoogleSpreadsheetSettingsSection
        {...defaultProps}
        isConnected={false}
        onStartOAuth={onStartOAuth}
      />,
    );

    const oauthButton = screen.getByRole('button', {
      name: /Google アカウントと連携/i,
    });
    await user.click(oauthButton);
    await user.click(oauthButton);

    expect(onStartOAuth).toHaveBeenCalledTimes(1);
    expect(oauthButton).toBeDisabled();
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

  it('shows disconnect button when connected and triggers disconnect after confirm', async () => {
    const user = userEvent.setup();
    render(<GoogleSpreadsheetSettingsSection {...defaultProps} />);

    const disconnectButton = await screen.findByRole('button', { name: '連携を解除' });
    await user.click(disconnectButton);

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(defaultProps.onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('does not disconnect when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<GoogleSpreadsheetSettingsSection {...defaultProps} />);

    const disconnectButton = await screen.findByRole('button', { name: '連携を解除' });
    await user.click(disconnectButton);

    expect(defaultProps.onDisconnect).not.toHaveBeenCalled();
  });

  it('hides disconnect button when not connected', () => {
    render(<GoogleSpreadsheetSettingsSection {...defaultProps} isConnected={false} />);

    expect(screen.queryByRole('button', { name: '連携を解除' })).not.toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'Google アカウントを再連携' })).toBeInTheDocument();
  });

  it('shows reconnect prompt when Google reports invalid_grant', async () => {
    const fetchError = new GoogleSyncClientError('Google sync request failed', 500, {
      error: 'internal_error',
      message:
        'Failed to exchange authorization code: 400 {"error":"invalid_grant","error_description":"Token has been expired or revoked."}',
    });
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

    expect(screen.getByRole('button', { name: 'Google アカウントを再連携' })).toBeInTheDocument();
  });
});
