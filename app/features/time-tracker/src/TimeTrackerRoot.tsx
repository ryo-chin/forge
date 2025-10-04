import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import { useTimeTrackerStorage } from '@features/time-tracker/hooks/data/useTimeTrackerStorage';
import { formatDateTimeLocal, parseDateTimeLocal } from '@lib/date';
import { formatDurationForAria, formatTimer } from '@lib/time';
import { useRunningSession } from './hooks/useRunningSession';
import type { TimeTrackerSession } from './types';
import { Composer } from '@features/time-tracker/components/Composer/Composer.tsx';

const RUNNING_TIMER_ID = 'time-tracker-running-timer';

const describeHistorySession = (session: TimeTrackerSession) => {
  const parts = [
    `タイトル ${session.title}`,
    `所要時間 ${formatDurationForAria(session.durationSeconds)}`,
  ];
  if (session.project) parts.push(`プロジェクト ${session.project}`);
  if (session.tags?.length) parts.push(`タグ ${session.tags.join('、')}`);
  if (session.skill) parts.push(`スキル ${session.skill}`);
  return parts.join('、');
};

export function TimeTrackerRoot() {
  const {
    initialSessions,
    initialRunningState,
    persistSessions,
    persistRunningState,
  } = useTimeTrackerStorage();
  type EditorModalState =
    | { type: 'running' }
    | { type: 'history'; sessionId: string };

  const [sessions, setSessions] = useState<TimeTrackerSession[]>(
    () => initialSessions,
  );
  const [undoState, setUndoState] = useState<{
    session: TimeTrackerSession;
    index: number;
  } | null>(null);
  const [modalState, setModalState] = useState<EditorModalState | null>(null);
  const [modalTitleInput, setModalTitleInput] = useState('');
  const [modalProjectInput, setModalProjectInput] = useState('');
  const [modalStartInput, setModalStartInput] = useState('');
  const [modalEndInput, setModalEndInput] = useState('');
  const modalContainerRef = useRef<HTMLDivElement>(null);
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
      const focusTarget =
        modalContainerRef.current?.querySelector<HTMLElement>(
          '[data-autofocus="true"], input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
        ) ?? modalContainerRef.current;
      focusTarget?.focus();
      return;
    }
    const previous = previousFocusRef.current;
    if (previous && typeof previous.focus === 'function') {
      previous.focus();
    }
    previousFocusRef.current = null;
  }, [modalState]);

  useEffect(() => {
    if (!modalState) return;
    if (typeof window === 'undefined') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal, modalState]);

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

  const handleModalKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Tab' || !modalContainerRef.current) return;
      const focusable = Array.from(
        modalContainerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        modalContainerRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    },
    [],
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

        {sessions.length > 0 ? (
          <section className="time-tracker__history" aria-label="最近の記録">
            <h2>最近の記録</h2>
            <ul>
              {sessions.map((session) => {
                const titleId = `history-session-${session.id}-title`;
                const descriptionId = `history-session-${session.id}-description`;
                return (
                  <li
                    key={session.id}
                    className="time-tracker__history-item"
                    aria-labelledby={titleId}
                    aria-describedby={descriptionId}
                  >
                    <span className="time-tracker__sr-only" id={descriptionId}>
                      {describeHistorySession(session)}
                    </span>
                    <div className="time-tracker__history-main">
                      <strong id={titleId}>{session.title}</strong>
                      <span>{formatTimer(session.durationSeconds)}</span>
                    </div>
                    <div className="time-tracker__history-meta">
                      {session.project ? <span>#{session.project}</span> : null}
                      {session.tags?.length ? (
                        <span>
                          {session.tags.map((tag) => `#${tag}`).join(' ')}
                        </span>
                      ) : null}
                      {session.skill ? <span>@{session.skill}</span> : null}
                    </div>
                    <div className="time-tracker__history-actions">
                      <button
                        type="button"
                        className="time-tracker__history-button"
                        onClick={() => handleEditHistory(session.id)}
                        aria-label={`「${session.title}」を編集`}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className="time-tracker__history-button time-tracker__history-button--danger"
                        onClick={() => handleDeleteHistory(session.id)}
                        aria-label={`「${session.title}」を削除`}
                      >
                        削除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
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
        <div className="time-tracker__modal-backdrop" role="presentation">
          <div
            ref={modalContainerRef}
            className="time-tracker__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-editor-title"
            tabIndex={-1}
            onKeyDown={handleModalKeyDown}
          >
            <h2 id="session-editor-title">
              {modalState.type === 'history'
                ? '記録を編集'
                : '計測中の詳細を編集'}
            </h2>
            <form
              className="time-tracker__modal-form"
              onSubmit={handleModalSave}
            >
              <div className="time-tracker__field">
                <label htmlFor="modal-title">タイトル</label>
                <input
                  id="modal-title"
                  type="text"
                  value={modalTitleInput}
                  onChange={(event) => setModalTitleInput(event.target.value)}
                  autoComplete="off"
                  data-autofocus="true"
                />
              </div>
              <div className="time-tracker__field">
                <label htmlFor="modal-project">プロジェクト</label>
                <input
                  id="modal-project"
                  type="text"
                  value={modalProjectInput}
                  onChange={(event) => setModalProjectInput(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="time-tracker__field">
                <label htmlFor="modal-start">開始時刻</label>
                <input
                  id="modal-start"
                  type="datetime-local"
                  value={modalStartInput}
                  onChange={(event) => setModalStartInput(event.target.value)}
                />
              </div>
              {modalState.type === 'history' ? (
                <div className="time-tracker__field">
                  <label htmlFor="modal-end">終了時刻</label>
                  <input
                    id="modal-end"
                    type="datetime-local"
                    value={modalEndInput}
                    onChange={(event) => setModalEndInput(event.target.value)}
                  />
                </div>
              ) : null}
              <div className="time-tracker__modal-actions">
                <button type="button" onClick={closeModal}>
                  キャンセル
                </button>
                <button type="submit" disabled={modalSaveDisabled}>
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
