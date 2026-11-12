import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getMockSettings, updateMockSettings } from './mockControl'
import type { MockSettings } from './mockControl'
import { useMockSettings } from './useMockSettings'

vi.mock('./mockControl', () => ({
  getMockSettings: vi.fn(),
  updateMockSettings: vi.fn(),
}))

const SETTINGS: MockSettings = {
  quote_lifetime_seconds: 900,
  delay_ms: 0,
  fault: 'none',
  clock_offset_seconds: 0,
}

beforeEach(() => {
  vi.mocked(getMockSettings).mockReset().mockResolvedValue(SETTINGS)
  vi.mocked(updateMockSettings).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

const renderSettings = (open: boolean) =>
  renderHook((props: { open: boolean }) => useMockSettings(props.open), {
    initialProps: { open },
  })

const sentSignal = (call = 0) =>
  vi.mocked(getMockSettings).mock.calls[call]?.[0]

test('reads nothing while closed', async () => {
  const { result } = renderSettings(false)
  await act(() => Promise.resolve())
  expect(getMockSettings).not.toHaveBeenCalled()
  expect(result.current.settings).toBeUndefined()
})

test('reads once when opened and does not poll', async () => {
  vi.useFakeTimers()
  const { result, rerender } = renderSettings(false)
  rerender({ open: true })
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(getMockSettings).toHaveBeenCalledTimes(1)
  expect(result.current.settings).toEqual(SETTINGS)
})

test('reads again when reopened', async () => {
  const { rerender } = renderSettings(true)
  rerender({ open: false })
  rerender({ open: true })
  await act(() => Promise.resolve())
  expect(getMockSettings).toHaveBeenCalledTimes(2)
})

test.each([
  [
    'closed',
    (view: ReturnType<typeof renderSettings>) => view.rerender({ open: false }),
  ],
  ['unmounted', (view: ReturnType<typeof renderSettings>) => view.unmount()],
])('aborts the read when %s', (_, leave) => {
  vi.mocked(getMockSettings).mockReturnValue(new Promise(() => {}))
  const view = renderSettings(true)
  expect(sentSignal()?.aborted).toBe(false)
  leave(view)
  expect(sentSignal()?.aborted).toBe(true)
})

test('update keeps the settings the mock answers with', async () => {
  const answer: MockSettings = { ...SETTINGS, fault: 'drop', delay_ms: 3000 }
  vi.mocked(updateMockSettings).mockResolvedValue(answer)
  const { result } = renderSettings(true)
  await act(() => Promise.resolve())
  await act(async () => result.current.update({ fault: 'drop' }))
  expect(updateMockSettings).toHaveBeenCalledWith({ fault: 'drop' })
  expect(result.current.settings).toEqual(answer)
})
