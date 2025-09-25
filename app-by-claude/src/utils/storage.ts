import type { Session, TimerState } from '../types/session'

export const STORAGE_KEYS = {
  SESSIONS: 'time-tracker-sessions',
  TIMER_STATE: 'time-tracker-state',
} as const

/**
 * Save a session to localStorage
 * If session with same ID exists, it will be updated
 */
export function saveSession(session: Session): void {
  try {
    const existingSessions = loadSessions()
    const sessionIndex = existingSessions.findIndex(s => s.id === session.id)

    if (sessionIndex >= 0) {
      existingSessions[sessionIndex] = session
    } else {
      existingSessions.push(session)
    }

    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(existingSessions))
  } catch (error) {
    console.error('Failed to save session:', error)
  }
}

/**
 * Load all sessions from localStorage
 */
export function loadSessions(): Session[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    if (!stored) return []

    const sessions = JSON.parse(stored) as Session[]

    // Convert date strings back to Date objects
    return sessions.map(session => ({
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : undefined,
    }))
  } catch (error) {
    console.error('Failed to load sessions:', error)
    return []
  }
}

/**
 * Save timer state to localStorage
 */
export function saveTimerState(state: TimerState): void {
  try {
    // Create a serializable copy of the state
    const serializableState = {
      ...state,
      currentSession: state.currentSession ? {
        ...state.currentSession,
        startTime: state.currentSession.startTime.toISOString(),
        endTime: state.currentSession.endTime?.toISOString(),
      } : null,
      sessions: state.sessions.map(session => ({
        ...session,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime?.toISOString(),
      })),
    }

    localStorage.setItem(STORAGE_KEYS.TIMER_STATE, JSON.stringify(serializableState))
  } catch (error) {
    console.error('Failed to save timer state:', error)
  }
}

/**
 * Load timer state from localStorage
 */
export function loadTimerState(): TimerState {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TIMER_STATE)
    if (!stored) {
      return getDefaultTimerState()
    }

    const parsedState = JSON.parse(stored)

    // Convert date strings back to Date objects
    return {
      ...parsedState,
      currentSession: parsedState.currentSession ? {
        ...parsedState.currentSession,
        startTime: new Date(parsedState.currentSession.startTime),
        endTime: parsedState.currentSession.endTime
          ? new Date(parsedState.currentSession.endTime)
          : undefined,
      } : null,
      sessions: parsedState.sessions.map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined,
      })),
    }
  } catch (error) {
    console.error('Failed to load timer state:', error)
    return getDefaultTimerState()
  }
}

/**
 * Get default timer state
 */
function getDefaultTimerState(): TimerState {
  return {
    currentSession: null,
    sessions: [],
    status: 'completed',
    elapsedTime: 0,
  }
}

/**
 * Clear all storage data
 */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSIONS)
    localStorage.removeItem(STORAGE_KEYS.TIMER_STATE)
  } catch (error) {
    console.error('Failed to clear storage:', error)
  }
}

/**
 * Get storage size information
 */
export function getStorageInfo(): { used: number; total: number; percentage: number } {
  try {
    let totalSize = 0
    let usedSize = 0

    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        usedSize += localStorage[key].length + key.length
      }
    }

    // Most browsers support 5MB for localStorage
    const maxSize = 5 * 1024 * 1024 // 5MB in bytes

    return {
      used: usedSize,
      total: maxSize,
      percentage: Math.round((usedSize / maxSize) * 100)
    }
  } catch (error) {
    console.error('Failed to get storage info:', error)
    return { used: 0, total: 0, percentage: 0 }
  }
}