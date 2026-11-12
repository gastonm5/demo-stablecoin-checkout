import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useDelayedFlag } from './useDelayedFlag'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function renderFlag(active: boolean) {
  return renderHook(({ active }) => useDelayedFlag(active, 4_000), {
    initialProps: { active },
  })
}

test('turns true only after the delay', () => {
  const { result } = renderFlag(true)
  expect(result.current).toBe(false)
  act(() => vi.advanceTimersByTime(3_999))
  expect(result.current).toBe(false)
  act(() => vi.advanceTimersByTime(1))
  expect(result.current).toBe(true)
})

test('stays false while it is not active', () => {
  const { result } = renderFlag(false)
  act(() => vi.advanceTimersByTime(10_000))
  expect(result.current).toBe(false)
})

test('turns false as soon as it stops being active', () => {
  const renders: { active: boolean; flag: boolean }[] = []
  const { result, rerender } = renderHook(
    ({ active }) => {
      const flag = useDelayedFlag(active, 4_000)
      renders.push({ active, flag })
      return flag
    },
    { initialProps: { active: true } },
  )
  act(() => vi.advanceTimersByTime(4_000))
  expect(result.current).toBe(true)
  rerender({ active: false })
  expect(result.current).toBe(false)
  // Not even one render may still say "still working" once the work has stopped.
  expect(renders.filter((r) => !r.active && r.flag)).toEqual([])
  // Active again: the delay starts over.
  rerender({ active: true })
  expect(result.current).toBe(false)
  act(() => vi.advanceTimersByTime(3_999))
  expect(result.current).toBe(false)
  act(() => vi.advanceTimersByTime(1))
  expect(result.current).toBe(true)
})

test('clears its timer on unmount and when it stops early', () => {
  const { rerender, unmount } = renderFlag(true)
  expect(vi.getTimerCount()).toBe(1)
  rerender({ active: false })
  expect(vi.getTimerCount()).toBe(0)
  rerender({ active: true })
  expect(vi.getTimerCount()).toBe(1)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
