import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTimerStore } from '../timer'
import type { CreateSessionInput } from '../../types/session'

// Mock timer utilities
vi.mock('../../utils/timer', () => ({
  generateSessionId: vi.fn(() => 'test-session-id'),
  calculateElapsedTime: vi.fn(() => 1000),
  calculateDuration: vi.fn(() => 3600000), // 1 hour
  formatDuration: vi.fn((ms) => `${ms}ms`),
}))

describe('Timer Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useTimerStore.setState({
      currentSession: null,
      sessions: [],
      status: 'completed',
      elapsedTime: 0,
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  describe('startSession', () => {
    it('should start a new session', () => {
      const input: CreateSessionInput = {
        taskName: 'Test Task',
      }

      const state = useTimerStore.getState()
      state.startSession(input)

      const newState = useTimerStore.getState()
      expect(newState.currentSession).not.toBeNull()
      expect(newState.currentSession?.taskName).toBe('Test Task')
      expect(newState.currentSession?.isActive).toBe(true)
      expect(newState.status).toBe('active')
      expect(newState.sessions).toHaveLength(1)
    })

    it('should end current session before starting new one', () => {
      const state = useTimerStore.getState()

      // Start first session
      state.startSession({ taskName: 'First Task' })
      expect(useTimerStore.getState().sessions).toHaveLength(1)

      // Start second session
      state.startSession({ taskName: 'Second Task' })

      const newState = useTimerStore.getState()
      expect(newState.sessions).toHaveLength(2)
      expect(newState.currentSession?.taskName).toBe('Second Task')
      expect(newState.sessions[0].isActive).toBe(false) // First session ended
      expect(newState.sessions[1].isActive).toBe(true)  // Second session active
    })

    it('should use provided start time', () => {
      const customStartTime = new Date('2025-01-01T10:00:00Z')
      const input: CreateSessionInput = {
        taskName: 'Timed Task',
        startTime: customStartTime,
      }

      const state = useTimerStore.getState()
      state.startSession(input)

      const session = useTimerStore.getState().currentSession
      expect(session?.startTime).toEqual(customStartTime)
    })
  })

  describe('pauseSession', () => {
    it('should pause active session', () => {
      const state = useTimerStore.getState()
      state.startSession({ taskName: 'Test Task' })

      state.pauseSession()

      const newState = useTimerStore.getState()
      expect(newState.status).toBe('paused')
      expect(newState.currentSession?.isActive).toBe(true) // Still current, just paused
    })

    it('should do nothing if no active session', () => {
      const state = useTimerStore.getState()

      state.pauseSession()

      const newState = useTimerStore.getState()
      expect(newState.status).toBe('completed')
      expect(newState.currentSession).toBeNull()
    })
  })

  describe('resumeSession', () => {
    it('should resume paused session', () => {
      const state = useTimerStore.getState()
      state.startSession({ taskName: 'Test Task' })
      state.pauseSession()

      state.resumeSession()

      const newState = useTimerStore.getState()
      expect(newState.status).toBe('active')
    })

    it('should do nothing if no paused session', () => {
      const state = useTimerStore.getState()

      state.resumeSession()

      const newState = useTimerStore.getState()
      expect(newState.status).toBe('completed')
    })
  })

  describe('endSession', () => {
    it('should end current session', () => {
      const state = useTimerStore.getState()
      state.startSession({ taskName: 'Test Task' })

      state.endSession()

      const newState = useTimerStore.getState()
      expect(newState.currentSession).toBeNull()
      expect(newState.status).toBe('completed')
      expect(newState.sessions[0].isActive).toBe(false)
      expect(newState.sessions[0].endTime).toBeInstanceOf(Date)
      expect(newState.sessions[0].duration).toBeGreaterThan(0)
    })

    it('should do nothing if no active session', () => {
      const state = useTimerStore.getState()

      state.endSession()

      const newState = useTimerStore.getState()
      expect(newState.sessions).toHaveLength(0)
    })
  })

  describe('updateCurrentSession', () => {
    it('should update current session properties', () => {
      const state = useTimerStore.getState()
      state.startSession({ taskName: 'Original Task' })

      state.updateCurrentSession({
        taskName: 'Updated Task',
        tags: ['urgent', 'important'],
        project: 'Test Project',
      })

      const session = useTimerStore.getState().currentSession
      expect(session?.taskName).toBe('Updated Task')
      expect(session?.tags).toEqual(['urgent', 'important'])
      expect(session?.project).toBe('Test Project')
    })

    it('should do nothing if no current session', () => {
      const state = useTimerStore.getState()

      state.updateCurrentSession({ taskName: 'Updated Task' })

      expect(useTimerStore.getState().currentSession).toBeNull()
    })
  })

  describe('updateElapsedTime', () => {
    it('should update elapsed time for active session', () => {
      const state = useTimerStore.getState()
      state.startSession({ taskName: 'Test Task' })

      state.updateElapsedTime()

      const newState = useTimerStore.getState()
      expect(newState.elapsedTime).toBe(1000) // Mocked value
    })

    it('should not update elapsed time if not active', () => {
      const state = useTimerStore.getState()
      state.startSession({ taskName: 'Test Task' })
      state.pauseSession()

      state.updateElapsedTime()

      const newState = useTimerStore.getState()
      expect(newState.elapsedTime).toBe(0) // No update when paused
    })
  })
})