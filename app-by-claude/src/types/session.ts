export interface Session {
  id: string
  taskName: string
  startTime: Date
  endTime?: Date
  duration?: number // milliseconds
  tags?: string[]
  project?: string
  skill?: string
  isActive: boolean
}

export type SessionStatus = 'active' | 'paused' | 'completed'

export interface TimerState {
  currentSession: Session | null
  sessions: Session[]
  status: SessionStatus
  elapsedTime: number // milliseconds
}

export interface CreateSessionInput {
  taskName: string
  startTime?: Date
  tags?: string[]
  project?: string
  skill?: string
}

// Draft types for editing sessions in progress
export interface SessionDraft {
  taskName?: string
  tags?: string[]
  project?: string
  skill?: string
}

export interface DraftAction {
  type: 'UPDATE_TASK_NAME' | 'ADD_TAG' | 'REMOVE_TAG' | 'SET_PROJECT' | 'SET_SKILL' | 'CLEAR_DRAFT'
  payload?: string
}

export interface DraftState {
  draft: SessionDraft
  hasChanges: boolean
}