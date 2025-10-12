import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../../index.css';
import { useTimeTrackerSessions } from '@features/time-tracker/hooks/data/useTimeTrackerSessions.ts';
import { useRunningSession } from '@features/time-tracker/hooks/data/useRunningSession.ts';
import { useGoogleSpreadsheetSync } from '@features/time-tracker/hooks/data/useGoogleSpreadsheetSync.ts';
import { useGoogleSpreadsheetOptions } from '@features/time-tracker/hooks/data/useGoogleSpreadsheetOptions.ts';
import { formatDateTimeLocal } from '@lib/date';
import type { TimeTrackerSession } from '../../domain/types';
import { Composer } from '@features/time-tracker/components/Composer';
import { HistoryList } from '@features/time-tracker/components/HistoryList';
import { EditorModal } from '@features/time-tracker/components/EditorModal';
import { SyncStatusBanner } from '@features/time-tracker/components/SyncStatusBanner';
import { GoogleSpreadsheetSettingsDialog } from '@features/time-tracker/components/GoogleSpreadsheetSettingsDialog';
import {
  isModalSaveDisabled,
  buildUpdatedSession,
  calculateDurationDelta,
} from './logic';
import { localDateTimeToMs } from '@lib/time.ts';
import { useAuth } from '@infra/auth';

const RUNNING_TIMER_ID = 'time-tracker-running-timer';

type ModalState =
  | { type: 'running' }
  | { type: 'history'; sessionId: string }
  | null;

type UndoState = {
  session: TimeTrackerSession;
  index: number;
} | null;

/** 履歴編集開始時の元データ（キャンセル時に復元） */
type HistoryEditSnapshot = TimeTrackerSession | null;

export function TimeTrackerPage() {
  const { user } = useAuth();

  const {
    sessions,
    setSessions,
    persistSessions,
  } = useTimeTrackerSessions({ userId: user?.id ?? null });
  const {
    state: runningState,
    start,
    stop,
    updateDraft,
    adjustDuration,
  } = useRunningSession({ userId: user?.id ?? null });
  const { state: syncState, syncSession } = useGoogleSpreadsheetSync();
  const {
    settings: googleSettings,
    updateSelection,
    isUpdating: isUpdatingGoogleSettings,
    fetchSpreadsheets,
    fetchSheets,
    startOAuth,
  } = useGoogleSpreadsheetOptions();

  // 「削除→元に戻す」用
  const [undoState, setUndoState] = useState<UndoState>(null);

  // Google スプレッドシート設定ダイアログの開閉状態
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  // モーダルの種類
  const [modalState, setModalState] = useState<ModalState>(null);

  // 履歴編集の元スナップショット（キャンセルで戻す）
  const [historyEditSnapshot, setHistoryEditSnapshot] =
    useState<HistoryEditSnapshot>(null);

  // Composer の「未走行時の表示用プロジェクト」（次回開始に使いたい場合に限り保持）
  // ※ドメインではなく UI 補助なので、ここはローカルstateでOK
  const initialComposerProject =
    runningState.status === 'running' ? runningState.draft.project ?? '' : '';
  const [composerProject, setComposerProject] = useState(
    initialComposerProject,
  );
  const isRunning = runningState.status === 'running';
  const elapsedSeconds = runningState.elapsedSeconds;
  const runningDraftTitle = isRunning ? runningState.draft.title : null;

  // ==== モーダルの活性可否（フォームstateを廃し、現在のドメイン値から判定） ====
  const modalComputed = useMemo(() => {
    if (!modalState) {
      return {
        title: '',
        project: '',
        startTime: '',
        endTime: '',
        disabled: true,
      };
    }
    if (modalState.type === 'running') {
      if (!isRunning) {
        return {
          title: '',
          project: '',
          startTime: '',
          endTime: '',
          disabled: true,
        };
      }
      const title = runningState.draft.title ?? '';
      const project = runningState.draft.project ?? '';
      const startTime = formatDateTimeLocal(runningState.draft.startedAt);
      const endTime = ''; // 走行中は未設定
      return {
        title,
        project,
        startTime,
        endTime,
        disabled: isModalSaveDisabled(modalState, title, startTime, endTime),
      };
    }
    // history
    const target = sessions.find((s) => s.id === modalState.sessionId);
    if (!target) {
      return {
        title: '',
        project: '',
        startTime: '',
        endTime: '',
        disabled: true,
      };
    }
    const title = target.title ?? '';
    const project = target.project ?? '';
    const startTime = formatDateTimeLocal(target.startedAt);
    const endTime = formatDateTimeLocal(target.endedAt);
    return {
      title,
      project,
      startTime,
      endTime,
      disabled: isModalSaveDisabled(modalState, title, startTime, endTime),
    };
  }, [
    isRunning,
    modalState,
    sessions,
    runningState.draft?.project,
    runningState.draft?.startedAt,
    runningState.draft?.title,
  ]);

  // ==== Composer handlers ====
  const handleComposerProjectChange = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      setComposerProject(trimmed); // 非走行時は次回開始のためのUI表示
      if (isRunning) {
        updateDraft({ project: trimmed || undefined });
      }
    },
    [isRunning, updateDraft],
  );

  const handleComposerStart = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return false;
      const started = start(trimmed);
      if (started) {
        setUndoState(null);
      }
      return started;
    },
    [start],
  );

  const handleComposerStop = useCallback(async () => {
    const previousTitle = runningDraftTitle ?? '';
    const session = stop();
    if (!session) {
      return {
        nextInputValue: previousTitle,
        nextProject: composerProject,
      };
    }
    const nextSessions = setSessions((prev) => [session, ...prev]);
    await persistSessions(nextSessions);
    void syncSession(session);
    const nextProject = session.project ?? '';
    setComposerProject(nextProject); // 停止後のプロジェクトを表示用に同期
    setUndoState(null);
    if (modalState?.type === 'running') {
      setModalState(null);
    }
    return {
      nextInputValue: session.title,
      nextProject,
    };
  }, [
    composerProject,
    runningDraftTitle,
    stop,
    persistSessions,
    setSessions,
    modalState,
    syncSession,
  ]);

  const handleComposerAdjustDuration = useCallback(
    (deltaSeconds: number) => {
      adjustDuration(deltaSeconds);
    },
    [adjustDuration],
  );

  // ==== モーダル open/close ====
  const openRunningEditor = useCallback(() => {
    if (runningState.status !== 'running') return;
    setModalState({ type: 'running' });
  }, [runningState.status]);

  const handleEditHistory = useCallback(
    (sessionId: string) => {
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) return;
      // キャンセルで戻せるように元を保存
      setHistoryEditSnapshot(target);
      setModalState({ type: 'history', sessionId: target.id });
    },
    [sessions],
  );

  const closeModal = useCallback(() => {
    // 履歴編集のキャンセル時は元スナップショットに戻す
    if (modalState?.type === 'history' && historyEditSnapshot) {
      const targetIndex = sessions.findIndex(
        (s) => s.id === historyEditSnapshot.id,
      );
      if (targetIndex !== -1) {
        const nextSessions = setSessions((prev) => {
          const next = [...prev];
          next[targetIndex] = historyEditSnapshot;
          return next;
        });
        persistSessions(nextSessions);
      }
    }
    setHistoryEditSnapshot(null);
    setModalState(null);
  }, [historyEditSnapshot, modalState, persistSessions, sessions, setSessions]);

  // ==== 履歴の削除/Undo ====
  const handleDeleteHistory = useCallback(
    (sessionId: string) => {
      let removedSession: TimeTrackerSession | null = null;
      let removedIndex = -1;
      const nextSessions = setSessions((prev) => {
        const index = prev.findIndex((session) => session.id === sessionId);
        if (index === -1) return prev;
        const next = [...prev];
        const [removed] = next.splice(index, 1);
        removedSession = removed;
        removedIndex = index;
        return next;
      });
      if (removedSession) {
        setUndoState({ session: removedSession, index: removedIndex });
        persistSessions(nextSessions);
      }
      if (
        modalState?.type === 'history' &&
        modalState.sessionId === sessionId
      ) {
        setHistoryEditSnapshot(null);
        setModalState(null);
      }
    },
    [modalState, persistSessions, setSessions],
  );

  const handleUndo = useCallback(() => {
    setUndoState((current) => {
      if (!current) return null;
      const nextSessions = setSessions((prev) => {
        const next = [...prev];
        const insertIndex = Math.min(current.index, next.length);
        next.splice(insertIndex, 0, current.session);
        return next;
      });
      persistSessions(nextSessions);
      return null;
    });
  }, [persistSessions, setSessions]);

  // ==== モーダル保存 ====
  const handleModalSave = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!modalState) return;

      if (modalState.type === 'running') {
        // 走行中は draft を直接編集済みなので保存時は閉じるだけ
        setModalState(null);
        return;
      }

      const nextSessions = setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === modalState.sessionId);
        if (idx === -1) return prev;
        const target = prev[idx];
        const next = buildUpdatedSession(target, {
          title: target.title,
          project: target.project ?? '',
          startTime: formatDateTimeLocal(target.startedAt),
          endTime: formatDateTimeLocal(target.endedAt),
        });
        if (!next) return prev;
        const replaced = [...prev];
        replaced[idx] = next;
        return replaced;
      });
      persistSessions(nextSessions);
      setHistoryEditSnapshot(null);
      setModalState(null);
    },
    [modalState, persistSessions, setSessions],
  );

  // ==== モーダルの onChange：ドメインを直接パッチ ====
  const onModalTitleChange = useCallback(
    (value: string) => {
      if (!modalState) return;
      const title = value.trim();
      if (modalState.type === 'running') {
        if (isRunning) updateDraft({ title });
        return;
      }
      // history
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === modalState.sessionId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], title };
        // 保存は Save 時にまとめて（ここでは persist しない or しても良い）
        return next;
      });
    },
    [isRunning, modalState, updateDraft],
  );

  const onModalProjectChange = useCallback(
    (value: string) => {
      if (!modalState) return;
      const trimmed = value.trim();
      const project = trimmed ? trimmed : undefined;

      if (modalState.type === 'running') {
        if (isRunning) updateDraft({ project });
        return;
      }
      // history
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === modalState.sessionId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], project };
        return next;
      });
    },
    [isRunning, modalState, updateDraft],
  );

  const onModalStartTimeChange = useCallback(
    (value: string) => {
      if (!modalState) return;
      if (modalState.type === 'running') {
        if (!isRunning) return;
        // 入力された開始時刻が現在のelapsedとの差分だけズレるように調整
        const deltaSeconds = calculateDurationDelta(elapsedSeconds, value);
        if (deltaSeconds !== 0) {
          adjustDuration(deltaSeconds);
        }
        return;
      }
      // history
      const ms = localDateTimeToMs(value);
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === modalState.sessionId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], startedAt: ms };
        return next;
      });
    },
    [adjustDuration, elapsedSeconds, isRunning, modalState],
  );

  const onModalEndTimeChange = useCallback(
    (value: string) => {
      if (!modalState || modalState.type !== 'history') return;
      const ms = localDateTimeToMs(value);
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === modalState.sessionId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], endedAt: ms };
        return next;
      });
    },
    [modalState],
  );

  const lastSyncedSession = useMemo(() => {
    if (!syncState.lastSessionId) return null;
    return (
      sessions.find((session) => session.id === syncState.lastSessionId) ?? null
    );
  }, [sessions, syncState.lastSessionId]);

  const handleRetrySync = useCallback(() => {
    if (!lastSyncedSession) return;
    void syncSession(lastSyncedSession);
  }, [lastSyncedSession, syncSession]);

  // ==== Google スプレッドシート設定 ====
  const handleOpenSettings = useCallback(() => {
    setIsSettingsDialogOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsDialogOpen(false);
  }, []);

  const handleSaveSettings = useCallback(
    async (selection: {
      spreadsheetId: string;
      sheetId: number;
      sheetTitle: string;
      columnMapping?: Record<string, string>;
    }) => {
      try {
        await updateSelection(selection);
        setIsSettingsDialogOpen(false);
      } catch (error) {
        console.error('Failed to update Google spreadsheet settings:', error);
      }
    },
    [updateSelection],
  );

  const handleStartOAuth = useCallback(async () => {
    try {
      const currentUrl = window.location.href;
      const response = await startOAuth(currentUrl);
      if (response.authorizationUrl) {
        window.location.href = response.authorizationUrl;
      }
    } catch (error) {
      console.error('Failed to start OAuth:', error);
    }
  }, [startOAuth]);

  // ==== プロジェクトの同期（走行中だけdraftへ反映） ====
  useEffect(() => {
    if (!isRunning) return;
    const project = composerProject.trim();
    updateDraft({ project: project || undefined });
  }, [isRunning, composerProject, updateDraft]);

  // ==== モーダルのフォーカス復元 ====
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (modalState) {
      const previousFocus = document.activeElement as HTMLElement | null;
      return () => {
        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus();
        }
      };
    }
  }, [modalState]);

  return (
    <main className="time-tracker">
      <div className="time-tracker__panel">
        <header className="time-tracker__header">
         <h1>Time Tracker</h1>
         <p>何をやりますか？</p>
         <button
           type="button"
           onClick={handleOpenSettings}
           className="time-tracker__settings-button"
           aria-label="Google スプレッドシート設定"
         >
           ⚙️ 設定
         </button>
       </header>

        <SyncStatusBanner
          state={syncState}
          onRetry={
            syncState.status === 'error' && lastSyncedSession
              ? handleRetrySync
              : undefined
          }
        />

        <Composer
          sessions={sessions}
          project={composerProject}
          onProjectChange={handleComposerProjectChange}
          isRunning={isRunning}
          runningDraftTitle={runningDraftTitle}
          elapsedSeconds={elapsedSeconds}
          onStart={handleComposerStart}
          onStop={handleComposerStop}
          onAdjustDuration={handleComposerAdjustDuration}
          timerId={RUNNING_TIMER_ID}
          onOpenRunningEditor={openRunningEditor}
          isRunningEditorOpen={modalState?.type === 'running'}
        />

        <HistoryList
          sessions={sessions}
          onEdit={handleEditHistory}
          onDelete={handleDeleteHistory}
        />

        {undoState ? (
          <div className="time-tracker__undo" role="status" aria-live="polite">
            <span>記録を削除しました。</span>
            <button type="button" onClick={handleUndo}>
              元に戻す
            </button>
          </div>
        ) : null}
      </div>

      {modalState ? (
        <EditorModal
          mode={modalState.type}
          title={modalComputed.title}
          project={modalComputed.project}
          startTime={modalComputed.startTime}
          endTime={modalComputed.endTime}
          saveDisabled={modalComputed.disabled}
          onTitleChange={onModalTitleChange}
          onProjectChange={onModalProjectChange}
          onStartTimeChange={onModalStartTimeChange}
          onEndTimeChange={onModalEndTimeChange}
          onSave={handleModalSave}
          onCancel={closeModal}
        />
      ) : null}

      <GoogleSpreadsheetSettingsDialog
        isOpen={isSettingsDialogOpen}
        isConnected={googleSettings.data?.connectionStatus === 'active'}
        currentSpreadsheetId={googleSettings.data?.spreadsheet?.id}
        currentSheetId={googleSettings.data?.spreadsheet?.sheetId}
        currentColumnMapping={googleSettings.data?.columnMapping?.mappings}
        onClose={handleCloseSettings}
        onSave={handleSaveSettings}
        onStartOAuth={handleStartOAuth}
        onFetchSpreadsheets={fetchSpreadsheets}
        onFetchSheets={fetchSheets}
      />
    </main>
  );
}
