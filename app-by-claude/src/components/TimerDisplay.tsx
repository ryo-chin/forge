import React, { useEffect } from 'react'
import { useTimerStore } from '../stores/timer'
import { formatDuration } from '../utils/timer'

export const TimerDisplay: React.FC = () => {
  const {
    currentSession,
    status,
    elapsedTime,
    pauseSession,
    resumeSession,
    endSession,
    updateElapsedTime,
  } = useTimerStore()

  // Update elapsed time every second for active sessions
  useEffect(() => {
    updateElapsedTime()

    if (status === 'active') {
      const interval = setInterval(() => {
        updateElapsedTime()
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [status, updateElapsedTime])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        if (status === 'active') {
          pauseSession()
        } else if (status === 'paused') {
          resumeSession()
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        endSession()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [status, pauseSession, resumeSession, endSession])

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">セッションがありません</p>
        </div>
      </div>
    )
  }

  const isActive = status === 'active'
  const isPaused = status === 'paused'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg text-center">
        {/* Status Indicator */}
        <div className="mb-4">
          {isPaused && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              一時停止中
            </span>
          )}
        </div>

        {/* Task Name */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-light text-gray-900 truncate px-4">
            {currentSession.taskName}
          </h1>
        </div>

        {/* Timer Display */}
        <div className="mb-8">
          <div className="text-6xl md:text-7xl font-mono font-light text-gray-900 mb-2">
            {formatDuration(elapsedTime)}
          </div>
          <div className="text-sm text-gray-500">
            開始: {currentSession.startTime.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center space-x-4">
          {/* Pause/Resume Button */}
          <button
            onClick={isActive ? pauseSession : resumeSession}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              isActive
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-green-500 text-white hover:bg-green-600'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500`}
          >
            {isActive ? '一時停止' : '再開'}
          </button>

          {/* Stop Button */}
          <button
            onClick={endSession}
            className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            停止
          </button>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="mt-8 text-sm text-gray-500">
          <div className="flex items-center justify-center space-x-4">
            <div>
              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
                Space
              </kbd>
              <span className="ml-1">一時停止/再開</span>
            </div>
            <div>
              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
                Esc
              </kbd>
              <span className="ml-1">停止</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}