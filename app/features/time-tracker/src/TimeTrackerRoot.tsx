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

const RUNNING_TIMER_ID = 'time-tracker-running-timer';

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

const formatDurationForAria = (seconds: number) => {
  if (seconds <= 0) return '0秒';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}時間`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (parts.length === 0 || remainingSeconds > 0) {
    parts.push(`${remainingSeconds}秒`);
  }
  return parts.join('');
};

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

const createNudgeLabel = (deltaMinutes: number) =>
  deltaMinutes > 0
    ? `経過時間を${deltaMinutes}分延長`
    : `経過時間を${Math.abs(deltaMinutes)}分短縮`;

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
  const [composerProject, setComposerProject] = useState(
    () =>
      initialRunningStateRef.current?.status === 'running'
        ? initialRunningStateRef.current.draft.project ?? ''
        : '',
  );
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const [undoState, setUndoState] = useState<
    { session: TimeTrackerSession; index: number } | null
  >(null);
  const [modalState, setModalState] = useState<EditorModalState | null>(null);
  const [modalTitleInput, setModalTitleInput] = useState('');
  const [modalProjectInput, setModalProjectInput] = useState('');
  const [modalStartInput, setModalStartInput] = useState('');
  const [modalEndInput, setModalEndInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectSearchRef = useRef<HTMLInputElement>(null);
  const pendingProjectRef = useRef<string | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const projectMenuPrevOpenRef = useRef(false);

  const { state, start, stop, updateDraft, adjustDuration } = useRunningSession({
    initialState: initialRunningStateRef.current ?? undefined,
  });
  const isRunning = state.status === 'running';
  const elapsedSeconds = state.elapsedSeconds;
  const runningDraftTitle = state.status === 'running' ? state.draft.title : null;
  const runningProject = state.status === 'running' ? state.draft.project ?? '' : '';

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
    if (!isProjectMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !projectMenuRef.current?.contains(target) &&
        !projectTriggerRef.current?.contains(target)
      ) {
        setIsProjectMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProjectMenuOpen(false);
        projectTriggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProjectMenuOpen]);

  useEffect(() => {
    if (!isProjectMenuOpen) return;
    setProjectQuery(composerProject);
    const frame = window.requestAnimationFrame(() => {
      projectSearchRef.current?.focus();
      projectSearchRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [composerProject, isProjectMenuOpen]);

  useEffect(() => {
    if (!isProjectMenuOpen && projectMenuPrevOpenRef.current) {
      projectTriggerRef.current?.focus();
    }
    projectMenuPrevOpenRef.current = isProjectMenuOpen;
  }, [isProjectMenuOpen]);

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

  useEffect(() => {
    if (state.status === 'running') {
      if (pendingProjectRef.current !== null) {
        const value = pendingProjectRef.current.trim();
        pendingProjectRef.current = null;
        updateDraft({ project: value || undefined });
        setComposerProject(value);
      } else {
        setComposerProject(runningProject);
      }
    }
  }, [runningProject, state.status, updateDraft]);

  const canStart = useMemo(
    () => inputValue.trim().length > 0 && !isRunning,
    [inputValue, isRunning],
  );

  const handleStart = useCallback(() => {
    if (!canStart) return;
    pendingProjectRef.current = composerProject;
    setIsProjectMenuOpen(false);
    const started = start(inputValue);
    if (started) {
      setInputValue('');
    }
    setUndoState(null);
  }, [canStart, composerProject, inputValue, start]);

  const handleStop = useCallback(() => {
    const titleForInput = runningDraftTitle;
    const session = stop();
    if (!session) return;
    if (titleForInput) {
      setInputValue(titleForInput);
    }
    setSessions((prev) => [session, ...prev]);
    setComposerProject(session.project ?? '');
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
  const projectButtonLabel = composerProject || 'プロジェクト';

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
      setComposerProject(trimmedProject);
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

  const projectSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const add = (value?: string | null) => {
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
    };
    if (composerProject) {
      add(composerProject);
    }
    add(runningProject);
    sessions.forEach((session) => add(session.project));
    return Array.from(seen).slice(0, 12);
  }, [composerProject, runningProject, sessions]);

  const filteredProjectSuggestions = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) {
      return projectSuggestions;
    }
    return projectSuggestions.filter((project) =>
      project.toLowerCase().includes(query),
    );
  }, [projectQuery, projectSuggestions]);

  const trimmedProjectQuery = projectQuery.trim();

  const applyProject = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      setComposerProject(trimmed);
      setProjectQuery(trimmed);
      if (state.status === 'running') {
        updateDraft({ project: trimmed || undefined });
      }
      setIsProjectMenuOpen(false);
      projectTriggerRef.current?.focus();
    },
    [state.status, updateDraft],
  );

  const handleProjectSubmit = useCallback(() => {
    applyProject(trimmedProjectQuery);
  }, [applyProject, trimmedProjectQuery]);

  const handleProjectInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.metaKey || event.ctrlKey) {
          handleProjectSubmit();
          return;
        }
        if (filteredProjectSuggestions.length > 0) {
          applyProject(filteredProjectSuggestions[0]);
        } else {
          handleProjectSubmit();
        }
      }
    },
    [applyProject, filteredProjectSuggestions, handleProjectSubmit],
  );

  const handleProjectMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Tab' || !projectMenuRef.current) return;
      const focusable = Array.from(
        projectMenuRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        projectMenuRef.current.focus();
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

  return (
    <main className="time-tracker">
      <div className="time-tracker__panel">
        <header className="time-tracker__header">
          <h1>Time Tracker</h1>
          <p>何をやりますか？</p>
        </header>

        <div className="time-tracker__composer">
          <div className="time-tracker__project-control">
            <button
              ref={projectTriggerRef}
              type="button"
              className="time-tracker__project-button"
              onClick={() => setIsProjectMenuOpen((prev) => !prev)}
              aria-haspopup="dialog"
              aria-expanded={isProjectMenuOpen}
              aria-controls="time-tracker-project-menu"
              title="プロジェクトを選択"
              aria-label={
                composerProject
                  ? `プロジェクト: ${composerProject}`
                  : 'プロジェクトを選択'
              }
            >
              <span className="time-tracker__project-icon" aria-hidden="true">
                ＃
              </span>
              <span className="time-tracker__project-label">{projectButtonLabel}</span>
            </button>
            {isProjectMenuOpen ? (
              <div
                id="time-tracker-project-menu"
                className="time-tracker__project-popover"
                ref={projectMenuRef}
                role="dialog"
                aria-label="プロジェクトを選択"
                aria-modal="true"
                tabIndex={-1}
                onKeyDown={handleProjectMenuKeyDown}
              >
                <label className="time-tracker__sr-only" htmlFor="project-search">
                  プロジェクトを検索・設定
                </label>
                <div className="time-tracker__project-search">
                  <span className="time-tracker__project-search-icon" aria-hidden="true">
                    🔍
                  </span>
                  <input
                    id="project-search"
                    ref={projectSearchRef}
                    className="time-tracker__project-input"
                    type="text"
                    placeholder="プロジェクト、タスク、クライアントを検索"
                    value={projectQuery}
                    onChange={(event) => setProjectQuery(event.target.value)}
                    onKeyDown={handleProjectInputKeyDown}
                    autoComplete="off"
                  />
                </div>
                {filteredProjectSuggestions.length > 0 ? (
                  <>
                    <p className="time-tracker__project-section">最近使ったプロジェクト</p>
                    <ul className="time-tracker__project-list">
                      {filteredProjectSuggestions.map((project) => (
                        <li key={project}>
                          <button
                            type="button"
                            onClick={() => applyProject(project)}
                            className="time-tracker__project-list-item"
                          >
                            #{project}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="time-tracker__project-empty">
                    <p>一致するプロジェクトがありません</p>
                    <p className="time-tracker__project-hint">⌘Enter で新しいプロジェクトを作成できます</p>
                  </div>
                )}
                <div className="time-tracker__project-actions">
                  <button type="button" onClick={handleProjectSubmit}>
                    {trimmedProjectQuery.length > 0
                      ? `＋ 「${trimmedProjectQuery}」を作成`
                      : 'プロジェクトを未設定にする'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
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
            <span className="time-tracker__timer" id={RUNNING_TIMER_ID}>
              {timerLabel}
            </span>
          </div>
        ) : null}

        <div className="time-tracker__details">
          {isRunning ? (
            <div
              className="time-tracker__nudges"
              role="group"
              aria-label="作業時間の調整"
              aria-describedby={RUNNING_TIMER_ID}
            >
              <button
                type="button"
                onClick={() => handleNudge(-10)}
                aria-label={createNudgeLabel(-10)}
              >
                -10分
              </button>
              <button
                type="button"
                onClick={() => handleNudge(-5)}
                aria-label={createNudgeLabel(-5)}
              >
                -5分
              </button>
              <button
                type="button"
                onClick={() => handleNudge(5)}
                aria-label={createNudgeLabel(5)}
              >
                +5分
              </button>
              <button
                type="button"
                onClick={() => handleNudge(10)}
                aria-label={createNudgeLabel(10)}
              >
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
                        <span>{session.tags.map((tag) => `#${tag}`).join(' ')}</span>
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
