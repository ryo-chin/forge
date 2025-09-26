import { useReducer, useCallback } from 'react'
import type { DraftState, DraftAction, SessionDraft } from '../types/session'

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'UPDATE_TASK_NAME':
      return {
        ...state,
        draft: {
          ...state.draft,
          taskName: action.payload,
        },
        hasChanges: true,
      }

    case 'ADD_TAG': {
      const currentTags = state.draft.tags || []
      const newTag = action.payload
      if (!newTag || currentTags.includes(newTag)) return state

      return {
        ...state,
        draft: {
          ...state.draft,
          tags: [...currentTags, newTag],
        },
        hasChanges: true,
      }
    }

    case 'REMOVE_TAG': {
      const tagsToFilter = state.draft.tags || []
      return {
        ...state,
        draft: {
          ...state.draft,
          tags: tagsToFilter.filter(tag => tag !== action.payload),
        },
        hasChanges: true,
      }
    }

    case 'SET_PROJECT':
      return {
        ...state,
        draft: {
          ...state.draft,
          project: action.payload,
        },
        hasChanges: true,
      }

    case 'SET_SKILL':
      return {
        ...state,
        draft: {
          ...state.draft,
          skill: action.payload,
        },
        hasChanges: true,
      }

    case 'CLEAR_DRAFT':
      return {
        draft: {},
        hasChanges: false,
      }

    default:
      return state
  }
}

export interface DraftReducerHook {
  state: DraftState
  dispatch: React.Dispatch<DraftAction>
  actions: {
    updateTaskName: (taskName: string) => void
    addTag: (tag: string) => void
    removeTag: (tag: string) => void
    setProject: (project: string) => void
    setSkill: (skill: string) => void
    clearDraft: () => void
  }
}

/**
 * Custom hook for managing session draft state with typed actions
 */
export function useDraftReducer(initialDraft: SessionDraft = {}): DraftReducerHook {
  const [state, dispatch] = useReducer(draftReducer, {
    draft: initialDraft,
    hasChanges: false,
  })

  const actions = {
    updateTaskName: useCallback((taskName: string) => {
      dispatch({ type: 'UPDATE_TASK_NAME', payload: taskName })
    }, []),

    addTag: useCallback((tag: string) => {
      dispatch({ type: 'ADD_TAG', payload: tag })
    }, []),

    removeTag: useCallback((tag: string) => {
      dispatch({ type: 'REMOVE_TAG', payload: tag })
    }, []),

    setProject: useCallback((project: string) => {
      dispatch({ type: 'SET_PROJECT', payload: project })
    }, []),

    setSkill: useCallback((skill: string) => {
      dispatch({ type: 'SET_SKILL', payload: skill })
    }, []),

    clearDraft: useCallback(() => {
      dispatch({ type: 'CLEAR_DRAFT' })
    }, []),
  }

  return { state, dispatch, actions }
}