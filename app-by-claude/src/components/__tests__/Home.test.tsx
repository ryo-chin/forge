import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home } from '../Home'
import { useTimerStore } from '../../stores/timer'

// Mock the timer store
vi.mock('../../stores/timer', () => ({
  useTimerStore: vi.fn()
}))

const mockTimerStore = vi.mocked(useTimerStore)

describe('Home Component', () => {
  const mockStartSession = vi.fn()
  const mockStore = {
    currentSession: null,
    status: 'completed' as const,
    elapsedTime: 0,
    startSession: mockStartSession,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockTimerStore.mockReturnValue(mockStore)
  })

  describe('Initial Render', () => {
    it('should render the main input field', () => {
      render(<Home />)

      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', '何をやる？')
    })

    it('should render the start button', () => {
      render(<Home />)

      const button = screen.getByRole('button', { name: /開始/i })
      expect(button).toBeInTheDocument()
      expect(button).toBeDisabled() // Initially disabled when input is empty
    })

    it('should have Google search-like simple layout', () => {
      render(<Home />)

      const container = screen.getByTestId('home-container')
      expect(container).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center')
    })
  })

  describe('Input Interaction', () => {
    it('should enable start button when input has text', async () => {
      const user = userEvent.setup()
      render(<Home />)

      const input = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /開始/i })

      expect(button).toBeDisabled()

      await user.type(input, 'Learn TypeScript')

      expect(button).toBeEnabled()
    })

    it('should disable start button when input is empty', async () => {
      const user = userEvent.setup()
      render(<Home />)

      const input = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /開始/i })

      await user.type(input, 'Test')
      expect(button).toBeEnabled()

      await user.clear(input)
      expect(button).toBeDisabled()
    })

    it('should focus input field on mount', () => {
      render(<Home />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveFocus()
    })
  })

  describe('Session Start', () => {
    it('should start session when start button is clicked', async () => {
      const user = userEvent.setup()
      render(<Home />)

      const input = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /開始/i })

      await user.type(input, 'Learn React')
      await user.click(button)

      expect(mockStartSession).toHaveBeenCalledWith({
        taskName: 'Learn React',
      })
    })

    it('should start session when Enter key is pressed', async () => {
      const user = userEvent.setup()
      render(<Home />)

      const input = screen.getByRole('textbox')

      await user.type(input, 'Practice Piano')
      await user.keyboard('{Enter}')

      expect(mockStartSession).toHaveBeenCalledWith({
        taskName: 'Practice Piano',
      })
    })

    it('should not start session when input is empty and Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<Home />)

      const input = screen.getByRole('textbox')

      await user.click(input)
      await user.keyboard('{Enter}')

      expect(mockStartSession).not.toHaveBeenCalled()
    })

    it('should not start session during IME composition', async () => {
      render(<Home />)

      const input = screen.getByRole('textbox')

      // Simulate IME composition start
      fireEvent.compositionStart(input)
      fireEvent.change(input, { target: { value: 'テスト' } })

      // Try to press Enter during composition - should not start session
      fireEvent.keyDown(input, {
        key: 'Enter',
        nativeEvent: { isComposing: true } as any
      })

      expect(mockStartSession).not.toHaveBeenCalled()

      // End composition and then press Enter - should start session
      fireEvent.compositionEnd(input)
      fireEvent.keyDown(input, {
        key: 'Enter',
        nativeEvent: { isComposing: false } as any
      })

      expect(mockStartSession).toHaveBeenCalledWith({
        taskName: 'テスト',
      })
    })

    it('should clear input after starting session', async () => {
      const user = userEvent.setup()
      render(<Home />)

      const input = screen.getByRole('textbox')

      await user.type(input, 'Study Mathematics')
      await user.keyboard('{Enter}')

      expect(mockStartSession).toHaveBeenCalled()
      expect(input).toHaveValue('')
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should support Cmd+K to focus input (Mac)', async () => {
      const user = userEvent.setup()
      render(<Home />)

      const input = screen.getByRole('textbox')

      // Unfocus the input first
      input.blur()
      expect(input).not.toHaveFocus()

      // Press Cmd+K
      await user.keyboard('{Meta>}k{/Meta}')

      expect(input).toHaveFocus()
    })

    it('should support Ctrl+K to focus input (Windows/Linux)', async () => {
      const user = userEvent.setup()
      render(<Home />)

      const input = screen.getByRole('textbox')

      input.blur()
      expect(input).not.toHaveFocus()

      await user.keyboard('{Control>}k{/Control}')

      expect(input).toHaveFocus()
    })
  })

  describe('Active Session State', () => {
    it('should show different state when session is active', () => {
      mockTimerStore.mockReturnValue({
        ...mockStore,
        currentSession: {
          id: 'test-1',
          taskName: 'Active Task',
          startTime: new Date(),
          isActive: true,
        },
        status: 'active' as const,
        updateElapsedTime: vi.fn(),
      })

      render(<Home />)

      // Should show different UI when session is active
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByText('Active Task')).toBeInTheDocument()
    })
  })
})