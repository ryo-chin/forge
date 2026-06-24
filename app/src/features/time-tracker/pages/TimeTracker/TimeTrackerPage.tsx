import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../index.css';
import { useAuth } from '@infra/auth';
import { useResponsiveLayout } from '@ui/hooks/useResponsiveLayout.ts';
import { useNavigate } from 'react-router-dom';
import { Composer } from '../../components/Composer';
import { EditorModal, type EditorModalResult } from '../../components/EditorModal';
import { HistoryList } from '../../components/HistoryList';
import { buildProjectSuggestions, buildTitleSuggestions } from '../../components/SearchPicker';
import { SyncStatusBanner } from '../../components/SyncStatusBanner';
import type { SessionDraft, TimeTrackerSession } from '../../domain/types.ts';
import { useGoogleSpreadsheetOptions } from '../../hooks/data/useGoogleSpreadsheetOptions.ts';
import { useGoogleSpreadsheetSync } from '../../hooks/data/useGoogleSpreadsheetSync.ts';
import { useRunningSession } from '../../hooks/data/useRunningSession.ts';
import { useTimeTrackerSessions } from '../../hooks/data/useTimeTrackerSessions.ts';
import { composeSession, defaultManualRange } from './logic.ts';

const RUNNING_TIMER_ID = 'time-tracker-running-timer';

const buildDraftSignature = (draft: SessionDraft): string =>
  JSON.stringify({
    id: draft.id,
    title: draft.title ?? '',
    startedAt: draft.startedAt,
    project: draft.project ?? '',
    tags: Array.isArray(draft.tags) ? [...draft.tags].sort() : [],
    skill: draft.skill ?? '',
    intensity: draft.intensity ?? '',
    notes: draft.notes ?? '',
  });

type ModalState =
  | { type: 'running' }
  | { type: 'history'; sessionId: string }
  | { type: 'new' }
  | null;

type ModalInit = {
  title: string;
  project: string;
  startMs: number;
  endMs: number;
};

type UndoState = {
  session: TimeTrackerSession;
  index: number;
} | null;

export function TimeTrackerPage() {
  const { user } = useAuth();
  const viewport = useResponsiveLayout();

  const { sessions, setSessions, persistSessions } = useTimeTrackerSessions({
    userId: user?.id ?? null,
  });
  const {
    state: runningState,
    start,
    stop,
    updateDraft,
    adjustDuration,
    reset,
  } = useRunningSession({ userId: user?.id ?? null });
  const { settings: googleSettings } = useGoogleSpreadsheetOptions();
  const isGoogleConnected = googleSettings.data?.connectionStatus === 'active';
  const {
    state: syncState,
    syncSession,
    syncRunningSessionStart,
    syncRunningSessionUpdate,
    syncRunningSessionCancel,
    deleteSessionRow,
  } = useGoogleSpreadsheetSync({ isConnected: isGoogleConnected });
  const navigate = useNavigate();

  // 「削除→元に戻す」用
  const [undoState, setUndoState] = useState<UndoState>(null);

  // モーダルの種類と、開いた瞬間に固定する初期値
  const [modalState, setModalState] = useState<ModalState>(null);
  const [modalInit, setModalInit] = useState<ModalInit | null>(null);

  // Composer の「未走行時の表示用プロジェクト」（次回開始に使いたい場合に限り保持）
  const initialComposerProject =
    runningState.status === 'running' ? (runningState.draft.project ?? '') : '';
  const [composerProject, setComposerProject] = useState(initialComposerProject);
  const composerProjectForDisplay =
    runningState.status === 'running' ? (runningState.draft.project ?? '') : composerProject;
  const isRunning = runningState.status === 'running';
  const elapsedSeconds = runningState.elapsedSeconds;
  const runningDraftTitle = isRunning ? runningState.draft.title : null;
  const runningDraftSyncRef = useRef<{ id: string | null; signature: string | null }>({
    id: isRunning ? runningState.draft.id : null,
    signature: isRunning ? buildDraftSignature(runningState.draft) : null,
  });

  // 履歴からの候補（タイトル / プロジェクト）
  const titleSuggestions = useMemo(() => buildTitleSuggestions('', sessions), [sessions]);
  const projectSuggestions = useMemo(
    () => buildProjectSuggestions(composerProject, sessions),
    [composerProject, sessions],
  );

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

  const handleComposerTitleChange = useCallback(
    (value: string) => {
      if (isRunning) updateDraft({ title: value });
    },
    [isRunning, updateDraft],
  );

  const handleComposerStart = useCallback(
    (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return false;
      const started = start(trimmed, { project: composerProject || null });
      if (started) {
        setUndoState(null);
      }
      return started;
    },
    [composerProject, start],
  );

  const handleComposerStop = useCallback(() => {
    const previousTitle = runningDraftTitle ?? '';
    const session = stop();
    if (!session) {
      return {
        nextInputValue: previousTitle,
        nextProject: composerProject,
      };
    }
    const nextSessions = setSessions((prev) => [session, ...prev]);

    void persistSessions(nextSessions).then(() => {
      void syncSession(session);
    });

    const nextProject = session.project ?? '';
    setComposerProject(nextProject);
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

  const handleComposerCancel = useCallback(() => {
    if (runningState.status !== 'running') {
      return {
        nextInputValue: '',
        nextProject: composerProject,
      };
    }

    const draft = runningState.draft;
    const nextProject = draft.project ?? '';
    const nextTitle = draft.title ?? '';

    runningDraftSyncRef.current = { id: null, signature: null };
    reset();
    setUndoState(null);
    if (modalState?.type === 'running') {
      setModalState(null);
    }
    setComposerProject(nextProject);

    void syncRunningSessionCancel(draft.id);

    return {
      nextInputValue: nextTitle,
      nextProject,
    };
  }, [composerProject, modalState, reset, runningState, syncRunningSessionCancel]);

  const handleComposerAdjustDuration = useCallback(
    (deltaSeconds: number) => {
      adjustDuration(deltaSeconds);
    },
    [adjustDuration],
  );

  // ==== モーダル open/close ====
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const rememberFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
  }, []);

  const openRunningEditor = useCallback(() => {
    if (runningState.status !== 'running') return;
    rememberFocus();
    setModalInit({
      title: runningState.draft.title ?? '',
      project: runningState.draft.project ?? '',
      startMs: runningState.draft.startedAt,
      endMs: Date.now(),
    });
    setModalState({ type: 'running' });
  }, [runningState, rememberFocus]);

  const openManualEntry = useCallback(() => {
    rememberFocus();
    const { startMs, endMs } = defaultManualRange(Date.now());
    setModalInit({ title: '', project: composerProject, startMs, endMs });
    setModalState({ type: 'new' });
  }, [composerProject, rememberFocus]);

  const handleEditHistory = useCallback(
    (sessionId: string) => {
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) return;
      rememberFocus();
      setModalInit({
        title: target.title ?? '',
        project: target.project ?? '',
        startMs: target.startedAt,
        endMs: target.endedAt,
      });
      setModalState({ type: 'history', sessionId });
    },
    [sessions, rememberFocus],
  );

  const closeModal = useCallback(() => {
    setModalState(null);
    setModalInit(null);
  }, []);

  // ==== モーダル保存（new / history / running 継続） ====
  const handleModalSave = useCallback(
    (result: EditorModalResult) => {
      if (!modalState) return;

      if (modalState.type === 'running') {
        if (runningState.status !== 'running') {
          setModalState(null);
          return;
        }
        updateDraft({ title: result.title, project: result.project || undefined });
        // 開始時刻が変わっていれば、経過時間を合わせて調整（継続のまま）
        if (result.startMs !== runningState.draft.startedAt) {
          const newElapsed = Math.max(0, Math.floor((Date.now() - result.startMs) / 1000));
          const delta = newElapsed - elapsedSeconds;
          if (delta !== 0) adjustDuration(delta);
        }
        setComposerProject(result.project);
        setModalState(null);
        return;
      }

      const base =
        modalState.type === 'history'
          ? sessions.find((session) => session.id === modalState.sessionId)
          : undefined;
      if (modalState.type === 'history' && !base) {
        setModalState(null);
        return;
      }

      const session = composeSession(result, base);
      const nextSessions = setSessions((prev) =>
        base ? prev.map((s) => (s.id === base.id ? session : s)) : [session, ...prev],
      );
      void persistSessions(nextSessions)
        .then(() => {
          void syncSession(session);
        })
        .catch(() => {
          // 永続化失敗時は同期をスキップ
        });
      setModalState(null);
    },
    [
      modalState,
      runningState,
      elapsedSeconds,
      updateDraft,
      adjustDuration,
      sessions,
      setSessions,
      persistSessions,
      syncSession,
    ],
  );

  // ==== 計測中セッションを「この時刻で完了」 ====
  const handleModalFinalize = useCallback(
    (result: EditorModalResult) => {
      if (runningState.status !== 'running') return;
      const session = composeSession(result, runningState.draft);
      runningDraftSyncRef.current = { id: null, signature: null };
      reset();
      const nextSessions = setSessions((prev) => [session, ...prev]);
      void persistSessions(nextSessions)
        .then(() => {
          void syncSession(session);
        })
        .catch(() => {
          // 永続化失敗時は同期をスキップ
        });
      setComposerProject(result.project);
      setUndoState(null);
      setModalState(null);
    },
    [runningState, reset, setSessions, persistSessions, syncSession],
  );

  // ==== 履歴の削除/Undo ====
  const handleDeleteHistory = useCallback(
    (sessionId: string) => {
      let removedSession: TimeTrackerSession | null = null;
      let removedIndex = -1;
      const nextSessions = setSessions((prev) => {
        const index = prev.findIndex((session) => session.id === sessionId);
        if (index === -1) {
          removedSession = null;
          removedIndex = -1;
          return prev;
        }
        const next = [...prev];
        const [removed] = next.splice(index, 1);
        removedSession = removed ?? null;
        removedIndex = index;
        return next;
      });
      const persistPromise = persistSessions(nextSessions);
      if (removedSession) {
        const sessionIdForDelete: string = (removedSession as TimeTrackerSession).id;
        setUndoState({ session: removedSession, index: removedIndex });
        void persistPromise
          .then(() => {
            void deleteSessionRow(sessionIdForDelete);
          })
          .catch(() => {
            // 永続化失敗時はシート削除をスキップ
          });
      }
      if (modalState?.type === 'history' && modalState.sessionId === sessionId) {
        setModalState(null);
      }
    },
    [deleteSessionRow, modalState, persistSessions, setSessions],
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

  const handleRestartHistory = useCallback(
    (session: TimeTrackerSession): boolean => {
      if (isRunning) {
        return false;
      }

      const ok = start(session.title, {
        project: session.project ?? null,
        tags: session.tags?.length ? [...session.tags] : undefined,
        skill: session.skill,
        intensity: session.intensity,
        notes: session.notes,
      });
      if (!ok) {
        return false;
      }

      setComposerProject(session.project ?? '');
      setUndoState(null);

      return true;
    },
    [isRunning, start],
  );

  const lastSyncedSession = useMemo(() => {
    if (!syncState.lastSessionId) return null;
    return sessions.find((session) => session.id === syncState.lastSessionId) ?? null;
  }, [sessions, syncState.lastSessionId]);

  const handleRetrySync = useCallback(() => {
    if (!lastSyncedSession) return;
    void syncSession(lastSyncedSession);
  }, [lastSyncedSession, syncSession]);

  const settingsButtonLabel = isGoogleConnected ? '⚙️ 設定 (連携中)' : '⚙️ 設定';

  useEffect(() => {
    if (!isRunning) {
      runningDraftSyncRef.current = { id: null, signature: null };
      return;
    }

    const draft = runningState.draft;
    const signature = buildDraftSignature(draft);
    const prev = runningDraftSyncRef.current;

    if (!prev.id || prev.id !== draft.id) {
      runningDraftSyncRef.current = { id: draft.id, signature };
      void syncRunningSessionStart(draft);
      return;
    }

    if (prev.signature !== signature) {
      runningDraftSyncRef.current = { id: draft.id, signature };
      void syncRunningSessionUpdate(draft, runningState.elapsedSeconds);
    }
  }, [
    isRunning,
    runningState.draft,
    runningState.elapsedSeconds,
    syncRunningSessionStart,
    syncRunningSessionUpdate,
  ]);

  // ==== モーダルのフォーカス復元 ====
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (modalState) {
      return () => {
        const target = previousFocusRef.current;
        if (target && typeof target.focus === 'function') {
          queueMicrotask(() => {
            if (typeof target.focus === 'function') {
              target.focus();
            }
          });
        }
        previousFocusRef.current = null;
      };
    }
  }, [modalState]);

  const rootClassName = [
    'time-tracker',
    viewport === 'mobile' ? 'time-tracker--mobile' : '',
    'time-tracker__safe-area-top',
    'time-tracker__safe-area-bottom',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main className={rootClassName}>
      <div className="time-tracker__panel">
        <section className="time-tracker__intro" aria-labelledby="time-tracker-heading">
          <div className="time-tracker__intro-top">
            <h1 id="time-tracker-heading">Time Tracker</h1>
          </div>
          <div className="time-tracker__intro-actions">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="time-tracker__settings-button time-tracker__touch-target"
              aria-label={
                isGoogleConnected
                  ? 'Google スプレッドシート設定（連携中）'
                  : 'Google スプレッドシート設定'
              }
            >
              {settingsButtonLabel}
            </button>
          </div>
        </section>

        <SyncStatusBanner
          state={syncState}
          onRetry={syncState.status === 'error' && lastSyncedSession ? handleRetrySync : undefined}
        />

        <Composer
          sessions={sessions}
          project={composerProjectForDisplay}
          onProjectChange={handleComposerProjectChange}
          onTitleChange={handleComposerTitleChange}
          isRunning={isRunning}
          runningDraftTitle={runningDraftTitle}
          elapsedSeconds={elapsedSeconds}
          onStart={handleComposerStart}
          onStop={handleComposerStop}
          onCancel={handleComposerCancel}
          onAdjustDuration={handleComposerAdjustDuration}
          timerId={RUNNING_TIMER_ID}
          onOpenRunningEditor={openRunningEditor}
          isRunningEditorOpen={modalState?.type === 'running'}
        />

        <HistoryList
          sessions={sessions}
          onEdit={handleEditHistory}
          onDelete={handleDeleteHistory}
          onRestart={handleRestartHistory}
          onAddManual={openManualEntry}
          isRunning={isRunning}
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

      {modalState && modalInit ? (
        <EditorModal
          key={`${modalState.type}-${modalState.type === 'history' ? modalState.sessionId : ''}`}
          mode={modalState.type}
          initialTitle={modalInit.title}
          initialProject={modalInit.project}
          initialStartMs={modalInit.startMs}
          initialEndMs={modalInit.endMs}
          titleSuggestions={titleSuggestions}
          projectSuggestions={projectSuggestions}
          onSave={handleModalSave}
          onFinalize={modalState.type === 'running' ? handleModalFinalize : undefined}
          onCancel={closeModal}
        />
      ) : null}
    </main>
  );
}
