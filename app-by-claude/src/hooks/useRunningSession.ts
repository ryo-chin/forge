import { useEffect } from 'react'
import { useTimerStore } from '../stores/timer'
import type { Session } from '../types/session'

export interface RunningSessionData {
  session: Session | null
  elapsedTime: number
  isActive: boolean
  isPaused: boolean
  isCompleted: boolean
  formattedTime: string
}

export interface RunningSessionActions {
  pause: () => void
  resume: () => void
  stop: () => void
  updateSession: (updates: Partial<Pick<Session, 'taskName' | 'tags' | 'project' | 'skill' | 'startTime'>>) => void
  adjustWorkTime: (minutes: number) => void
}

/**
 * Custom hook for managing running session state and actions
 */
export function useRunningSession(): RunningSessionData & RunningSessionActions {
  const {
    currentSession,
    status,
    elapsedTime,
    pauseSession,
    resumeSession,
    endSession,
    updateCurrentSession,
    updateElapsedTime,
    adjustStartTime,
  } = useTimerStore()

  // Update elapsed time every second for active sessions
  useEffect(() => {
    if (!currentSession || status !== 'active') return

    // Initial update
    updateElapsedTime()

    const interval = setInterval(() => {
      updateElapsedTime()
    }, 1000)

    return () => clearInterval(interval)
  }, [currentSession, status, updateElapsedTime])

  // Format time helper
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return {
    // Data
    session: currentSession,
    elapsedTime,
    isActive: status === 'active',
    isPaused: status === 'paused',
    isCompleted: status === 'completed',
    formattedTime: formatTime(elapsedTime),

    // Actions
    pause: pauseSession,
    resume: resumeSession,
    stop: endSession,
    updateSession: updateCurrentSession,
    adjustWorkTime: (minutes: number) => {
      if (currentSession) {
        const adjustmentMs = minutes * 60 * 1000
        const newStartTime = new Date(currentSession.startTime.getTime() - adjustmentMs)
        adjustStartTime(newStartTime)
      }
    },
  }
}