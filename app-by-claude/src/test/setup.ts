import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock localStorage with actual storage behavior
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    }),
    hasOwnProperty: (key: string) => key in store,
  }
})()

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  })
})

afterAll(() => {
  vi.clearAllMocks()
})