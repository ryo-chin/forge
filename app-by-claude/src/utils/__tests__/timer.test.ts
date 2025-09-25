import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateDuration,
  calculateElapsedTime,
  formatDuration,
  isValidTimeRange,
  adjustStartTime
} from '../timer'

describe('Timer Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('calculateDuration', () => {
    it('should calculate duration between two dates', () => {
      const start = new Date('2025-01-01T10:00:00Z')
      const end = new Date('2025-01-01T11:30:00Z')

      const duration = calculateDuration(start, end)

      expect(duration).toBe(5400000) // 1.5 hours in milliseconds
    })

    it('should return 0 if end time is before start time', () => {
      const start = new Date('2025-01-01T11:00:00Z')
      const end = new Date('2025-01-01T10:00:00Z')

      const duration = calculateDuration(start, end)

      expect(duration).toBe(0)
    })

    it('should handle same start and end time', () => {
      const time = new Date('2025-01-01T10:00:00Z')

      const duration = calculateDuration(time, time)

      expect(duration).toBe(0)
    })
  })

  describe('calculateElapsedTime', () => {
    it('should calculate elapsed time from start to now', () => {
      const startTime = new Date('2025-01-01T10:00:00Z')
      const now = new Date('2025-01-01T10:45:00Z')
      vi.setSystemTime(now)

      const elapsed = calculateElapsedTime(startTime)

      expect(elapsed).toBe(2700000) // 45 minutes in milliseconds
    })

    it('should return 0 for future start time', () => {
      const futureTime = new Date('2025-01-01T12:00:00Z')
      const now = new Date('2025-01-01T10:00:00Z')
      vi.setSystemTime(now)

      const elapsed = calculateElapsedTime(futureTime)

      expect(elapsed).toBe(0)
    })
  })

  describe('formatDuration', () => {
    it('should format milliseconds to HH:MM:SS', () => {
      expect(formatDuration(3661000)).toBe('01:01:01') // 1h 1m 1s
      expect(formatDuration(3600000)).toBe('01:00:00') // 1h
      expect(formatDuration(60000)).toBe('00:01:00') // 1m
      expect(formatDuration(1000)).toBe('00:00:01') // 1s
      expect(formatDuration(0)).toBe('00:00:00') // 0
    })

    it('should handle large durations', () => {
      expect(formatDuration(36610000)).toBe('10:10:10') // 10h 10m 10s
    })

    it('should handle partial seconds', () => {
      expect(formatDuration(1500)).toBe('00:00:01') // 1.5s rounds down
    })
  })

  describe('isValidTimeRange', () => {
    it('should return true for valid time range', () => {
      const start = new Date('2025-01-01T10:00:00Z')
      const end = new Date('2025-01-01T11:00:00Z')

      expect(isValidTimeRange(start, end)).toBe(true)
    })

    it('should return false if end is before start', () => {
      const start = new Date('2025-01-01T11:00:00Z')
      const end = new Date('2025-01-01T10:00:00Z')

      expect(isValidTimeRange(start, end)).toBe(false)
    })

    it('should return true if start and end are same', () => {
      const time = new Date('2025-01-01T10:00:00Z')

      expect(isValidTimeRange(time, time)).toBe(true)
    })

    it('should return false for future start time', () => {
      const future = new Date('2030-01-01T10:00:00Z')
      const now = new Date()

      expect(isValidTimeRange(future, now)).toBe(false)
    })
  })

  describe('adjustStartTime', () => {
    it('should adjust start time by minutes', () => {
      const original = new Date('2025-01-01T10:00:00Z')

      const adjusted = adjustStartTime(original, -10) // 10 minutes earlier

      expect(adjusted).toEqual(new Date('2025-01-01T09:50:00Z'))
    })

    it('should handle positive adjustment', () => {
      const original = new Date('2025-01-01T10:00:00Z')

      const adjusted = adjustStartTime(original, 5) // 5 minutes later

      expect(adjusted).toEqual(new Date('2025-01-01T10:05:00Z'))
    })

    it('should handle zero adjustment', () => {
      const original = new Date('2025-01-01T10:00:00Z')

      const adjusted = adjustStartTime(original, 0)

      expect(adjusted).toEqual(original)
    })
  })
})