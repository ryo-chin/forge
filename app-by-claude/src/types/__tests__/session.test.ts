import { describe, it, expect } from 'vitest'
import type { Session, CreateSessionInput, TimerState } from '../session'

describe('Session Types', () => {
  describe('Session interface', () => {
    it('should create a valid session object', () => {
      const session: Session = {
        id: 'test-id-1',
        taskName: 'Learn TypeScript',
        startTime: new Date('2025-01-01T10:00:00Z'),
        endTime: new Date('2025-01-01T11:00:00Z'),
        duration: 3600000, // 1 hour in ms
        tags: ['programming', 'learning'],
        project: 'Web Development',
        skill: 'TypeScript',
        isActive: false
      }

      expect(session.id).toBe('test-id-1')
      expect(session.taskName).toBe('Learn TypeScript')
      expect(session.duration).toBe(3600000)
      expect(session.isActive).toBe(false)
    })

    it('should allow minimal session object', () => {
      const session: Session = {
        id: 'minimal-id',
        taskName: 'Quick task',
        startTime: new Date(),
        isActive: true
      }

      expect(session.endTime).toBeUndefined()
      expect(session.duration).toBeUndefined()
      expect(session.tags).toBeUndefined()
      expect(session.project).toBeUndefined()
      expect(session.skill).toBeUndefined()
      expect(session.isActive).toBe(true)
    })
  })

  describe('CreateSessionInput interface', () => {
    it('should create valid input with minimal data', () => {
      const input: CreateSessionInput = {
        taskName: 'Test Task'
      }

      expect(input.taskName).toBe('Test Task')
      expect(input.startTime).toBeUndefined()
      expect(input.tags).toBeUndefined()
    })

    it('should create valid input with all optional fields', () => {
      const input: CreateSessionInput = {
        taskName: 'Complete Task',
        startTime: new Date('2025-01-01T09:00:00Z'),
        tags: ['urgent', 'important'],
        project: 'MVP Development',
        skill: 'React'
      }

      expect(input.taskName).toBe('Complete Task')
      expect(input.startTime).toEqual(new Date('2025-01-01T09:00:00Z'))
      expect(input.tags).toEqual(['urgent', 'important'])
      expect(input.project).toBe('MVP Development')
      expect(input.skill).toBe('React')
    })
  })

  describe('TimerState interface', () => {
    it('should create valid timer state', () => {
      const timerState: TimerState = {
        currentSession: null,
        sessions: [],
        status: 'completed',
        elapsedTime: 0
      }

      expect(timerState.currentSession).toBeNull()
      expect(timerState.sessions).toEqual([])
      expect(timerState.status).toBe('completed')
      expect(timerState.elapsedTime).toBe(0)
    })

    it('should handle active session state', () => {
      const activeSession: Session = {
        id: 'active-1',
        taskName: 'Current Work',
        startTime: new Date(),
        isActive: true
      }

      const timerState: TimerState = {
        currentSession: activeSession,
        sessions: [activeSession],
        status: 'active',
        elapsedTime: 1800000 // 30 minutes
      }

      expect(timerState.currentSession).toBe(activeSession)
      expect(timerState.sessions).toContain(activeSession)
      expect(timerState.status).toBe('active')
      expect(timerState.elapsedTime).toBe(1800000)
    })
  })
})