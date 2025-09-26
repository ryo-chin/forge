import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunningSession } from '../useRunningSession'
import { useTimerStore } from '../../stores/timer'

// Mock the timer store
vi.mock('../../stores/timer', () => ({
  useTimerStore: vi.fn()
}))

const mockTimerStore = vi.mocked(useTimerStore)

describe('useRunningSession', () => {
  const mockSession = {
    id: 'test-1',
    taskName: 'Test Task',
    startTime: new Date('2025-01-01T10:00:00Z'),
    isActive: true,
  }

  const mockPauseSession = vi.fn()
  const mockResumeSession = vi.fn()
  const mockEndSession = vi.fn()
  const mockUpdateCurrentSession = vi.fn()
  const mockUpdateElapsedTime = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockTimerStore.mockReturnValue({
      currentSession: mockSession,
      status: 'active',
      elapsedTime: 3600000, // 1 hour
      pauseSession: mockPauseSession,
      resumeSession: mockResumeSession,
      endSession: mockEndSession,
      updateCurrentSession: mockUpdateCurrentSession,
      updateElapsedTime: mockUpdateElapsedTime,
      adjustWorkTime: vi.fn(),
      sessions: [],
      startSession: vi.fn(),
      deleteSession: vi.fn(),
      clearAllSessions: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Data Properties', () => {
    it('should return current session data', () => {
      const { result } = renderHook(() => useRunningSession())

      expect(result.current.session).toBe(mockSession)
      expect(result.current.elapsedTime).toBe(3600000)
      expect(result.current.isActive).toBe(true)
      expect(result.current.isPaused).toBe(false)
      expect(result.current.isCompleted).toBe(false)
    })

    it('should format elapsed time correctly', () => {
      const { result } = renderHook(() => useRunningSession())

      expect(result.current.formattedTime).toBe('01:00:00') // 1 hour
    })

    it('should handle null session', () => {
      mockTimerStore.mockReturnValue({
        currentSession: null,
        status: 'completed',
        elapsedTime: 0,
        pauseSession: vi.fn(),
        resumeSession: vi.fn(),
        endSession: vi.fn(),
        updateCurrentSession: vi.fn(),
        updateElapsedTime: mockUpdateElapsedTime,
        adjustWorkTime: vi.fn(),
        sessions: [],
        startSession: vi.fn(),
        deleteSession: vi.fn(),
        clearAllSessions: vi.fn(),
      })

      const { result } = renderHook(() => useRunningSession())

      expect(result.current.session).toBe(null)
      expect(result.current.isCompleted).toBe(true)
      expect(result.current.formattedTime).toBe('00:00:00')
    })
  })

  describe('Status Properties', () => {
    it('should correctly identify active state', () => {
      const { result } = renderHook(() => useRunningSession())

      expect(result.current.isActive).toBe(true)
      expect(result.current.isPaused).toBe(false)
      expect(result.current.isCompleted).toBe(false)
    })

    it('should correctly identify paused state', () => {
      mockTimerStore.mockReturnValue({
        currentSession: null,
        status: 'paused',
        elapsedTime: 0,
        pauseSession: vi.fn(),
        resumeSession: vi.fn(),
        endSession: vi.fn(),
        updateCurrentSession: vi.fn(),
        updateElapsedTime: mockUpdateElapsedTime,
        adjustWorkTime: vi.fn(),
        sessions: [],
        startSession: vi.fn(),
        deleteSession: vi.fn(),
        clearAllSessions: vi.fn(),
      })

      const { result } = renderHook(() => useRunningSession())

      expect(result.current.isActive).toBe(false)
      expect(result.current.isPaused).toBe(true)
      expect(result.current.isCompleted).toBe(false)
    })

    it('should correctly identify completed state', () => {
      mockTimerStore.mockReturnValue({
        currentSession: null,
        status: 'completed',
        elapsedTime: 0,
        pauseSession: vi.fn(),
        resumeSession: vi.fn(),
        endSession: vi.fn(),
        updateCurrentSession: vi.fn(),
        updateElapsedTime: mockUpdateElapsedTime,
        adjustWorkTime: vi.fn(),
        sessions: [],
        startSession: vi.fn(),
        deleteSession: vi.fn(),
        clearAllSessions: vi.fn(),
      })

      const { result } = renderHook(() => useRunningSession())

      expect(result.current.isActive).toBe(false)
      expect(result.current.isPaused).toBe(false)
      expect(result.current.isCompleted).toBe(true)
    })
  })

  describe('Actions', () => {
    it('should call pause action', () => {
      const { result } = renderHook(() => useRunningSession())

      act(() => {
        result.current.pause()
      })

      expect(mockPauseSession).toHaveBeenCalledOnce()
    })

    it('should call resume action', () => {
      const { result } = renderHook(() => useRunningSession())

      act(() => {
        result.current.resume()
      })

      expect(mockResumeSession).toHaveBeenCalledOnce()
    })

    it('should call stop action', () => {
      const { result } = renderHook(() => useRunningSession())

      act(() => {
        result.current.stop()
      })

      expect(mockEndSession).toHaveBeenCalledOnce()
    })

    it('should call updateSession action with correct parameters', () => {
      const { result } = renderHook(() => useRunningSession())
      const updates = { taskName: 'Updated Task', project: 'New Project' }

      act(() => {
        result.current.updateSession(updates)
      })

      expect(mockUpdateCurrentSession).toHaveBeenCalledWith(updates)
    })

  })

  describe('Time Formatting', () => {
    it('should format different time durations correctly', () => {
      const testCases = [
        { milliseconds: 0, expected: '00:00:00' },
        { milliseconds: 1000, expected: '00:00:01' },
        { milliseconds: 60000, expected: '00:01:00' },
        { milliseconds: 3600000, expected: '01:00:00' },
        { milliseconds: 3661000, expected: '01:01:01' },
        { milliseconds: 36610000, expected: '10:10:10' },
      ]

      testCases.forEach(({ milliseconds, expected }) => {
        mockTimerStore.mockReturnValue({
          currentSession: mockSession,
          status: 'active',
          elapsedTime: milliseconds,
          pauseSession: vi.fn(),
          resumeSession: vi.fn(),
          endSession: vi.fn(),
          updateCurrentSession: vi.fn(),
          updateElapsedTime: vi.fn(),
          adjustWorkTime: vi.fn(),
          sessions: [],
          startSession: vi.fn(),
          deleteSession: vi.fn(),
          clearAllSessions: vi.fn(),
        })

        const { result } = renderHook(() => useRunningSession())
        expect(result.current.formattedTime).toBe(expected)
      })
    })
  })

  describe('Auto Timer Updates', () => {
    it('should update elapsed time every second for active sessions', () => {
      renderHook(() => useRunningSession())

      // Initial call
      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(1)

      // Advance timer by 1 second
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(2)

      // Advance timer by another 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(4)
    })

    it('should not update elapsed time for paused sessions', () => {
      mockTimerStore.mockReturnValue({
        currentSession: null,
        status: 'paused',
        elapsedTime: 0,
        pauseSession: vi.fn(),
        resumeSession: vi.fn(),
        endSession: vi.fn(),
        updateCurrentSession: vi.fn(),
        updateElapsedTime: mockUpdateElapsedTime,
        adjustWorkTime: vi.fn(),
        sessions: [],
        startSession: vi.fn(),
        deleteSession: vi.fn(),
        clearAllSessions: vi.fn(),
      })

      renderHook(() => useRunningSession())

      // No initial call because status is 'paused'
      expect(mockUpdateElapsedTime).not.toHaveBeenCalled()

      // Advance timer - should not trigger updates
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(mockUpdateElapsedTime).not.toHaveBeenCalled()
    })

    it('should not update elapsed time when no session', () => {
      mockTimerStore.mockReturnValue({
        currentSession: null,
        status: 'completed',
        elapsedTime: 0,
        pauseSession: vi.fn(),
        resumeSession: vi.fn(),
        endSession: vi.fn(),
        updateCurrentSession: vi.fn(),
        updateElapsedTime: mockUpdateElapsedTime,
        adjustWorkTime: vi.fn(),
        sessions: [],
        startSession: vi.fn(),
        deleteSession: vi.fn(),
        clearAllSessions: vi.fn(),
      })

      renderHook(() => useRunningSession())

      // No initial call
      expect(mockUpdateElapsedTime).not.toHaveBeenCalled()

      // Advance timer - should not trigger updates
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(mockUpdateElapsedTime).not.toHaveBeenCalled()
    })

    it('should cleanup timer on unmount', () => {
      const { unmount } = renderHook(() => useRunningSession())

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(1)

      unmount()

      // Advance timer after unmount - should not trigger updates
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(1)
    })
  })
})