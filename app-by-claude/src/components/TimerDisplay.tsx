import React, { useEffect, useState } from 'react'
import { useRunningSession } from '../hooks/useRunningSession'
import { useDraftReducer } from '../hooks/useDraftReducer'

export const TimerDisplay: React.FC = () => {
  const [showEditForm, setShowEditForm] = useState(false)
  const [isEditingTaskName, setIsEditingTaskName] = useState(false)
  const [taskNameInput, setTaskNameInput] = useState('')

  const {
    session,
    formattedTime,
    isActive,
    isPaused,
    pause,
    resume,
    stop,
    updateSession
  } = useRunningSession()

  // Initialize draft with current session data
  const { state: draftState, actions: draftActions } = useDraftReducer({
    tags: session?.tags || [],
    project: session?.project || '',
  })

  // Toggle edit form
  const toggleEditForm = () => {
    setShowEditForm(!showEditForm)
    if (!showEditForm && session) {
      // Reset draft when opening form
      draftActions.setProject(session.project || '')
      draftActions.clearDraft()
      // Add existing tags
      session.tags?.forEach(tag => draftActions.addTag(tag))
    }
  }

  // Task name inline editing
  const startEditingTaskName = () => {
    if (session) {
      setTaskNameInput(session.taskName)
      setIsEditingTaskName(true)
    }
  }

  const saveTaskName = () => {
    if (taskNameInput.trim() && taskNameInput.trim() !== session?.taskName) {
      updateSession({ taskName: taskNameInput.trim() })
    }
    setIsEditingTaskName(false)
  }

  const cancelTaskNameEdit = () => {
    setIsEditingTaskName(false)
    setTaskNameInput('')
  }

  const handleTaskNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTaskName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelTaskNameEdit()
    }
  }

  // Save changes
  const saveChanges = () => {
    if (draftState.hasChanges && session) {
      updateSession(draftState.draft)
      setShowEditForm(false)
      draftActions.clearDraft()
    }
  }

  // Cancel changes
  const cancelChanges = () => {
    setShowEditForm(false)
    draftActions.clearDraft()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        if (isActive) {
          pause()
        } else if (isPaused) {
          resume()
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        stop()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isPaused, pause, resume, stop])

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">セッションがありません</p>
        </div>
      </div>
    )
  }

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
          <div className="flex items-center justify-center">
            {isEditingTaskName ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={taskNameInput}
                  onChange={(e) => setTaskNameInput(e.target.value)}
                  onKeyDown={handleTaskNameKeyDown}
                  onBlur={saveTaskName}
                  className="text-2xl md:text-3xl font-light text-gray-900 bg-white border-b-2 border-blue-500 focus:outline-none px-2 py-1 text-center"
                  autoFocus
                />
                <button
                  onClick={saveTaskName}
                  className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                  title="保存"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={cancelTaskNameEdit}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded"
                  title="キャンセル"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <h1
                  className="text-2xl md:text-3xl font-light text-gray-900 truncate px-4 cursor-pointer hover:bg-gray-50 rounded py-2 transition-colors"
                  onClick={startEditingTaskName}
                  title="クリックして編集"
                >
                  {session.taskName}
                </h1>
                <button
                  onClick={toggleEditForm}
                  className="ml-3 p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all duration-200 border border-gray-200 hover:border-blue-300"
                  title="詳細編集"
                  aria-label="詳細編集"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Display session info */}
          {(session.tags?.length || session.project) && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm">
              {/* Tags */}
              {(session.tags || []).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                >
                  {tag}
                </span>
              ))}

              {/* Project */}
              {session.project && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                  📁 {session.project}
                </span>
              )}

            </div>
          )}

          {/* Edit Form */}
          {showEditForm && (
            <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h3 className="text-lg font-medium mb-4">プロジェクト編集</h3>

              {/* Project */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  プロジェクト
                </label>
                <input
                  type="text"
                  value={draftState.draft.project || ''}
                  onChange={(e) => draftActions.setProject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="プロジェクト名を入力..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={cancelChanges}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 font-medium transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveChanges}
                  disabled={!draftState.hasChanges}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    draftState.hasChanges
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Timer Display */}
        <div className="mb-8">
          <div className="text-6xl md:text-7xl font-mono font-light text-gray-900 mb-2">
            {formattedTime}
          </div>
          <div className="text-sm text-gray-500">
            開始: {session.startTime.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center space-x-4">
          {/* Pause/Resume Button */}
          <button
            onClick={isActive ? pause : resume}
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
            onClick={stop}
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