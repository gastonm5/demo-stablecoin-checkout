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
  const start = Date.now()
  const { result } = renderHook(() => useNow(true))
  expect(result.current).toBe(start)
  await act(() => vi.advanceTimersByTimeAsync(1_000))
  expect(result.current).toBe(start + 1_000)
  await act(() => vi.advanceTimersByTimeAsync(2_000))
  expect(result.current).toBe(start + 3_000)
})

test('refreshes at once when the tab becomes visible', () => {
  const start = Date.now()
  const { result } = renderHook(() => useNow(true))
  act(() => setVisibility('hidden'))
  // A hidden tab's timers are throttled, so the clock moves on without them.
  vi.setSystemTime(start + 120_000)
  act(() => setVisibility('visible'))
  expect(result.current).toBe(start + 120_000)
})

test('clears its interval and listener on unmount', () => {
  const removeListener = vi.spyOn(document, 'removeEventListener')
  const { unmount } = renderHook(() => useNow(true))
  expect(vi.getTimerCount()).toBe(1)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
  expect(removeListener).toHaveBeenCalledWith(
    'visibilitychange',
    expect.any(Function),
  )
})

test('has no value while inactive, whatever the timers and the tab do', () => {
  const { result } = renderHook(() => useNow(false))
  expect(result.current).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
  act(() => vi.advanceTimersByTime(5_000))
  expect(result.current).toBeNull()
  act(() => setVisibility('hidden'))
  vi.setSystemTime(Date.now() + 120_000)
  act(() => setVisibility('visible'))
  expect(result.current).toBeNull()
})

test('has a value from its first tick once active, and none once inactive again', () => {
  const { result, rerender } = renderHook(({ active }) => useNow(active), {
    initialProps: { active: false },
  })
  rerender({ active: true })
  expect(vi.getTimerCount()).toBe(1)
  expect(result.current).toBeNull()
  act(() => vi.advanceTimersByTime(1_000))
  expect(result.current).toBe(Date.now())
  act(() => vi.advanceTimersByTime(2_000))
  expect(result.current).toBe(Date.now())
  rerender({ active: false })
  expect(vi.getTimerCount()).toBe(0)
  expect(result.current).toBeNull()
  act(() => setVisibility('hidden'))
  vi.setSystemTime(Date.now() + 120_000)
  act(() => setVisibility('visible'))
  expect(result.current).toBeNull()
})
