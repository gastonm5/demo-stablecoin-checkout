import { act, renderHook } from '@testing-library/react'
import type { SetStateAction } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useCopy } from './useCopy'

// React 19 silently drops an update to an unmounted component, so count the hook's updates to see one.
const stateUpdates = vi.hoisted(() => ({ count: 0 }))
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>()
  return {
    ...react,
    useState<S>(initial: S | (() => S)) {
      const [state, setState] = react.useState(initial)
      const counted = (next: SetStateAction<S>) => {
        stateUpdates.count++
        setState(next)
      }
      return [state, counted] as const
    },
  }
})

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

test.each([
  ['succeeds', (settle: Settle) => settle.resolve()],
  ['fails', (settle: Settle) => settle.reject(new Error('denied'))],
])('ignores a copy that %s after unmount', async (_, finish) => {
  const settle = {} as Settle
  writeText.mockReturnValue(
    new Promise<void>((resolve, reject) =>
      Object.assign(settle, { resolve, reject }),
    ),
  )
  const { result, unmount } = renderCopy()
  act(() => result.current.copy())
  unmount()
  const before = stateUpdates.count
  await act(async () => finish(settle))
  expect(stateUpdates.count).toBe(before)
  expect(vi.getTimerCount()).toBe(0)
})

test('counts the updates it makes while mounted', async () => {
  const { result } = renderCopy()
  const before = stateUpdates.count
  await copy(result)
  expect(stateUpdates.count).toBe(before + 1)
})

function renderCopyOf(value: string) {
  return renderHook((props: { value: string }) => useCopy(props.value), {
    initialProps: { value },
  })
}

test('is idle at once when the value changes while copied', async () => {
  const { result, rerender } = renderCopyOf('163.69')
  await copy(result)
  expect(result.current.state).toBe('copied')
  rerender({ value: '81.84' })
  expect(result.current.state).toBe('idle')
})

test.each([
  ['succeeds', (settle: Settle) => settle.resolve()],
  ['fails', (settle: Settle) => settle.reject(new Error('denied'))],
])('stays idle when a copy %s after the value changed', async (_, finish) => {
  const settle = {} as Settle
  writeText.mockReturnValue(
    new Promise<void>((resolve, reject) =>
      Object.assign(settle, { resolve, reject }),
    ),
  )
  const { result, rerender } = renderCopyOf('163.69')
  act(() => result.current.copy())
  rerender({ value: '81.84' })
  await act(async () => finish(settle))
  expect(result.current.state).toBe('idle')
})

test('stays copied when re-rendered with the same value', async () => {
  const { result, rerender } = renderCopyOf('163.69')
  await copy(result)
  rerender({ value: '163.69' })
  expect(result.current.state).toBe('copied')
})

test('shows copied for a copy of the new value', async () => {
  const { result, rerender } = renderCopyOf('163.69')
  await copy(result)
  rerender({ value: '81.84' })
  await copy(result)
  expect(writeText).toHaveBeenLastCalledWith('81.84')
  expect(result.current.state).toBe('copied')
})

function pendingWrite(): Settle {
  const settle = {} as Settle
  writeText.mockReturnValueOnce(
    new Promise<void>((resolve, reject) =>
      Object.assign(settle, { resolve, reject }),
    ),
  )
  return settle
}

test.each([
  [
    'copied',
    (settle: Settle) => settle.resolve(),
    (settle: Settle) => settle.reject(new Error('denied')),
  ],
  [
    'failed',
    (settle: Settle) => settle.reject(new Error('denied')),
    (settle: Settle) => settle.resolve(),
  ],
])(
  'stays %s when an older copy of the same value settles last',
  async (state, finishNewer, finishOlder) => {
    const older = pendingWrite()
    const newer = pendingWrite()
    const { result } = renderCopy()
    act(() => result.current.copy())
    act(() => result.current.copy())
    await act(async () => finishNewer(newer))
    expect(result.current.state).toBe(state)
    await act(async () => finishOlder(older))
    expect(result.current.state).toBe(state)
  },
)

test.each([
  ['succeeds', (settle: Settle) => settle.resolve()],
  ['fails', (settle: Settle) => settle.reject(new Error('denied'))],
])(
  'stays copied for the new value when a copy of the old value %s last',
  async (_, finish) => {
    const older = pendingWrite()
    const { result, rerender } = renderCopyOf('163.69')
    act(() => result.current.copy())
    rerender({ value: '81.84' })
    await copy(result)
    expect(result.current.state).toBe('copied')
    await act(async () => finish(older))
    expect(result.current.state).toBe('copied')
  },
)

type Settle = { resolve(): void; reject(reason: unknown): void }
