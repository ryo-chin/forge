import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveSession,
  loadSessions,
  saveTimerState,
  loadTimerState,
  clearStorage,
  STORAGE_KEYS
} from '../storage'
import type { Session, TimerState } from '../../types/session'

describe('Storage Utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('saveSession and loadSessions', () => {
    it('should save and load a single session', () => {
      const session: Session = {
        id: 'test-1',
        taskName: 'Test Task',
        startTime: new Date('2025-01-01T10:00:00Z'),
        endTime: new Date('2025-01-01T11:00:00Z'),
        duration: 3600000,
        isActive: false
      }

      saveSession(session)
      const loadedSessions = loadSessions()

      expect(loadedSessions).toHaveLength(1)
      expect(loadedSessions[0].id).toBe('test-1')
      expect(loadedSessions[0].taskName).toBe('Test Task')
      // Dates are serialized/deserialized as strings, so need to check differently
      expect(new Date(loadedSessions[0].startTime)).toEqual(session.startTime)
      expect(new Date(loadedSessions[0].endTime!)).toEqual(session.endTime)
    })

    it('should append new sessions to existing ones', () => {
      const session1: Session = {
        id: 'test-1',
        taskName: 'Task 1',
        startTime: new Date(),
        isActive: false
      }

      const session2: Session = {
        id: 'test-2',
        taskName: 'Task 2',
        startTime: new Date(),
        isActive: true
      }

      saveSession(session1)
      saveSession(session2)

      const loadedSessions = loadSessions()
      expect(loadedSessions).toHaveLength(2)
      expect(loadedSessions.map(s => s.id)).toEqual(['test-1', 'test-2'])
    })

    it('should update existing session if same ID', () => {
      const session: Session = {
        id: 'test-1',
        taskName: 'Original Task',
        startTime: new Date(),
        isActive: true
      }

      saveSession(session)

      const updatedSession: Session = {
        ...session,
        taskName: 'Updated Task',
        endTime: new Date(),
        duration: 1800000,
        isActive: false
      }

      saveSession(updatedSession)

      const loadedSessions = loadSessions()
      expect(loadedSessions).toHaveLength(1)
      expect(loadedSessions[0].taskName).toBe('Updated Task')
      expect(loadedSessions[0].isActive).toBe(false)
    })

    it('should handle empty storage', () => {
      const sessions = loadSessions()
      expect(sessions).toEqual([])
    })

    it('should handle corrupted storage data', () => {
      // Manually set invalid JSON in localStorage
      localStorage.setItem(STORAGE_KEYS.SESSIONS, 'invalid-json')

      const sessions = loadSessions()
      expect(sessions).toEqual([])
    })
  })

  describe('saveTimerState and loadTimerState', () => {
    it('should save and load timer state', () => {
      const session: Session = {
        id: 'current-1',
        taskName: 'Current Task',
        startTime: new Date('2025-01-01T10:00:00Z'),
        isActive: true
      }

      const timerState: TimerState = {
        currentSession: session,
        sessions: [session],
        status: 'active',
        elapsedTime: 1800000
      }

      saveTimerState(timerState)
      const loadedState = loadTimerState()

      expect(loadedState.currentSession?.id).toBe('current-1')
      expect(loadedState.status).toBe('active')
      expect(loadedState.elapsedTime).toBe(1800000)
      expect(loadedState.sessions).toHaveLength(1)
    })

    it('should handle null current session', () => {
      const timerState: TimerState = {
        currentSession: null,
        sessions: [],
        status: 'completed',
        elapsedTime: 0
      }

      saveTimerState(timerState)
      const loadedState = loadTimerState()

      expect(loadedState.currentSession).toBeNull()
      expect(loadedState.status).toBe('completed')
      expect(loadedState.sessions).toEqual([])
    })

    it('should return default state for empty storage', () => {
      const defaultState = loadTimerState()

      expect(defaultState.currentSession).toBeNull()
      expect(defaultState.sessions).toEqual([])
      expect(defaultState.status).toBe('completed')
      expect(defaultState.elapsedTime).toBe(0)
    })

    it('should handle corrupted timer state data', () => {
      localStorage.setItem(STORAGE_KEYS.TIMER_STATE, 'invalid-json')

      const state = loadTimerState()

      expect(state.currentSession).toBeNull()
      expect(state.sessions).toEqual([])
      expect(state.status).toBe('completed')
    })
  })

  describe('clearStorage', () => {
    it('should clear all storage data', () => {
      const session: Session = {
        id: 'test-1',
        taskName: 'Test Task',
        startTime: new Date(),
        isActive: false
      }

      const timerState: TimerState = {
        currentSession: session,
        sessions: [session],
        status: 'completed',
        elapsedTime: 0
      }

      saveSession(session)
      saveTimerState(timerState)

      // Verify data is saved
      expect(loadSessions()).toHaveLength(1)
      expect(loadTimerState().currentSession).not.toBeNull()

      clearStorage()

      // Verify data is cleared
      expect(loadSessions()).toEqual([])
      expect(loadTimerState().currentSession).toBeNull()
    })
  })
})