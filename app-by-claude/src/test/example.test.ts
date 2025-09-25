import { describe, it, expect } from 'vitest'

describe('Environment Setup Test', () => {
  it('should run basic tests', () => {
    expect(2 + 2).toBe(4)
  })

  it('should have access to vi mocks', () => {
    expect(vi).toBeDefined()
  })
})