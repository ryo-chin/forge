import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimerDisplay } from '../TimerDisplay'
import { useRunningSession } from '../../hooks/useRunningSession'
import { useDraftReducer } from '../../hooks/useDraftReducer'

// Mock dependencies
vi.mock('../../hooks/useRunningSession', () => ({
  useRunningSession: vi.fn()
}))

vi.mock('../../hooks/useDraftReducer', () => ({
  useDraftReducer: vi.fn()
}))

const mockUseRunningSession = vi.mocked(useRunningSession)
const mockUseDraftReducer = vi.mocked(useDraftReducer)

describe('TimerDisplay Component', () => {
  const mockPause = vi.fn()
  const mockResume = vi.fn()
  const mockStop = vi.fn()
  const mockUpdateSession = vi.fn()

  const mockActiveSession = {
    id: 'test-session-1',
    taskName: 'Learn React',
    startTime: new Date('2025-01-01T10:00:00Z'),
    isActive: true,
    tags: ['programming', 'learning'],
    project: 'Web Development',
    skill: 'JavaScript',
  }

  const mockRunningSessionData = {
    session: mockActiveSession,
    elapsedTime: 1800000, // 30 minutes
    isActive: true,
    isPaused: false,
    isCompleted: false,
    formattedTime: '00:30:00',
    pause: mockPause,
    resume: mockResume,
    stop: mockStop,
    updateSession: mockUpdateSession,
    adjustStartTime: vi.fn(),
  }

  const mockDraftActions = {
    updateTaskName: vi.fn(),
    addTag: vi.fn(),
    removeTag: vi.fn(),
    setProject: vi.fn(),
    setSkill: vi.fn(),
    clearDraft: vi.fn(),
  }

  const mockDraftState = {
    draft: {},
    hasChanges: false,
  }

  const mockDraftReducerData = {
    state: mockDraftState,
    dispatch: vi.fn(),
    actions: mockDraftActions,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRunningSession.mockReturnValue(mockRunningSessionData)
    mockUseDraftReducer.mockReturnValue(mockDraftReducerData)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Active Session Display', () => {
    it('should render current task name', () => {
      render(<TimerDisplay />)

      expect(screen.getByText('Learn React')).toBeInTheDocument()
    })

    it('should display formatted elapsed time', () => {
      render(<TimerDisplay />)

      expect(screen.getByText('00:30:00')).toBeInTheDocument()
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
      mockUseRunningSession.mockReturnValue({
        ...mockRunningSessionData,
        isActive: false,
        isPaused: true,
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

      expect(mockPause).toHaveBeenCalledOnce()
    })

    it('should resume session when resume button is clicked', () => {
      mockUseRunningSession.mockReturnValue({
        ...mockRunningSessionData,
        isActive: false,
        isPaused: true,
      })

      render(<TimerDisplay />)

      const resumeButton = screen.getByRole('button', { name: /再開/i })
      fireEvent.click(resumeButton)

      expect(mockResume).toHaveBeenCalledOnce()
    })

    it('should end session when stop button is clicked', () => {
      render(<TimerDisplay />)

      const stopButton = screen.getByRole('button', { name: '停止' })
      fireEvent.click(stopButton)

      expect(mockStop).toHaveBeenCalledOnce()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should pause/resume with spacebar', () => {
      render(<TimerDisplay />)

      // Simulate spacebar keydown event
      fireEvent.keyDown(document, { key: ' ' })

      expect(mockPause).toHaveBeenCalledOnce()
    })

    it('should stop with Escape key', () => {
      render(<TimerDisplay />)

      // Simulate Escape keydown event
      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockStop).toHaveBeenCalledOnce()
    })

    it('should resume with spacebar when paused', () => {
      mockUseRunningSession.mockReturnValue({
        ...mockRunningSessionData,
        isActive: false,
        isPaused: true,
      })

      render(<TimerDisplay />)

      fireEvent.keyDown(document, { key: ' ' })

      expect(mockResume).toHaveBeenCalledOnce()
    })
  })

  describe('Task Name Display', () => {
    it('should truncate very long task names', () => {
      const longTaskName = 'This is a very long task name that should be truncated to prevent layout issues'

      mockUseRunningSession.mockReturnValue({
        ...mockRunningSessionData,
        session: {
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
      mockUseRunningSession.mockReturnValue({
        ...mockRunningSessionData,
        session: null,
      })

      render(<TimerDisplay />)

      expect(screen.getByText(/セッションがありません/i)).toBeInTheDocument()
    })
  })

  describe('Timer Display Integration', () => {
    it('should display running session data from hook', () => {
      render(<TimerDisplay />)

      // Verify that the hook data is displayed correctly
      expect(screen.getByText('Learn React')).toBeInTheDocument()
      expect(screen.getByText('00:30:00')).toBeInTheDocument()
    })

    it('should handle different session states', () => {
      // Test active state
      mockUseRunningSession.mockReturnValue({
        ...mockRunningSessionData,
        isActive: true,
        isPaused: false,
      })

      const { rerender } = render(<TimerDisplay />)
      expect(screen.getByRole('button', { name: /一時停止/i })).toBeInTheDocument()

      // Test paused state
      mockUseRunningSession.mockReturnValue({
        ...mockRunningSessionData,
        isActive: false,
        isPaused: true,
      })

      rerender(<TimerDisplay />)
      expect(screen.getByRole('button', { name: /再開/i })).toBeInTheDocument()
      expect(screen.getByText(/一時停止中/i)).toBeInTheDocument()
    })
  })

  describe('Session Editing', () => {
    it('should show edit button', () => {
      render(<TimerDisplay />)

      const editButton = screen.getByRole('button', { name: '編集' })
      expect(editButton).toBeInTheDocument()
    })

    it('should display session tags, project, and skill', () => {
      render(<TimerDisplay />)

      expect(screen.getByText('programming')).toBeInTheDocument()
      expect(screen.getByText('learning')).toBeInTheDocument()
      expect(screen.getByText('📁 Web Development')).toBeInTheDocument()
      expect(screen.getByText('🎯 JavaScript')).toBeInTheDocument()
    })

    it('should save draft changes when save button is clicked', () => {
      // Mock draft with changes
      mockUseDraftReducer.mockReturnValue({
        ...mockDraftReducerData,
        state: {
          draft: {
            taskName: 'Updated Task',
            tags: ['new-tag'],
            project: 'New Project',
            skill: 'New Skill',
          },
          hasChanges: true,
        },
      })

      render(<TimerDisplay />)

      // Open edit form
      const editButton = screen.getByRole('button', { name: '編集' })
      fireEvent.click(editButton)

      // Save changes
      const saveButton = screen.getByText('保存')
      fireEvent.click(saveButton)

      expect(mockUpdateSession).toHaveBeenCalledWith({
        taskName: 'Updated Task',
        tags: ['new-tag'],
        project: 'New Project',
        skill: 'New Skill',
      })

      expect(mockDraftActions.clearDraft).toHaveBeenCalled()
    })

    it('should disable save button when no changes', () => {
      render(<TimerDisplay />)

      // Open edit form
      const editButton = screen.getByRole('button', { name: '編集' })
      fireEvent.click(editButton)

      const saveButton = screen.getByText('保存')
      expect(saveButton).toBeDisabled()
    })

    it('should enable save button when there are changes', () => {
      // Mock draft with changes
      mockUseDraftReducer.mockReturnValue({
        ...mockDraftReducerData,
        state: {
          ...mockDraftState,
          hasChanges: true,
        },
      })

      render(<TimerDisplay />)

      // Open edit form
      const editButton = screen.getByRole('button', { name: '編集' })
      fireEvent.click(editButton)

      const saveButton = screen.getByText('保存')
      expect(saveButton).toBeEnabled()
    })
  })
})