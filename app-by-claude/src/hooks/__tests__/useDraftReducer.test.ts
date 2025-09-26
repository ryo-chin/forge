import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDraftReducer } from '../useDraftReducer'

describe('useDraftReducer', () => {
  describe('Initial State', () => {
    it('should initialize with empty draft and no changes', () => {
      const { result } = renderHook(() => useDraftReducer())

      expect(result.current.state.draft).toEqual({})
      expect(result.current.state.hasChanges).toBe(false)
    })

    it('should initialize with provided draft', () => {
      const initialDraft = {
        taskName: 'Initial Task',
        tags: ['work'],
        project: 'Test Project',
      }

      const { result } = renderHook(() => useDraftReducer(initialDraft))

      expect(result.current.state.draft).toEqual(initialDraft)
      expect(result.current.state.hasChanges).toBe(false)
    })
  })

  describe('Task Name Updates', () => {
    it('should update task name and mark as changed', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.updateTaskName('New Task Name')
      })

      expect(result.current.state.draft.taskName).toBe('New Task Name')
      expect(result.current.state.hasChanges).toBe(true)
    })

    it('should overwrite existing task name', () => {
      const { result } = renderHook(() =>
        useDraftReducer({ taskName: 'Old Name' })
      )

      act(() => {
        result.current.actions.updateTaskName('Updated Name')
      })

      expect(result.current.state.draft.taskName).toBe('Updated Name')
      expect(result.current.state.hasChanges).toBe(true)
    })
  })

  describe('Tag Management', () => {
    it('should add tags correctly', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.addTag('work')
      })

      expect(result.current.state.draft.tags).toEqual(['work'])
      expect(result.current.state.hasChanges).toBe(true)

      act(() => {
        result.current.actions.addTag('urgent')
      })

      expect(result.current.state.draft.tags).toEqual(['work', 'urgent'])
    })

    it('should not add duplicate tags', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.addTag('work')
        result.current.actions.addTag('work') // Duplicate
      })

      expect(result.current.state.draft.tags).toEqual(['work'])
    })

    it('should remove tags correctly', () => {
      const { result } = renderHook(() =>
        useDraftReducer({ tags: ['work', 'urgent', 'personal'] })
      )

      act(() => {
        result.current.actions.removeTag('urgent')
      })

      expect(result.current.state.draft.tags).toEqual(['work', 'personal'])
      expect(result.current.state.hasChanges).toBe(true)
    })

    it('should handle removing non-existent tags gracefully', () => {
      const { result } = renderHook(() =>
        useDraftReducer({ tags: ['work'] })
      )

      act(() => {
        result.current.actions.removeTag('non-existent')
      })

      expect(result.current.state.draft.tags).toEqual(['work'])
      expect(result.current.state.hasChanges).toBe(true)
    })

    it('should handle adding to undefined tags array', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.addTag('first-tag')
      })

      expect(result.current.state.draft.tags).toEqual(['first-tag'])
    })

    it('should handle removing from undefined tags array', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.removeTag('non-existent')
      })

      expect(result.current.state.draft.tags).toEqual([])
    })
  })

  describe('Project Management', () => {
    it('should set project and mark as changed', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.setProject('My Project')
      })

      expect(result.current.state.draft.project).toBe('My Project')
      expect(result.current.state.hasChanges).toBe(true)
    })

    it('should overwrite existing project', () => {
      const { result } = renderHook(() =>
        useDraftReducer({ project: 'Old Project' })
      )

      act(() => {
        result.current.actions.setProject('New Project')
      })

      expect(result.current.state.draft.project).toBe('New Project')
      expect(result.current.state.hasChanges).toBe(true)
    })
  })

  describe('Skill Management', () => {
    it('should set skill and mark as changed', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.setSkill('Programming')
      })

      expect(result.current.state.draft.skill).toBe('Programming')
      expect(result.current.state.hasChanges).toBe(true)
    })

    it('should overwrite existing skill', () => {
      const { result } = renderHook(() =>
        useDraftReducer({ skill: 'Old Skill' })
      )

      act(() => {
        result.current.actions.setSkill('New Skill')
      })

      expect(result.current.state.draft.skill).toBe('New Skill')
      expect(result.current.state.hasChanges).toBe(true)
    })
  })

  describe('Clear Draft', () => {
    it('should clear all draft data and reset changes flag', () => {
      const { result } = renderHook(() => useDraftReducer({
        taskName: 'Test Task',
        tags: ['work', 'urgent'],
        project: 'Test Project',
        skill: 'Programming',
      }))

      // Make some changes first
      act(() => {
        result.current.actions.updateTaskName('Modified Task')
      })

      expect(result.current.state.hasChanges).toBe(true)

      // Clear the draft
      act(() => {
        result.current.actions.clearDraft()
      })

      expect(result.current.state.draft).toEqual({})
      expect(result.current.state.hasChanges).toBe(false)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle multiple operations in sequence', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.updateTaskName('Complex Task')
        result.current.actions.addTag('work')
        result.current.actions.addTag('urgent')
        result.current.actions.setProject('Important Project')
        result.current.actions.setSkill('Problem Solving')
      })

      expect(result.current.state.draft).toEqual({
        taskName: 'Complex Task',
        tags: ['work', 'urgent'],
        project: 'Important Project',
        skill: 'Problem Solving',
      })
      expect(result.current.state.hasChanges).toBe(true)
    })

    it('should maintain state consistency after multiple tag operations', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.actions.addTag('first')
        result.current.actions.addTag('second')
        result.current.actions.addTag('third')
        result.current.actions.removeTag('second')
        result.current.actions.addTag('fourth')
        result.current.actions.removeTag('first')
      })

      expect(result.current.state.draft.tags).toEqual(['third', 'fourth'])
      expect(result.current.state.hasChanges).toBe(true)
    })
  })

  describe('Dispatch Function', () => {
    it('should provide direct dispatch access for custom actions', () => {
      const { result } = renderHook(() => useDraftReducer())

      act(() => {
        result.current.dispatch({
          type: 'UPDATE_TASK_NAME',
          payload: 'Direct Dispatch Task'
        })
      })

      expect(result.current.state.draft.taskName).toBe('Direct Dispatch Task')
      expect(result.current.state.hasChanges).toBe(true)
    })
  })
})