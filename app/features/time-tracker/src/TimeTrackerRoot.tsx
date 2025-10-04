import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import { useTimeTrackerStorage } from '@features/time-tracker/hooks/data/useTimeTrackerStorage';
import { formatDateTimeLocal, parseDateTimeLocal } from '@lib/date';
import { useRunningSession } from './hooks/useRunningSession';
import type { TimeTrackerSession } from './types';
import { Composer } from '@features/time-tracker/components/Composer';
import { HistoryList } from '@features/time-tracker/components/HistoryList';
import { EditorModal } from '@features/time-tracker/components/EditorModal';

const RUNNING_TIMER_ID = 'time-tracker-running-timer';

export function TimeTrackerRoot() {
  const {
    initialSessions,
    initialRunningState,
    persistSessions,
    persistRunningState,
  } = useTimeTrackerStorage();

  const [sessions, setSessions] = useState<TimeTrackerSession[]>(
    () => initialSessions,
  );
  const [undoState, setUndoState] = useState<{
    session: TimeTrackerSession;
    index: number;
  } | null>(null);
  const [modalState, setModalState] = useState<
    | { type: 'running' }
    | { type: 'history'; sessionId: string }
    | null
  >(null);
  const [modalTitleInput, setModalTitleInput] = useState('');
  const [modalProjectInput, setModalProjectInput] = useState('');
  const [modalStartInput, setModalStartInput] = useState('');
  const [modalEndInput, setModalEndInput] = useState('');
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const { state, start, stop, updateDraft, adjustDuration } = useRunningSession(
    {
      initialState: initialRunningState ?? undefined,
    },
  );
  const isRunning = state.status === 'running';
  const elapsedSeconds = state.elapsedSeconds;
  const runningDraftTitle = isRunning ? state.draft.title : null;
  const activeRunningProject = isRunning ? (state.draft.project ?? '') : '';
  const initialComposerProject =
    initialRunningState?.status === 'running'
      ? (initialRunningState.draft.project ?? '')
      : '';
  const [composerProject, setComposerProject] = useState(
    initialComposerProject,
  );
  const pendingComposerProjectRef = useRef<string | null>(null);

  const handleComposerProjectChange = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      setComposerProject(trimmed);
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
      pendingComposerProjectRef.current = composerProject.trim();
      const started = start(trimmed);
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
    setSessions((prev) => [session, ...prev]);
    const nextProject = session.project ?? '';
    setComposerProject(nextProject);
    setUndoState(null);
    pendingComposerProjectRef.current = null;
    return {
      nextInputValue: session.title,
      nextProject,
    };
  }, [composerProject, runningDraftTitle, stop]);

  const handleComposerAdjustDuration = useCallback(
    (deltaSeconds: number) => {
      adjustDuration(deltaSeconds);
    },
    [adjustDuration],
  );

  useEffect(() => {
    if (!isRunning) return;
    if (composerProject !== activeRunningProject) {
      setComposerProject(activeRunningProject);
    }
  }, [activeRunningProject, composerProject, isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    if (pendingComposerProjectRef.current !== null) {
      const trimmed = pendingComposerProjectRef.current.trim();
      pendingComposerProjectRef.current = null;
      updateDraft({ project: trimmed || undefined });
      setComposerProject(trimmed);
      return;
    }
    const trimmed = composerProject.trim();
    if (activeRunningProject !== trimmed) {
      updateDraft({ project: trimmed || undefined });
    }
  }, [activeRunningProject, composerProject, isRunning, updateDraft]);

  const closeModal = useCallback(() => {
    setModalState(null);
    setModalTitleInput('');
    setModalProjectInput('');
    setModalStartInput('');
    setModalEndInput('');
  }, []);

  useEffect(() => {
    if (modalState?.type === 'running' && state.status !== 'running') {
      closeModal();
    }
  }, [modalState, state.status, closeModal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (modalState) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    } else {
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
      previousFocusRef.current = null;
    }
  }, [modalState]);

  useEffect(() => {
    persistSessions(sessions);
  }, [persistSessions, sessions]);

  useEffect(() => {
    persistRunningState(state);
  }, [persistRunningState, state]);

  const openRunningEditor = useCallback(() => {
    if (state.status !== 'running') return;
    setModalState({ type: 'running' });
    setModalTitleInput(state.draft.title);
    setModalProjectInput(state.draft.project ?? '');
    setModalStartInput(formatDateTimeLocal(state.draft.startedAt));
    setModalEndInput('');
  }, [state]);

  const handleEditHistory = useCallback(
    (sessionId: string) => {
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) return;
      setModalState({ type: 'history', sessionId: target.id });
      setModalTitleInput(target.title);
      setModalProjectInput(target.project ?? '');
      setModalStartInput(formatDateTimeLocal(target.startedAt));
      setModalEndInput(formatDateTimeLocal(target.endedAt));
    },
    [sessions],
  );

  const handleDeleteHistory = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const index = prev.findIndex((session) => session.id === sessionId);
        if (index === -1) return prev;
        const next = [...prev];
        const [removed] = next.splice(index, 1);
        setUndoState({ session: removed, index });
        return next;
      });
      if (
        modalState?.type === 'history' &&
        modalState.sessionId === sessionId
      ) {
        closeModal();
      }
    },
    [closeModal, modalState],
  );

  const handleUndo = useCallback(() => {
    setUndoState((current) => {
      if (!current) return null;
      setSessions((prev) => {
        const next = [...prev];
        const insertIndex = Math.min(current.index, next.length);
        next.splice(insertIndex, 0, current.session);
        return next;
      });
      return null;
    });
  }, []);

  const handleModalSave = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!modalState) return;
      const trimmedTitle = modalTitleInput.trim();
      if (!trimmedTitle) {
        return;
      }
      const trimmedProject = modalProjectInput.trim();

      if (modalState.type === 'running') {
        if (state.status !== 'running') {
          closeModal();
          return;
        }
        updateDraft({
          title: trimmedTitle,
        });
        handleComposerProjectChange(trimmedProject);
        const parsedStart = parseDateTimeLocal(modalStartInput);
        if (parsedStart !== null) {
          const nowMs = Date.now();
          const clampedStart = Math.min(parsedStart, nowMs);
          const newDuration = Math.max(
            0,
            Math.floor((nowMs - clampedStart) / 1000),
          );
          const deltaSeconds = newDuration - state.elapsedSeconds;
          if (deltaSeconds !== 0) {
            adjustDuration(deltaSeconds);
          }
        }
        closeModal();
        return;
      }

      const target = sessions.find(
        (session) => session.id === modalState.sessionId,
      );
      if (!target) {
        closeModal();
        return;
      }

      const parsedStart = parseDateTimeLocal(modalStartInput);
      const parsedEnd = parseDateTimeLocal(modalEndInput);
      if (parsedStart === null || parsedEnd === null) {
        return;
      }
      const clampedEnd = Math.max(parsedEnd, parsedStart);
      const durationSeconds = Math.max(
        1,
        Math.floor((clampedEnd - parsedStart) / 1000),
      );

      const nextSession: TimeTrackerSession = {
        ...target,
        title: trimmedTitle,
        project: trimmedProject || undefined,
        startedAt: parsedStart,
        endedAt: clampedEnd,
        durationSeconds,
      };

      setSessions((prev) =>
        prev.map((session) =>
          session.id === target.id ? nextSession : session,
        ),
      );
      closeModal();
    },
    [
      adjustDuration,
      closeModal,
      modalEndInput,
      modalProjectInput,
      modalStartInput,
      modalState,
      modalTitleInput,
      sessions,
      state.elapsedSeconds,
      state.status,
      handleComposerProjectChange,
      updateDraft,
    ],
  );

  const modalSaveDisabled = useMemo(() => {
    if (!modalState) return true;
    if (modalTitleInput.trim().length === 0) return true;
    const parsedStart = parseDateTimeLocal(modalStartInput);
    if (modalState.type === 'running') {
      return parsedStart === null;
    }
    const parsedEnd = parseDateTimeLocal(modalEndInput);
    if (parsedStart === null || parsedEnd === null) return true;
    if (parsedEnd < parsedStart) return true;
    return false;
  }, [modalEndInput, modalStartInput, modalState, modalTitleInput]);

  return (
    <main className="time-tracker">
      <div className="time-tracker__panel">
        <header className="time-tracker__header">
          <h1>Time Tracker</h1>
          <p>何をやりますか？</p>
        </header>

        <Composer
          sessions={sessions}
          project={composerProject}
          onProjectChange={handleComposerProjectChange}
          isRunning={state.status === 'running'}
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
          title={modalTitleInput}
          project={modalProjectInput}
          startTime={modalStartInput}
          endTime={modalEndInput}
          saveDisabled={modalSaveDisabled}
          onTitleChange={setModalTitleInput}
          onProjectChange={setModalProjectInput}
          onStartTimeChange={setModalStartInput}
          onEndTimeChange={setModalEndInput}
          onSave={handleModalSave}
          onCancel={closeModal}
        />
      ) : null}
    </main>
  );
}
