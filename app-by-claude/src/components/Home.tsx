import React, { useState, useEffect, useRef } from 'react'
import { useTimerStore } from '../stores/timer'
import { TimerDisplay } from './TimerDisplay'

export const Home: React.FC = () => {
  const [taskInput, setTaskInput] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { currentSession, status, startSession } = useTimerStore()

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux) to focus input
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (taskInput.trim()) {
      startSession({ taskName: taskInput.trim() })
      setTaskInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && taskInput.trim()) {
      // Check if this is a composition end (日本語入力確定) by checking isComposing
      // Both nativeEvent.isComposing and our state should be false to proceed
      if (!e.nativeEvent.isComposing && !isComposing) {
        handleSubmit(e)
      }
    }
  }

  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
  }

  const isInputEmpty = !taskInput.trim()

  // Show timer display if session is active
  if (currentSession) {
    return <TimerDisplay />
  }

  return (
    <div
      data-testid="home-container"
      className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
    >
      <div className="w-full max-w-2xl">
        {/* Main Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-light text-gray-900 mb-2">
            Time Tracker
          </h1>
          <p className="text-gray-600">
            何をやりますか？
          </p>
        </div>

        {/* Search-like Input */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
            <input
              ref={inputRef}
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="何をやる？"
              className="w-full px-6 py-4 text-lg rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20"
              autoComplete="off"
            />

            {/* Start Button */}
            <button
              type="submit"
              disabled={isInputEmpty}
              className={`absolute right-2 top-2 bottom-2 px-6 rounded-full font-medium transition-all duration-200 ${
                isInputEmpty
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'
              }`}
            >
              開始
            </button>
          </div>

          {/* Keyboard Hint */}
          <div className="text-center mt-4 text-sm text-gray-500">
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
              Enter
            </kbd>
            <span className="ml-1">で開始</span>
            <span className="mx-3">·</span>
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
              ⌘K
            </kbd>
            <span className="ml-1">でフォーカス</span>
          </div>
        </form>
      </div>
    </div>
  )
}