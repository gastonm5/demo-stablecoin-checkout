import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { resetVisibility, setVisibility } from '../test/visibility'
import { useNow } from './useNow'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  resetVisibility()
  vi.useRealTimers()
})

test('ticks every second', async () => {
  const { result } = renderHook(() => useNow())
  const start = result.current
  expect(start).toBe(Date.now())
  await act(() => vi.advanceTimersByTimeAsync(1_000))
  expect(result.current).toBe(start + 1_000)
  await act(() => vi.advanceTimersByTimeAsync(2_000))
  expect(result.current).toBe(start + 3_000)
})

test('refreshes at once when the tab becomes visible', () => {
  const { result } = renderHook(() => useNow())
  const start = result.current
  act(() => setVisibility('hidden'))
  // A hidden tab's timers are throttled, so the clock moves on without them.
  vi.setSystemTime(start + 120_000)
  act(() => setVisibility('visible'))
  expect(result.current).toBe(start + 120_000)
})

test('clears its interval and listener on unmount', () => {
  const removeListener = vi.spyOn(document, 'removeEventListener')
  const { unmount } = renderHook(() => useNow())
  expect(vi.getTimerCount()).toBe(1)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
  expect(removeListener).toHaveBeenCalledWith(
    'visibilitychange',
    expect.any(Function),
  )
})
