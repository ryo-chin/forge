import { create } from 'zustand'
import type { Session, TimerState, CreateSessionInput, SessionStatus } from '../types/session'
import { generateSessionId, calculateElapsedTime, calculateDuration } from '../utils/timer'

interface TimerActions {
  startSession: (input: CreateSessionInput) => void
  pauseSession: () => void
  resumeSession: () => void
  endSession: () => void
  updateCurrentSession: (updates: Partial<Omit<Session, 'id' | 'startTime' | 'isActive'>>) => void
  updateElapsedTime: () => void
  adjustStartTime: (newStartTime: Date) => void
  deleteSession: (sessionId: string) => void
  clearAllSessions: () => void
}

export const useTimerStore = create<TimerState & TimerActions>((set, get) => ({
  // State
  currentSession: null,
  sessions: [],
  status: 'completed',
  elapsedTime: 0,

  // Actions
  startSession: (input: CreateSessionInput) => {
    const { currentSession, endSession } = get()

    // End current session if exists
    if (currentSession) {
      endSession()
    }

    const newSession: Session = {
      id: generateSessionId(),
      taskName: input.taskName,
      startTime: input.startTime || new Date(),
      tags: input.tags,
      project: input.project,
      skill: input.skill,
      isActive: true,
    }

    set((state) => ({
      currentSession: newSession,
      sessions: [...state.sessions, newSession],
      status: 'active' as SessionStatus,
      elapsedTime: 0,
    }))
  },

  pauseSession: () => {
    const { currentSession } = get()
    if (!currentSession) return

    set({ status: 'paused' as SessionStatus })
  },

  resumeSession: () => {
    const { status } = get()
    if (status !== 'paused') return

    set({ status: 'active' as SessionStatus })
  },

  endSession: () => {
    const { currentSession } = get()
    if (!currentSession) return

    const endTime = new Date()
    const duration = calculateDuration(currentSession.startTime, endTime)

    const completedSession: Session = {
      ...currentSession,
      endTime,
      duration,
      isActive: false,
    }

    set((state) => ({
      currentSession: null,
      sessions: state.sessions.map((session) =>
        session.id === currentSession.id ? completedSession : session
      ),
      status: 'completed' as SessionStatus,
      elapsedTime: 0,
    }))
  },

  updateCurrentSession: (updates) => {
    const { currentSession } = get()
    if (!currentSession) return

    const updatedSession = { ...currentSession, ...updates }

    set((state) => ({
      currentSession: updatedSession,
      sessions: state.sessions.map((session) =>
        session.id === currentSession.id ? updatedSession : session
      ),
    }))
  },

  updateElapsedTime: () => {
    const { currentSession, status } = get()
    if (!currentSession || status !== 'active') return

    const elapsedTime = calculateElapsedTime(currentSession.startTime)

    set({ elapsedTime })
  },

  adjustStartTime: (newStartTime: Date) => {
    const { currentSession } = get()
    if (!currentSession) return

    const updatedSession = { ...currentSession, startTime: newStartTime }

    set((state) => ({
      currentSession: updatedSession,
      sessions: state.sessions.map((session) =>
        session.id === currentSession.id ? updatedSession : session
      ),
    }))
  },

  deleteSession: (sessionId: string) => {
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== sessionId),
      currentSession:
        state.currentSession?.id === sessionId ? null : state.currentSession,
      status:
        state.currentSession?.id === sessionId
          ? ('completed' as SessionStatus)
          : state.status,
    }))
  },

  clearAllSessions: () => {
    set({
      currentSession: null,
      sessions: [],
      status: 'completed' as SessionStatus,
      elapsedTime: 0,
    })
  },
}))