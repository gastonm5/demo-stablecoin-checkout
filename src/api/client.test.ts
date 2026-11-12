import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { paymentJson } from '../test/fixtures'
import { ApiError, REQUEST_TIMEOUT_MS, request } from './client'
import { parsePayment } from './schemas'

const fetchMock = vi.fn<typeof fetch>()

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

// What a real fetch does when its signal aborts.
function hangUntilAborted(_url: unknown, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal
    signal?.addEventListener('abort', () => reject(signal.reason))
  })
}

const sentSignal = () => fetchMock.mock.calls[0]?.[1]?.signal

const QUOTE_NOT_EXPIRED = {
  type: 'https://developers.triple-a.io/errors/quote-not-expired',
  title: 'Quote has not expired',
  status: 409,
  detail: 'The quote is still valid.',
}

test('sends no-store and JSON headers', async () => {
  fetchMock.mockResolvedValue(json({}))
  await request('/api/x', { method: 'POST', body: { a: '1' }, parse: (j) => j })
  expect(fetchMock).toHaveBeenCalledWith('/api/x', {
    method: 'POST',
    body: '{"a":"1"}',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: expect.any(AbortSignal),
  })
})

test('a GET sends no body', async () => {
  fetchMock.mockResolvedValue(json({}))
  await request('/api/x', { parse: (j) => j })
  expect(fetchMock).toHaveBeenCalledWith('/api/x', {
    method: 'GET',
    body: undefined,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: expect.any(AbortSignal),
  })
})

test('returns the parsed body on 200', async () => {
  fetchMock.mockResolvedValue(json(paymentJson()))
  const payment = await request('/api/x', { parse: parsePayment })
  expect(payment).toMatchObject({
    status: 'awaiting_payment',
    quote: { total_due: '163.69' },
  })
})

test('a 500 is an http error with the status', async () => {
  fetchMock.mockResolvedValue(new Response('Internal error', { status: 500 }))
  const parse = vi.fn()
  const error = await request('/api/x', { parse }).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ kind: 'http', status: 500, problem: undefined })
  expect(parse).not.toHaveBeenCalled()
})

test('a 409 carries the problem body', async () => {
  fetchMock.mockResolvedValue(json(QUOTE_NOT_EXPIRED, 409))
  await expect(request('/api/x', { parse: (j) => j })).rejects.toMatchObject({
    kind: 'http',
    status: 409,
    problem: QUOTE_NOT_EXPIRED,
  })
})

test('a body that is not JSON is invalid', async () => {
  fetchMock.mockResolvedValue(new Response('<html>'))
  await expect(request('/api/x', { parse: (j) => j })).rejects.toMatchObject({
    kind: 'invalid',
  })
})

test('a body the parser rejects is invalid', async () => {
  fetchMock.mockResolvedValue(json({ status: 'paid' }))
  await expect(
    request('/api/x', { parse: parsePayment }),
  ).rejects.toMatchObject({ kind: 'invalid' })
})

test('a rejected fetch is a network error', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  await expect(request('/api/x', { parse: (j) => j })).rejects.toMatchObject({
    kind: 'network',
  })
})

test('gives up after ten seconds', async () => {
  vi.useFakeTimers()
  fetchMock.mockImplementation(hangUntilAborted)
  const p = request('/api/x', { parse: (j) => j })
  const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' })
  await vi.advanceTimersByTimeAsync(9_999)
  expect(sentSignal()?.aborted).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await assertion
})

test('a caller abort is not an ApiError', async () => {
  fetchMock.mockImplementation(hangUntilAborted)
  const caller = new AbortController()
  const p = request('/api/x', { signal: caller.signal, parse: (j) => j })
  caller.abort()
  const error = await p.catch((e: unknown) => e)
  expect(error).toBe(caller.signal.reason)
  expect(error).toHaveProperty('name', 'AbortError')
})

test('an aborted signal sends nothing', async () => {
  const caller = new AbortController()
  caller.abort()
  await expect(
    request('/api/x', { signal: caller.signal, parse: (j) => j }),
  ).rejects.toBe(caller.signal.reason)
  expect(fetchMock).not.toHaveBeenCalled()
})

test.each<[string, () => void, (caller: AbortController) => unknown]>([
  ['a success', () => fetchMock.mockResolvedValue(json({})), () => {}],
  [
    'an http error',
    () => fetchMock.mockResolvedValue(new Response('', { status: 500 })),
    () => {},
  ],
  [
    'an invalid body',
    () => fetchMock.mockResolvedValue(new Response('<html>')),
    () => {},
  ],
  [
    'a network error',
    () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch')),
    () => {},
  ],
  [
    'a timeout',
    () => fetchMock.mockImplementation(hangUntilAborted),
    () => vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS),
  ],
  [
    'a caller abort',
    () => fetchMock.mockImplementation(hangUntilAborted),
    (caller) => caller.abort(),
  ],
])(
  'clears its timer and listener when the request settles: %s',
  async (_name, arrange, settle) => {
    vi.useFakeTimers()
    arrange()
    const caller = new AbortController()
    const add = vi.spyOn(caller.signal, 'addEventListener')
    const remove = vi.spyOn(caller.signal, 'removeEventListener')
    const done = request('/api/x', { signal: caller.signal, parse: (j) => j })
      .then(() => 'settled')
      .catch(() => 'settled')
    expect(vi.getTimerCount()).toBe(1)
    await settle(caller)
    expect(await done).toBe('settled')
    expect(vi.getTimerCount()).toBe(0)
    expect(add).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0]?.[1])
  },
)
