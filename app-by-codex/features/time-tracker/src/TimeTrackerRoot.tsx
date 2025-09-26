import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import { useRunningSession } from './hooks/useRunningSession';
import type { RunningSessionState, TimeTrackerSession } from './types';

const STORAGE_KEY_SESSIONS = 'codex-time-tracker/sessions';
const STORAGE_KEY_RUNNING = 'codex-time-tracker/running';
const INTENSITY_VALUES = new Set<'low' | 'medium' | 'high'>([
  'low',
  'medium',
  'high',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const parseTagsArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .filter((item): item is string => typeof item === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
};

const parseIntensity = (value: unknown) =>
  typeof value === 'string' && INTENSITY_VALUES.has(value as 'low' | 'medium' | 'high')
    ? (value as 'low' | 'medium' | 'high')
    : undefined;

const parseSession = (value: unknown): TimeTrackerSession | null => {
  if (!isRecord(value)) return null;
  const { id, title, startedAt, endedAt, durationSeconds } = value;
  if (typeof id !== 'string' || typeof title !== 'string') return null;
  if (
    typeof startedAt !== 'number' ||
    Number.isNaN(startedAt) ||
    typeof endedAt !== 'number' ||
    Number.isNaN(endedAt) ||
    typeof durationSeconds !== 'number' ||
    Number.isNaN(durationSeconds)
  ) {
    return null;
  }
  const session: TimeTrackerSession = {
    id,
    title,
    startedAt,
    endedAt,
    durationSeconds,
  };

  const tags = parseTagsArray(value.tags);
  if (tags) session.tags = tags;
  const project = parseOptionalString(value.project);
  if (project) session.project = project;
  const skill = parseOptionalString(value.skill);
  if (skill) session.skill = skill;
  const notes = parseOptionalString(value.notes);
  if (notes) session.notes = notes;
  const intensity = parseIntensity(value.intensity);
  if (intensity) session.intensity = intensity;

  return session;
};

const loadStoredSessions = (): TimeTrackerSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => parseSession(entry))
      .filter((entry): entry is TimeTrackerSession => entry !== null);
  } catch (error) {
    console.warn('Failed to load stored sessions', error);
    return [];
  }
};

const loadStoredRunningState = (
  now: () => number,
): RunningSessionState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RUNNING);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.status !== 'running') return null;
    if (!isRecord(parsed.draft)) return null;
    const draftRecord = parsed.draft;
    if (typeof draftRecord.title !== 'string') return null;
    if (typeof draftRecord.startedAt !== 'number' || Number.isNaN(draftRecord.startedAt)) {
      return null;
    }
    const draft = {
      title: draftRecord.title,
      startedAt: draftRecord.startedAt,
      tags: parseTagsArray(draftRecord.tags),
      project: parseOptionalString(draftRecord.project),
      skill: parseOptionalString(draftRecord.skill),
      notes: parseOptionalString(draftRecord.notes),
      intensity: parseIntensity(draftRecord.intensity),
    };
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now() - draft.startedAt) / 1000),
    );
    return {
      status: 'running',
      draft,
      elapsedSeconds,
    };
  } catch (error) {
    console.warn('Failed to load running session', error);
    return null;
  }
};

const formatDateTimeLocal = (timestamp: number) => {
  const date = new Date(timestamp);
  const tzOffsetMinutes = date.getTimezoneOffset();
  const local = new Date(timestamp - tzOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
};

const parseDateTimeLocal = (value: string): number | null => {
  if (!value) return null;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time;
};

const formatTimer = (seconds: number) => {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
};

export function TimeTrackerRoot() {
  const initialSessionsRef = useRef<TimeTrackerSession[] | null>(null);
  if (initialSessionsRef.current === null) {
    initialSessionsRef.current = loadStoredSessions();
  }
  const initialRunningStateRef = useRef<RunningSessionState | null | undefined>(
    undefined,
  );
  if (initialRunningStateRef.current === undefined) {
    initialRunningStateRef.current = loadStoredRunningState(() => Date.now());
  }
  type EditorModalState =
    | { type: 'running' }
    | { type: 'history'; sessionId: string };

  const [inputValue, setInputValue] = useState('');
  const [sessions, setSessions] = useState<TimeTrackerSession[]>(
    () => initialSessionsRef.current ?? [],
  );
  const [undoState, setUndoState] = useState<
    { session: TimeTrackerSession; index: number } | null
  >(null);
  const [modalState, setModalState] = useState<EditorModalState | null>(null);
  const [modalTitleInput, setModalTitleInput] = useState('');
  const [modalProjectInput, setModalProjectInput] = useState('');
  const [modalStartInput, setModalStartInput] = useState('');
  const [modalEndInput, setModalEndInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { state, start, stop, updateDraft, adjustDuration } = useRunningSession({
    initialState: initialRunningStateRef.current ?? undefined,
  });
  const isRunning = state.status === 'running';
  const elapsedSeconds = state.elapsedSeconds;
  const runningDraftTitle = state.status === 'running' ? state.draft.title : null;

  const closeModal = useCallback(() => {
    setModalState(null);
    setModalTitleInput('');
    setModalProjectInput('');
    setModalStartInput('');
    setModalEndInput('');
  }, []);

  useEffect(() => {
    const handleFocusShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleFocusShortcut);
    return () => window.removeEventListener('keydown', handleFocusShortcut);
  }, []);

  useEffect(() => {
    if (modalState?.type === 'running' && state.status !== 'running') {
      closeModal();
    }
  }, [modalState, state.status, closeModal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessions.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY_SESSIONS);
      } else {
        window.localStorage.setItem(
          STORAGE_KEY_SESSIONS,
          JSON.stringify(sessions),
        );
      }
    } catch (error) {
      console.warn('Failed to persist sessions', error);
    }
  }, [sessions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (state.status === 'running') {
        window.localStorage.setItem(
          STORAGE_KEY_RUNNING,
          JSON.stringify({
            status: 'running',
            draft: state.draft,
          }),
        );
      } else {
        window.localStorage.removeItem(STORAGE_KEY_RUNNING);
      }
    } catch (error) {
      console.warn('Failed to persist running session', error);
    }
  }, [state]);

  const canStart = useMemo(
    () => inputValue.trim().length > 0 && !isRunning,
    [inputValue, isRunning],
  );

  const handleStart = useCallback(() => {
    if (!canStart) return;
    const started = start(inputValue);
    if (started) {
      setInputValue('');
    }
    setUndoState(null);
  }, [canStart, inputValue, start]);

  const handleStop = useCallback(() => {
    const titleForInput = runningDraftTitle;
    const session = stop();
    if (!session) return;
    if (titleForInput) {
      setInputValue(titleForInput);
    }
    setSessions((prev) => [session, ...prev]);
    setUndoState(null);
  }, [runningDraftTitle, stop]);

  const handlePrimaryAction = useCallback(() => {
    if (isRunning) {
      handleStop();
    } else {
      handleStart();
    }
  }, [handleStart, handleStop, isRunning]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        const nativeEvent = event.nativeEvent;
        const isNativeComposing =
          (nativeEvent as { isComposing?: boolean }).isComposing === true;
        const isImeKey =
          (nativeEvent as { keyCode?: number }).keyCode === 229;
        if (isNativeComposing || isImeKey) {
          return;
        }
        event.preventDefault();
        handlePrimaryAction();
      }
    },
    [handlePrimaryAction],
  );

  const displayInputValue = isRunning
    ? runningDraftTitle ?? ''
    : inputValue;
  const primaryLabel = isRunning ? '停止' : '開始';
  const primaryDisabled = !isRunning && !canStart;
  const timerLabel = formatTimer(elapsedSeconds);

  const handleNudge = useCallback(
    (minutes: number) => {
      const deltaSeconds = minutes * 60;
      adjustDuration(deltaSeconds);
    },
    [adjustDuration],
  );

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
      if (modalState?.type === 'history' && modalState.sessionId === sessionId) {
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
          project: trimmedProject || undefined,
        });
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

      const target = sessions.find((session) => session.id === modalState.sessionId);
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
      state,
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

        <div className="time-tracker__composer">
          <input
            ref={inputRef}
            className="time-tracker__input"
            type="text"
            autoFocus
            placeholder="何をやる？"
            value={displayInputValue}
            onChange={(event) => {
              if (isRunning) return;
              setInputValue(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            aria-label="取り組む内容"
          />
          <button
            type="button"
            className="time-tracker__action"
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </button>
        </div>

        <div className="time-tracker__hints">
          <span>
            <kbd>Enter</kbd> で{isRunning ? '停止' : '開始'}
          </span>
          <span className="time-tracker__dot">·</span>
          <span>
            <kbd>⌘K</kbd> でフォーカス
          </span>
        </div>

        {isRunning ? (
          <div className="time-tracker__status" aria-live="polite">
            <span>計測中</span>
            <span className="time-tracker__timer">{timerLabel}</span>
          </div>
        ) : null}

        <div className="time-tracker__details">
          {isRunning ? (
            <div className="time-tracker__nudges" role="group" aria-label="作業時間の調整">
              <button type="button" onClick={() => handleNudge(-10)}>
                -10分
              </button>
              <button type="button" onClick={() => handleNudge(-5)}>
                -5分
              </button>
              <button type="button" onClick={() => handleNudge(5)}>
                +5分
              </button>
              <button type="button" onClick={() => handleNudge(10)}>
                +10分
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="time-tracker__details-toggle"
            onClick={openRunningEditor}
            disabled={!isRunning}
            aria-expanded={modalState?.type === 'running'}
          >
            詳細編集
          </button>
        </div>

        {sessions.length > 0 ? (
          <section className="time-tracker__history" aria-label="最近の記録">
            <h2>最近の記録</h2>
            <ul>
              {sessions.map((session) => (
                <li key={session.id} className="time-tracker__history-item">
                  <div className="time-tracker__history-main">
                    <strong>{session.title}</strong>
                    <span>{formatTimer(session.durationSeconds)}</span>
                  </div>
                  <div className="time-tracker__history-meta">
                    {session.project ? <span>#{session.project}</span> : null}
                    {session.tags?.length ? (
                      <span>{session.tags.map((tag) => `#${tag}`).join(' ')}</span>
                    ) : null}
                    {session.skill ? <span>@{session.skill}</span> : null}
                  </div>
                  <div className="time-tracker__history-actions">
                    <button
                      type="button"
                      className="time-tracker__history-button"
                      onClick={() => handleEditHistory(session.id)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="time-tracker__history-button time-tracker__history-button--danger"
                      onClick={() => handleDeleteHistory(session.id)}
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
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
        <div
          className="time-tracker__modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-editor-title"
        >
          <div className="time-tracker__modal">
            <h2 id="session-editor-title">
              {modalState.type === 'history' ? '記録を編集' : '計測中の詳細を編集'}
            </h2>
            <form className="time-tracker__modal-form" onSubmit={handleModalSave}>
              <div className="time-tracker__field">
                <label htmlFor="modal-title">タイトル</label>
                <input
                  id="modal-title"
                  type="text"
                  value={modalTitleInput}
                  onChange={(event) => setModalTitleInput(event.target.value)}
                  autoComplete="off"
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
