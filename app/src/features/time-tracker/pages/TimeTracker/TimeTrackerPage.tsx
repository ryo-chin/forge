import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../index.css';
import { useTimeTrackerSessions } from '../../hooks/data/useTimeTrackerSessions.ts';
import { useRunningSession } from '../../hooks/data/useRunningSession.ts';
import { useGoogleSpreadsheetSync } from '../../hooks/data/useGoogleSpreadsheetSync.ts';
import { useGoogleSpreadsheetOptions } from '../../hooks/data/useGoogleSpreadsheetOptions.ts';
import { formatDateTimeLocal } from '../../../../lib/date.ts';
import type { SessionDraft, TimeTrackerSession } from '../../domain/types.ts';
import { Composer } from '../../components/Composer';
import { ThemeManager } from '../../components/ThemeManager';
import { HistoryList } from '../../components/HistoryList';
import { EditorModal } from '../../components/EditorModal';
import { SyncStatusBanner } from '../../components/SyncStatusBanner';
import {
  isModalSaveDisabled,
  buildUpdatedSession,
  calculateDurationDelta,
  buildThemeProjectTree,
} from './logic.ts';
import { useResponsiveLayout } from '../../../../ui/hooks/useResponsiveLayout.ts';
import { useAuth } from '../../../../infra/auth';
import { useNavigate } from 'react-router-dom';
import { useThemes } from '../../hooks/data/useThemes.ts';

const RUNNING_TIMER_ID = 'time-tracker-running-timer';

const buildDraftSignature = (draft: SessionDraft): string =>
  JSON.stringify({
    id: draft.id,
    title: draft.title ?? '',
    startedAt: draft.startedAt,
    project: draft.project ?? '',
    projectId: draft.projectId ?? null,
    themeId: draft.themeId ?? null,
    classificationPath: Array.isArray(draft.classificationPath)
      ? draft.classificationPath
      : [],
    tags: Array.isArray(draft.tags) ? [...draft.tags].sort() : [],
    skill: draft.skill ?? '',
    intensity: draft.intensity ?? '',
    notes: draft.notes ?? '',
  });

const buildClassificationPathFromIds = (
  themeId: string | null | undefined,
  projectId: string | null | undefined,
): string[] | undefined => {
  const segments: string[] = [];
  if (typeof themeId === 'string' && themeId.trim().length > 0) {
    segments.push(themeId.trim());
  }
  if (typeof projectId === 'string' && projectId.trim().length > 0) {
    segments.push(projectId.trim());
  }
  return segments.length > 0 ? segments : undefined;
};

type ModalState =
  | { type: 'running' }
  | { type: 'history'; sessionId: string }
  | null;

type HistoryDraft = {
  title: string;
  project: string;
  startTime: string;
  endTime: string;
};

type UndoState = {
  session: TimeTrackerSession;
  index: number;
} | null;

/** 履歴編集開始時の元データ（キャンセル時に復元） */
type HistoryEditSnapshot = TimeTrackerSession | null;

export function TimeTrackerPage() {
  const { user } = useAuth();
  const viewport = useResponsiveLayout();

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
    reset,
    persistRunningState,
  } = useRunningSession({ userId: user?.id ?? null });
  const themesState = useThemes({ ownerId: user?.id ?? null });
  const themeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    themesState.themes.forEach((theme) => {
      map.set(theme.id, theme.name);
    });
    return map;
  }, [themesState.themes]);
  const resolveThemeName = useCallback(
    (themeId: string | null) => {
      if (!themeId) return null;
      return themeNameMap.get(themeId) ?? '未登録のテーマ';
    },
    [themeNameMap],
  );
  const {
    state: syncState,
    syncSession,
    syncRunningSessionStart,
    syncRunningSessionUpdate,
    syncRunningSessionCancel,
    deleteSessionRow,
  } = useGoogleSpreadsheetSync({ resolveThemeName });
  const { settings: googleSettings } = useGoogleSpreadsheetOptions();
  const navigate = useNavigate();

  // 「削除→元に戻す」用
  const [undoState, setUndoState] = useState<UndoState>(null);

  // モーダルの種類
  const [modalState, setModalState] = useState<ModalState>(null);

  // 履歴編集の元スナップショット（キャンセルで戻す）
  const [historyEditSnapshot, setHistoryEditSnapshot] =
    useState<HistoryEditSnapshot>(null);
  const [historyDraft, setHistoryDraft] = useState<HistoryDraft | null>(null);
  // Composer の「未走行時の表示用プロジェクト」（次回開始に使いたい場合に限り保持）
  // ※ドメインではなく UI 補助なので、ここはローカルstateでOK
  const initialComposerProject =
    runningState.status === 'running' ? runningState.draft.project ?? '' : '';
  const [composerProject, setComposerProject] = useState(
    initialComposerProject,
  );
  const initialComposerThemeId =
    runningState.status === 'running' ? runningState.draft.themeId ?? null : null;
  const [composerThemeId, setComposerThemeId] = useState<string | null>(
    initialComposerThemeId,
  );
  const [themeInitialized, setThemeInitialized] = useState(
    () => runningState.status === 'running',
  );
  const activeThemes = useMemo(
    () => themesState.themes.filter((theme) => theme.status === 'active'),
    [themesState.themes],
  );
  const composerProjectForDisplay =
    runningState.status === 'running'
      ? runningState.draft.project ?? ''
      : composerProject;
  const composerThemeIdForDisplay =
    runningState.status === 'running'
      ? runningState.draft.themeId ?? null
      : composerThemeId;
  const isRunning = runningState.status === 'running';
  const elapsedSeconds = runningState.elapsedSeconds;
  const runningDraftTitle = isRunning ? runningState.draft.title : null;
  const runningDraftSyncRef = useRef<{ id: string | null; signature: string | null }>({
    id: isRunning ? runningState.draft.id : null,
    signature: isRunning ? buildDraftSignature(runningState.draft) : null,
  });

  useEffect(() => {
    if (themeInitialized) return;
    if (isRunning) return;
    const fallback = activeThemes[0]?.id ?? null;
    if (fallback) {
      setComposerThemeId(fallback);
      setThemeInitialized(true);
    }
  }, [activeThemes, isRunning, themeInitialized]);

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
    const draft =
      historyDraft ??
      ({
        title: target.title ?? '',
        project: target.project ?? '',
        startTime: formatDateTimeLocal(target.startedAt),
        endTime: formatDateTimeLocal(target.endedAt),
      } satisfies HistoryDraft);
    const { title, project, startTime, endTime } = draft;
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
    historyDraft,
  ]);

  // ==== Composer handlers ====
  const handleComposerThemeChange = useCallback(
    (themeId: string | null) => {
      setComposerThemeId(themeId);
      setThemeInitialized(true);
      if (isRunning && runningState.status === 'running') {
        const classificationPath = buildClassificationPathFromIds(
          themeId,
          runningState.draft.projectId ?? null,
        );
        updateDraft({
          themeId: themeId ?? null,
          ...(classificationPath
            ? { classificationPath }
            : { classificationPath: [] }),
        });
      }
    },
    [isRunning, runningState, updateDraft],
  );

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
      const started = start(trimmed, {
        project: composerProject || null,
        themeId: composerThemeId || null,
      });
      if (started) {
        setThemeInitialized(true);
        setUndoState(null);
      }
      return started;
    },
    [composerProject, composerThemeId, start],
  );

  const handleComposerStop = useCallback(() => {
    const previousTitle = runningDraftTitle ?? '';
    const session = stop();
    if (!session) {
      return {
        nextInputValue: previousTitle,
        nextProject: composerProject,
        nextThemeId: composerThemeId ?? null,
      };
    }
    const nextSessions = setSessions((prev) => [session, ...prev]);

    // 永続化を実行（非同期だがawaitせずPromiseを投げる）
    void persistSessions(nextSessions).then(() => {
      // 永続化完了後にGoogle同期を実行
      void syncSession(session);
    });

    const nextProject = session.project ?? '';
    setComposerProject(nextProject); // 停止後のプロジェクトを表示用に同期
    const nextThemeId = session.themeId ?? null;
    const fallbackThemeId =
      nextThemeId ?? composerThemeId ?? (activeThemes[0]?.id ?? null);
    setComposerThemeId(fallbackThemeId);
    setThemeInitialized(true);
    setUndoState(null);
    if (modalState?.type === 'running') {
      setModalState(null);
    }
    return {
      nextInputValue: session.title,
      nextProject,
      nextThemeId,
    };
  }, [
    composerProject,
    composerThemeId,
    activeThemes,
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
        nextThemeId: composerThemeId ?? null,
      };
    }

    const draft = runningState.draft;
    const nextProject = draft.project ?? '';
    const nextTitle = draft.title ?? '';
    const nextThemeId = draft.themeId ?? null;

    runningDraftSyncRef.current = { id: null, signature: null };
    reset();
    setUndoState(null);
    if (modalState?.type === 'running') {
      setModalState(null);
    }
    setComposerProject(nextProject);
    const fallbackThemeId =
      nextThemeId ?? composerThemeId ?? (activeThemes[0]?.id ?? null);
    setComposerThemeId(fallbackThemeId);
    setThemeInitialized(true);

    void syncRunningSessionCancel(draft.id);

    return {
      nextInputValue: nextTitle,
      nextProject,
      nextThemeId,
    };
  }, [
    composerProject,
    composerThemeId,
    activeThemes,
    modalState,
    reset,
    runningState,
    syncRunningSessionCancel,
  ]);

  const handleComposerAdjustDuration = useCallback(
    (deltaSeconds: number) => {
      adjustDuration(deltaSeconds);
    },
    [adjustDuration],
  );

  // ==== モーダル open/close ====
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const openRunningEditor = useCallback(() => {
    if (runningState.status !== 'running') return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setModalState({ type: 'running' });
  }, [runningState.status]);

  const handleEditHistory = useCallback(
    (sessionId: string) => {
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) return;
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // キャンセルで戻せるように元を保存
      setHistoryEditSnapshot(target);
      setHistoryDraft({
        title: target.title,
        project: target.project ?? '',
        startTime: formatDateTimeLocal(target.startedAt),
        endTime: formatDateTimeLocal(target.endedAt),
      });
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
    setHistoryDraft(null);
    setModalState(null);
  }, [
    historyEditSnapshot,
    modalState,
    persistSessions,
    sessions,
    setSessions,
  ]);

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
      if (
        modalState?.type === 'history' &&
        modalState.sessionId === sessionId
      ) {
        setHistoryEditSnapshot(null);
        setHistoryDraft(null);
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

  // ==== モーダル保存 ====
  const handleModalSave = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!modalState) return;

      if (modalState.type === 'running') {
        // 走行中はここで即座に永続化をトリガーする
        void persistRunningState();
        setModalState(null);
        return;
      }

      if (!historyDraft) {
        return;
      }

      const nextSessions = setSessions((prev) => {
        const idx = prev.findIndex((session) => session.id === modalState.sessionId);
        if (idx === -1) return prev;

        const target = prev[idx];
        const updated = buildUpdatedSession(target, {
          title: historyDraft.title,
          project: historyDraft.project,
          startTime: historyDraft.startTime,
          endTime: historyDraft.endTime,
        });
        if (!updated) return prev;

        return prev.map((session, index) => (index === idx ? updated : session));
      });

      if (nextSessions !== sessions) {
        const updatedSession = nextSessions.find(
          (session) => session.id === modalState.sessionId,
        );

        const persistPromise = persistSessions(nextSessions);
        if (updatedSession) {
          void persistPromise
            .then(() => {
              void syncSession(updatedSession);
            })
            .catch(() => {
              // 永続化エラー時は同期をスキップ
            });
        }
      }

      setHistoryEditSnapshot(null);
      setHistoryDraft(null);
      setModalState(null);
    },
    [
      historyDraft,
      modalState,
      persistRunningState,
      persistSessions,
      setSessions,
      syncSession,
      sessions,
    ],
  );

  // ==== モーダルの onChange：ドメインを直接パッチ ====
  const onModalTitleChange = useCallback(
    (value: string) => {
      if (!modalState) return;
      const title = value;
      if (modalState.type === 'running') {
        if (isRunning) updateDraft({ title });
        return;
      }
      // history
      setHistoryDraft((current) => {
        if (!current || modalState.type !== 'history') return current;
        return { ...current, title };
      });
    },
    [isRunning, modalState, updateDraft],
  );

  const onModalProjectChange = useCallback(
    (value: string) => {
      if (!modalState) return;
      const project = value;

      if (modalState.type === 'running') {
        if (isRunning) {
          const normalized = project.trim() === '' ? undefined : project;
          updateDraft({ project: normalized });
          setComposerProject(normalized ?? '');
        }
        return;
      }
      // history
      setHistoryDraft((current) => {
        if (!current || modalState.type !== 'history') return current;
        return { ...current, project };
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
      setHistoryDraft((current) => {
        if (!current || modalState.type !== 'history') return current;
        return { ...current, startTime: value };
      });
    },
    [adjustDuration, elapsedSeconds, isRunning, modalState],
  );

  const onModalEndTimeChange = useCallback(
    (value: string) => {
      if (!modalState || modalState.type !== 'history') return;
      setHistoryDraft((current) => {
        if (!current) return current;
        return { ...current, endTime: value };
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

  // 表示用に先頭5件のみに制限
  const displaySessions = useMemo(() => sessions.slice(0, 5), [sessions]);
  const themeTree = useMemo(
    () => buildThemeProjectTree(displaySessions, themesState.themes),
    [displaySessions, themesState.themes],
  );

  const isGoogleConnected = googleSettings.data?.connectionStatus === 'active';
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
        <section
          className="time-tracker__intro"
          aria-labelledby="time-tracker-heading"
        >
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
          onRetry={
            syncState.status === 'error' && lastSyncedSession
              ? handleRetrySync
              : undefined
          }
        />

        <ThemeManager state={themesState} />

        <Composer
          sessions={sessions}
          themes={themesState.themes}
          selectedThemeId={composerThemeIdForDisplay}
          onThemeChange={handleComposerThemeChange}
          isThemeLoading={themesState.isLoading}
          themeError={themesState.error}
          project={composerProjectForDisplay}
          onProjectChange={handleComposerProjectChange}
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
          tree={themeTree}
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
    </main>
  );
}
