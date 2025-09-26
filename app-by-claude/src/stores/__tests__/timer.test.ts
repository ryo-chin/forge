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

  describe('adjustStartTime', () => {
    beforeEach(() => {
      useTimerStore.setState({
        currentSession: null,
        sessions: [],
        status: 'completed',
        elapsedTime: 0,
      })
    })

    it('should adjust start time for current session', () => {
      const { startSession, adjustStartTime } = useTimerStore.getState()

      // Start a session
      const originalTime = new Date('2025-01-01T10:00:00Z')
      startSession({ taskName: 'Test Task', startTime: originalTime })

      // Adjust start time
      const newStartTime = new Date('2025-01-01T09:30:00Z')
      adjustStartTime(newStartTime)

      const { currentSession } = useTimerStore.getState()
      expect(currentSession?.startTime).toEqual(newStartTime)
    })

    it('should ignore adjustment when no current session', () => {
      const { adjustStartTime } = useTimerStore.getState()
      const newStartTime = new Date('2025-01-01T08:00:00Z')

      adjustStartTime(newStartTime)

      const { currentSession } = useTimerStore.getState()
      expect(currentSession).toBeNull()
    })

    it('should prevent setting start time in the future', () => {
      const { startSession, adjustStartTime } = useTimerStore.getState()

      // Start a session with a past time
      const pastTime = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      startSession({ taskName: 'Test Task', startTime: pastTime })

      // Try to adjust to future time
      const futureTime = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      adjustStartTime(futureTime)

      const { currentSession } = useTimerStore.getState()
      expect(currentSession?.startTime).not.toEqual(futureTime)
      expect(currentSession?.startTime.getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('should reject extreme adjustments over 12 hours', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { startSession, adjustStartTime } = useTimerStore.getState()

      // Start a session
      const originalTime = new Date('2025-01-01T10:00:00Z')
      startSession({ taskName: 'Test Task', startTime: originalTime })

      // Try to adjust by more than 12 hours
      const extremeTime = new Date(originalTime.getTime() + 13 * 60 * 60 * 1000) // 13 hours later
      adjustStartTime(extremeTime)

      const { currentSession } = useTimerStore.getState()
      expect(currentSession?.startTime).toEqual(originalTime) // Should remain unchanged
      expect(consoleSpy).toHaveBeenCalledWith('Start time adjustment rejected: exceeds 12-hour limit')

      consoleSpy.mockRestore()
    })

    it('should allow reasonable adjustments within limits', () => {
      const { startSession, adjustStartTime } = useTimerStore.getState()

      // Start a session
      const originalTime = new Date('2025-01-01T10:00:00Z')
      startSession({ taskName: 'Test Task', startTime: originalTime })

      // Adjust by 2 hours (within 12-hour limit)
      const adjustedTime = new Date(originalTime.getTime() - 2 * 60 * 60 * 1000) // 2 hours earlier
      adjustStartTime(adjustedTime)

      const { currentSession } = useTimerStore.getState()
      expect(currentSession?.startTime).toEqual(adjustedTime)
    })
  })
})