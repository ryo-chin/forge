import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimerDisplay } from '../TimerDisplay'
import { useTimerStore } from '../../stores/timer'
import { formatDuration } from '../../utils/timer'

// Mock dependencies
vi.mock('../../stores/timer', () => ({
  useTimerStore: vi.fn()
}))

vi.mock('../../utils/timer', () => ({
  formatDuration: vi.fn((ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  })
}))

const mockTimerStore = vi.mocked(useTimerStore)
const mockFormatDuration = vi.mocked(formatDuration)

describe('TimerDisplay Component', () => {
  const mockPauseSession = vi.fn()
  const mockResumeSession = vi.fn()
  const mockEndSession = vi.fn()
  const mockUpdateElapsedTime = vi.fn()

  const mockActiveSession = {
    id: 'test-session-1',
    taskName: 'Learn React',
    startTime: new Date('2025-01-01T10:00:00Z'),
    isActive: true,
  }

  const mockStore = {
    currentSession: mockActiveSession,
    status: 'active' as const,
    elapsedTime: 1800000, // 30 minutes
    pauseSession: mockPauseSession,
    resumeSession: mockResumeSession,
    endSession: mockEndSession,
    updateElapsedTime: mockUpdateElapsedTime,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockTimerStore.mockReturnValue(mockStore)
    mockFormatDuration.mockImplementation((ms) => {
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Active Session Display', () => {
    it('should display current task name', () => {
      render(<TimerDisplay />)

      expect(screen.getByText('Learn React')).toBeInTheDocument()
    })

    it('should display formatted elapsed time', () => {
      render(<TimerDisplay />)

      expect(screen.getByText('00:30:00')).toBeInTheDocument()
      expect(mockFormatDuration).toHaveBeenCalledWith(1800000)
    })

    it('should show pause button when active', () => {
      render(<TimerDisplay />)

      const pauseButton = screen.getByRole('button', { name: /一時停止/i })
      expect(pauseButton).toBeInTheDocument()
    })

    it('should show stop button', () => {
      render(<TimerDisplay />)

      const stopButton = screen.getByRole('button', { name: '停止' })
      expect(stopButton).toBeInTheDocument()
    })
  })

  describe('Paused Session Display', () => {
    beforeEach(() => {
      mockTimerStore.mockReturnValue({
        ...mockStore,
        status: 'paused' as const,
      })
    })

    it('should show resume button when paused', () => {
      render(<TimerDisplay />)

      const resumeButton = screen.getByRole('button', { name: /再開/i })
      expect(resumeButton).toBeInTheDocument()
    })

    it('should show paused indicator', () => {
      render(<TimerDisplay />)

      expect(screen.getByText(/一時停止中/i)).toBeInTheDocument()
    })
  })

  describe('Timer Controls', () => {
    it('should pause session when pause button is clicked', () => {
      render(<TimerDisplay />)

      const pauseButton = screen.getByRole('button', { name: /一時停止/i })
      fireEvent.click(pauseButton)

      expect(mockPauseSession).toHaveBeenCalledOnce()
    })

    it('should resume session when resume button is clicked', () => {
      mockTimerStore.mockReturnValue({
        ...mockStore,
        status: 'paused' as const,
      })

      render(<TimerDisplay />)

      const resumeButton = screen.getByRole('button', { name: /再開/i })
      fireEvent.click(resumeButton)

      expect(mockResumeSession).toHaveBeenCalledOnce()
    })

    it('should end session when stop button is clicked', () => {
      render(<TimerDisplay />)

      const stopButton = screen.getByRole('button', { name: '停止' })
      fireEvent.click(stopButton)

      expect(mockEndSession).toHaveBeenCalledOnce()
    })
  })

  describe('Real-time Updates', () => {
    it('should update elapsed time every second for active sessions', () => {
      render(<TimerDisplay />)

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(1)

      // Fast forward time
      vi.advanceTimersByTime(1000)

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(2)

      vi.advanceTimersByTime(1000)

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(3)
    })

    it('should not update elapsed time for paused sessions', () => {
      mockTimerStore.mockReturnValue({
        ...mockStore,
        status: 'paused' as const,
      })

      render(<TimerDisplay />)

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(2000)

      // Should still be 1 because it's paused
      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(1)
    })

    it('should cleanup timer on unmount', () => {
      const { unmount } = render(<TimerDisplay />)

      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(1)

      unmount()

      vi.advanceTimersByTime(5000)

      // Should not increase after unmount
      expect(mockUpdateElapsedTime).toHaveBeenCalledTimes(1)
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should pause/resume with spacebar', () => {
      render(<TimerDisplay />)

      // Simulate spacebar keydown event
      fireEvent.keyDown(document, { key: ' ' })

      expect(mockPauseSession).toHaveBeenCalledOnce()
    })

    it('should stop with Escape key', () => {
      render(<TimerDisplay />)

      // Simulate Escape keydown event
      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockEndSession).toHaveBeenCalledOnce()
    })
  })

  describe('Task Name Display', () => {
    it('should truncate very long task names', () => {
      const longTaskName = 'This is a very long task name that should be truncated to prevent layout issues'

      mockTimerStore.mockReturnValue({
        ...mockStore,
        currentSession: {
          ...mockActiveSession,
          taskName: longTaskName,
        },
      })

      render(<TimerDisplay />)

      const taskElement = screen.getByText(longTaskName)
      expect(taskElement).toHaveClass('truncate')
    })
  })

  describe('No Session State', () => {
    it('should handle null current session gracefully', () => {
      mockTimerStore.mockReturnValue({
        ...mockStore,
        currentSession: null,
      })

      render(<TimerDisplay />)

      expect(screen.getByText(/セッションがありません/i)).toBeInTheDocument()
    })
  })
})