import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  getMockSettings,
  restartMockPayment,
  setMockStatus,
  updateMockSettings,
} from './mockControl'
import type { MockSettings } from './mockControl'

const fetchMock = vi.fn<typeof fetch>()

const SETTINGS: MockSettings = {
  quote_lifetime_seconds: 900,
  delay_ms: 0,
  fault: 'none',
  clock_offset_seconds: 0,
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

function hangUntilAborted(_url: unknown, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    signal?.addEventListener('abort', () => reject(signal.reason))
  })
}

const sentSignal = () => fetchMock.mock.calls[0]?.[1]?.signal

test('sends no-store and an abort signal', async () => {
  fetchMock.mockResolvedValue(json({ settings: SETTINGS, payments: [] }))
  await getMockSettings()
  expect(fetchMock).toHaveBeenCalledWith(
    '/__mock/state',
    expect.objectContaining({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    }),
  )
})

test('gives up after ten seconds', async () => {
  vi.useFakeTimers()
  fetchMock.mockImplementation(hangUntilAborted)
  const assertion = expect(getMockSettings()).rejects.toBeDefined()
  await vi.advanceTimersByTimeAsync(9_999)
  expect(sentSignal()?.aborted).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(sentSignal()?.aborted).toBe(true)
  await assertion
})

test('a caller abort cancels the request', async () => {
  fetchMock.mockImplementation(hangUntilAborted)
  const caller = new AbortController()
  const read = getMockSettings(caller.signal)
  caller.abort()
  await expect(read).rejects.toBe(caller.signal.reason)
  expect(sentSignal()?.aborted).toBe(true)
})

test('getMockSettings returns the settings from the state', async () => {
  fetchMock.mockResolvedValue(json({ settings: SETTINGS, payments: [{}] }))
  await expect(getMockSettings()).resolves.toEqual(SETTINGS)
})

test('setMockStatus posts the status for the reference', async () => {
  fetchMock.mockResolvedValue(json({}))
  await setMockStatus('AQH-100306-PMT', 'confirming', 2)
  expect(fetchMock).toHaveBeenCalledWith(
    '/__mock/payments/AQH-100306-PMT/status',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"status":"confirming","confirmations":2}',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    }),
  )
})

test('setMockStatus keeps a reference inside its path segment', async () => {
  fetchMock.mockResolvedValue(json({}))
  await setMockStatus('../settings', 'paid')
  expect(fetchMock.mock.calls[0]?.[0]).toBe(
    '/__mock/payments/..%2Fsettings/status',
  )
  expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"status":"paid"}')
})

test('restartMockPayment posts to the restart for the reference', async () => {
  fetchMock.mockResolvedValue(json({}))
  await restartMockPayment('../settings')
  expect(fetchMock).toHaveBeenCalledWith(
    '/__mock/payments/..%2Fsettings/restart',
    expect.objectContaining({
      method: 'POST',
      body: '{}',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    }),
  )
})

test('updateMockSettings posts the patch and returns the settings', async () => {
  const answer = { ...SETTINGS, fault: 'drop' }
  fetchMock.mockResolvedValue(json(answer))
  await expect(updateMockSettings({ fault: 'drop' })).resolves.toEqual(answer)
  expect(fetchMock).toHaveBeenCalledWith(
    '/__mock/settings',
    expect.objectContaining({ method: 'POST', body: '{"fault":"drop"}' }),
  )
})

test('an error answer rejects', async () => {
  fetchMock.mockResolvedValue(json({ title: 'Invalid request' }, 422))
  await expect(updateMockSettings({ delay_ms: -1 })).rejects.toThrow(
    'POST /__mock/settings answered 422',
  )
})
