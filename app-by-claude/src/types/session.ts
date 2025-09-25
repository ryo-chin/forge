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