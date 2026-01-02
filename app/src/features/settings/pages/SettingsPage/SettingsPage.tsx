import { useCallback, useState } from 'react';
import './SettingsPage.css';
import { useGoogleSpreadsheetOptions } from '@features/time-tracker/hooks/data/useGoogleSpreadsheetOptions.ts';
import { isGoogleSyncEnabled } from '@infra/config';
import { GoogleSpreadsheetSettingsSection } from '../../components/GoogleSpreadsheetSettingsSection';

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
};

export function SettingsPage(): JSX.Element {
  const { settings, updateSelection, isUpdating, fetchSpreadsheets, fetchSheets, startOAuth } =
    useGoogleSpreadsheetOptions();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const handleSave = useCallback(
    async (selection: Parameters<typeof updateSelection>[0]) => {
      setFeedback(null);
      try {
        await updateSelection(selection);
        setFeedback({ type: 'success', message: '設定を保存しました。' });
      } catch (error) {
        if (import.meta.env.MODE !== 'test') {
          // eslint-disable-next-line no-console
          console.error('Failed to update Google spreadsheet settings:', error);
        }
        setFeedback({
          type: 'error',
          message: '設定の保存に失敗しました。時間をおいて再度お試しください。',
        });
      }
    },
    [updateSelection],
  );

  const handleStartOAuth = useCallback(async () => {
    setFeedback(null);
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '/settings';
      const response = await startOAuth(currentUrl);
      if (response.authorizationUrl && typeof window !== 'undefined') {
        window.location.href = response.authorizationUrl;
      }
    } catch (error) {
      if (import.meta.env.MODE !== 'test') {
        // eslint-disable-next-line no-console
        console.error('Failed to start Google OAuth flow:', error);
      }
      setFeedback({
        type: 'error',
        message: 'Google アカウントとの連携に失敗しました。時間をおいて再度お試しください。',
      });
    }
  }, [startOAuth]);

  const isSyncAvailable = isGoogleSyncEnabled();
  const isLoading = settings.isLoading && !settings.data;
  const isError = settings.isError;

  const settingsErrorMessage = isError
    ? '設定の取得に失敗しました。ページを更新して再度お試しください。'
    : null;

  return (
    <main className="settings-page">
      <div className="settings-page__container">
        <header className="settings-page__header">
          <div>
            <h1 className="settings-page__title">設定</h1>
            <p className="settings-page__description">Time Tracker の連携設定を管理します。</p>
          </div>
        </header>

        {feedback ? (
          <div
            className={`settings-page__alert settings-page__alert--${feedback.type}`}
            role="status"
          >
            {feedback.message}
          </div>
        ) : null}

        {!isSyncAvailable ? (
          <p className="settings-page__placeholder">
            Google スプレッドシート連携は現在利用できません。
          </p>
        ) : isLoading ? (
          <p className="settings-page__placeholder">設定を読み込んでいます...</p>
        ) : settingsErrorMessage ? (
          <div className="settings-page__alert settings-page__alert--error" role="alert">
            {settingsErrorMessage}
          </div>
        ) : (
          <GoogleSpreadsheetSettingsSection
            isConnected={settings.data?.connectionStatus === 'active'}
            currentSpreadsheetId={settings.data?.spreadsheet?.id}
            currentSheetId={settings.data?.spreadsheet?.sheetId}
            currentColumnMapping={settings.data?.columnMapping?.mappings}
            onSave={handleSave}
            onStartOAuth={handleStartOAuth}
            onFetchSpreadsheets={fetchSpreadsheets}
            onFetchSheets={fetchSheets}
            isSaving={isUpdating}
          />
        )}
      </div>
    </main>
  );
}
