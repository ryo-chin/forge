/**
 * Calculate duration between start and end time in milliseconds
 */
export function calculateDuration(startTime: Date, endTime: Date): number {
  const duration = endTime.getTime() - startTime.getTime()
  return Math.max(0, duration)
}

/**
 * Calculate elapsed time from start to current time
 */
export function calculateElapsedTime(startTime: Date, currentTime?: Date): number {
  const now = currentTime || new Date()
  return calculateDuration(startTime, now)
}

/**
 * Format milliseconds to HH:MM:SS string
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map(unit => unit.toString().padStart(2, '0'))
    .join(':')
}

/**
 * Check if time range is valid (end >= start and start <= now)
 */
export function isValidTimeRange(startTime: Date, endTime: Date): boolean {
  const now = new Date()
  return startTime <= endTime && startTime <= now
}

/**
 * Adjust start time by specified minutes (negative for earlier, positive for later)
 */
export function adjustStartTime(originalTime: Date, adjustmentMinutes: number): Date {
  const adjusted = new Date(originalTime)
  adjusted.setMinutes(adjusted.getMinutes() + adjustmentMinutes)
  return adjusted
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}