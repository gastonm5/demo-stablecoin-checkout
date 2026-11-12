import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useCopy } from './useCopy'

const writeText = vi.fn<(value: string) => Promise<void>>()

function setClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  writeText.mockReset().mockResolvedValue(undefined)
  setClipboard({ writeText })
})

afterEach(() => {
  vi.useRealTimers()
  setClipboard(undefined)
})

function renderCopy() {
  return renderHook(() => useCopy('163.69'))
}

async function copy(result: { current: ReturnType<typeof useCopy> }) {
  await act(async () => result.current.copy())
}

test('is copied for two seconds, then idle', async () => {
  const { result } = renderCopy()
  expect(result.current.state).toBe('idle')
  await copy(result)
  expect(writeText).toHaveBeenCalledExactlyOnceWith('163.69')
  expect(result.current.state).toBe('copied')
  act(() => vi.advanceTimersByTime(1_999))
  expect(result.current.state).toBe('copied')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.state).toBe('idle')
})

test('is failed for four seconds when the clipboard rejects', async () => {
  writeText.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
  const { result } = renderCopy()
  await copy(result)
  expect(result.current.state).toBe('failed')
  act(() => vi.advanceTimersByTime(3_999))
  expect(result.current.state).toBe('failed')
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.state).toBe('idle')
})

test.each([
  ['there is no clipboard', undefined],
  [
    'writing throws at once',
    {
      writeText: () => {
        throw new TypeError('Not allowed')
      },
    },
  ],
])('is failed when %s, and does not throw', async (_, clipboard) => {
  setClipboard(clipboard)
  const { result } = renderCopy()
  await act(async () => expect(() => result.current.copy()).not.toThrow())
  expect(result.current.state).toBe('failed')
  act(() => vi.advanceTimersByTime(4_000))
  expect(result.current.state).toBe('idle')
})

test('a second copy replaces the first timer', async () => {
  const { result } = renderCopy()
  await copy(result)
  act(() => vi.advanceTimersByTime(1_500))
  await copy(result)
  expect(vi.getTimerCount()).toBe(1)
  act(() => vi.advanceTimersByTime(1_500))
  expect(result.current.state).toBe('copied')
  act(() => vi.advanceTimersByTime(500))
  expect(result.current.state).toBe('idle')
})

test('clears its timer on unmount', async () => {
  const { result, unmount } = renderCopy()
  await copy(result)
  expect(vi.getTimerCount()).toBe(1)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('starts no timer when the copy finishes after unmount', async () => {
  let finish = () => {}
  writeText.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
  const { result, unmount } = renderCopy()
  act(() => result.current.copy())
  unmount()
  await act(async () => finish())
  expect(vi.getTimerCount()).toBe(0)
})
