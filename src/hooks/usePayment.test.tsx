import { focusManager, onlineManager } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../api/client'
import { getPayment, isNotFound, requotePayment } from '../api/endpoints'
import type { Payment } from '../api/schemas'
import { makePayment, STATE_FIXTURES } from '../test/fixtures'
import { createTestClient, withClient } from '../test/query'
import { resetVisibility, setVisibility } from '../test/visibility'
import { paymentKey, runRequote, seedCreatedPayment } from './paymentCache'
import type { PaymentEntry } from './paymentCache'
import { usePayment } from './usePayment'

vi.mock('../api/endpoints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/endpoints')>()),
  getPayment: vi.fn(),
  requotePayment: vi.fn(),
}))

const REFERENCE = 'AQH-100306-PMT'
const key = paymentKey(REFERENCE)
const CHOICE = { currency: 'USDT', network: 'tron' }
const NEW_QUOTE = { expires_at: '2026-08-14T09:07:10.842Z' }

const withStatus = (status: string, quote?: Record<string, unknown>) =>
  makePayment({ status, ...STATE_FIXTURES[status] }, quote)
const awaiting = withStatus('awaiting_payment')
const serverError = new ApiError('http', 'GET answered 500', { status: 500 })
const notFound = new ApiError('http', 'GET answered 404', { status: 404 })
const refused = new ApiError('http', 'POST answered 409', {
  status: 409,
  problem: {
    type: 'https://developers.triple-a.io/errors/quote-not-expired',
    title: 'Quote has not expired',
    status: 409,
  },
})
const timedOut = new ApiError('timeout', 'POST gave up after 10000 ms')

type Call = {
  at: number
  signal: AbortSignal | undefined
  answer: (payment: Payment) => void
  fail: (error: unknown) => void
}

let client: QueryClient
let calls: Call[]
let inFlight: number
let maxInFlight: number
// What the fake server does with each request it receives.
let serve: (call: Call) => void

function fakeGetPayment(_reference: string, signal?: AbortSignal) {
  inFlight += 1
  maxInFlight = Math.max(maxInFlight, inFlight)
  const promise = new Promise<Payment>((answer, fail) => {
    const call = { at: Date.now(), signal, answer, fail }
    calls.push(call)
    serve(call)
  })
  return promise.finally(() => {
    inFlight -= 1
  })
}

const answerWith = (payment: Payment) => {
  serve = (call) => call.answer(payment)
}
const failWith = (error: unknown) => {
  serve = (call) => call.fail(error)
}
// Like fetch, the request rejects when its signal aborts.
const hold = () => {
  serve = (call) =>
    call.signal?.addEventListener('abort', () => call.fail(call.signal?.reason))
}
// Stays open after an abort: how the server sees it, and how a late answer can still arrive.
const holdThroughAbort = () => {
  serve = () => {}
}

// A new failure count reaches the interval when the hook re-renders. Fake timers run the library's
// zero-delay notification 1 ms late, so each act ends on a whole second, where polls land, and renders there.
async function advance(ms: number) {
  for (let left = ms; left > 0; left -= 1_000) {
    await act(() => vi.advanceTimersByTimeAsync(Math.min(left, 1_000)))
  }
}

const fire = (trigger: () => void) =>
  act(async () => {
    trigger()
    await vi.advanceTimersByTimeAsync(0)
  })

async function mount() {
  const hook = renderHook(() => usePayment(REFERENCE), {
    wrapper: withClient(client),
  })
  await fire(() => {})
  return hook
}

beforeEach(() => {
  vi.useFakeTimers()
  client = createTestClient()
  calls = []
  inFlight = 0
  maxInFlight = 0
  answerWith(awaiting)
  vi.mocked(getPayment).mockReset().mockImplementation(fakeGetPayment)
  vi.mocked(requotePayment).mockReset()
})

afterEach(() => {
  cleanup()
  // A notification already queued may fire once more; a leaked interval would fire and reschedule.
  vi.runOnlyPendingTimers()
  expect(vi.getTimerCount()).toBe(0)
  expect(focusManager.hasListeners()).toBe(false)
  expect(onlineManager.hasListeners()).toBe(false)
  client.clear()
  onlineManager.setOnline(true)
  resetVisibility()
  vi.useRealTimers()
})

test('polls every three seconds while awaiting payment', async () => {
  await mount()
  expect(calls).toHaveLength(1)
  await advance(9_000)
  expect(calls).toHaveLength(4)
})

test.each(['paid', 'overpaid', 'failed'])(
  'stops after %s, a final status',
  async (status) => {
    await mount()
    answerWith(withStatus(status))
    await advance(3_000)
    expect(calls).toHaveLength(2)
    await advance(60_000)
    expect(calls).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(0)
  },
)

test('polls every fifteen seconds on expired', async () => {
  answerWith(withStatus('expired'))
  await mount()
  await advance(14_000)
  expect(calls).toHaveLength(1)
  await advance(1_000)
  expect(calls).toHaveLength(2)
  await advance(15_000)
  expect(calls).toHaveLength(3)
})

test('never has two requests in flight, whichever trigger fires', async () => {
  const { result } = await mount()
  holdThroughAbort()
  await advance(3_000)
  expect(calls).toHaveLength(2)

  const query = client.getQueryCache().find({ queryKey: key })
  const fetches = vi.spyOn(query!, 'fetch')
  await advance(10_000)
  await fire(() => result.current.checkNow())
  await fire(() => result.current.checkNow())
  await fire(() => setVisibility('hidden'))
  await fire(() => setVisibility('visible'))
  await fire(() => onlineManager.setOnline(false))
  await fire(() => onlineManager.setOnline(true))

  // Every trigger reached the query: three ticks, two checks, the tab's return, the reconnect.
  expect(fetches).toHaveBeenCalledTimes(7)
  expect(maxInFlight).toBe(1)
  expect(calls).toHaveLength(2)

  // However slow the answer, the next poll waits a full interval after it.
  answerWith(awaiting)
  await fire(() => calls[1].answer(awaiting))
  await advance(2_000)
  expect(calls).toHaveLength(2)
  await advance(1_000)
  expect(calls).toHaveLength(3)
  expect(maxInFlight).toBe(1)
})

test('backs off after failures and resets after a success', async () => {
  await mount()
  let failuresToSend = 4
  serve = (call) => {
    if (failuresToSend === 0) return call.answer(awaiting)
    failuresToSend -= 1
    call.fail(serverError)
  }
  await advance(78_000)
  const gaps = calls.slice(1).map((call, i) => call.at - calls[i].at)
  expect(gaps).toEqual([3_000, 6_000, 12_000, 24_000, 30_000, 3_000])
})

test('exposes the failure count and times', async () => {
  const { result } = await mount()
  expect(result.current).toMatchObject({
    consecutiveFailures: 0,
    lastFailureAt: null,
    error: null,
  })
  const { lastSuccessAt } = result.current
  expect(lastSuccessAt).toBeGreaterThan(0)

  failWith(serverError)
  await advance(3_000 + 6_000)
  expect(calls).toHaveLength(3)
  expect(result.current.consecutiveFailures).toBe(2)
  expect(result.current.lastSuccessAt).toBe(lastSuccessAt)
  expect(result.current.lastFailureAt).toBeGreaterThan(lastSuccessAt)

  answerWith(awaiting)
  await advance(12_000)
  expect(result.current).toMatchObject({ consecutiveFailures: 0, error: null })
})

test('keeps the last payment on screen when a poll fails', async () => {
  const { result } = await mount()
  failWith(serverError)
  await advance(3_000)
  expect(result.current.entry?.payment).toEqual(awaiting)
  expect(result.current.error).toBe(serverError)
})

test('a cancelled poll is not a failure', async () => {
  const { result } = await mount()
  hold()
  await advance(3_000)
  await fire(() => void client.cancelQueries({ queryKey: key }))
  expect(calls[1].signal?.aborted).toBe(true)
  expect(result.current).toMatchObject({ consecutiveFailures: 0, error: null })

  answerWith(awaiting)
  await advance(3_000)
  expect(calls).toHaveLength(3)
})

test('a hidden tab does not poll, and polls once when it returns', async () => {
  await mount()
  await fire(() => setVisibility('hidden'))
  await advance(30_000)
  expect(calls).toHaveLength(1)
  await fire(() => setVisibility('visible'))
  expect(calls).toHaveLength(2)
})

test('aborts the request in flight and stops on unmount', async () => {
  const { unmount } = await mount()
  hold()
  await advance(3_000)
  unmount()
  expect(calls[1].signal?.aborted).toBe(true)
  await advance(30_000)
  expect(calls).toHaveLength(2)
  expect(vi.getTimerCount()).toBe(0)
})

test('switching to another payment aborts the old request', async () => {
  hold()
  const { rerender } = renderHook((reference) => usePayment(reference), {
    initialProps: REFERENCE,
    wrapper: withClient(client),
  })
  rerender('AQH-100307-PMT')
  expect(calls[0].signal?.aborted).toBe(true)
  expect(calls).toHaveLength(2)
})

test('stops polling when the server no longer knows the payment', async () => {
  const { result } = await mount()
  failWith(notFound)
  await advance(3_000)
  expect(isNotFound(result.current.error)).toBe(true)
  await advance(60_000)
  expect(calls).toHaveLength(2)
})

test('a reload starts the sequence from reload', async () => {
  hold()
  const { result } = renderHook(() => usePayment(REFERENCE), {
    wrapper: withClient(client),
  })
  expect(result.current).toMatchObject({ isLoading: true, entry: undefined })
  await fire(() => calls[0].answer(awaiting))
  expect(result.current.isLoading).toBe(false)
  expect(result.current.entry?.sequence.startedFrom).toBe('reload')
})

test('a seeded payment starts from creation and records status changes', async () => {
  seedCreatedPayment(client, awaiting, Date.now())
  answerWith(withStatus('detected'))
  const { result } = await mount()
  expect(calls).toHaveLength(1)
  const sequence = result.current.entry?.sequence
  expect(sequence?.startedFrom).toBe('creation')
  expect(sequence?.entries.map((entry) => entry.status)).toEqual([
    'awaiting_payment',
    'detected',
  ])
})

test('a requote cancels the poll in flight and cannot be overwritten by it', async () => {
  answerWith(withStatus('expired'))
  await mount()
  holdThroughAbort()
  await advance(15_000)
  expect(calls).toHaveLength(2)

  const newQuote = withStatus('awaiting_payment', NEW_QUOTE)
  let abortedBeforeSend: boolean | undefined
  vi.mocked(requotePayment).mockImplementation(async () => {
    abortedBeforeSend = calls[1].signal?.aborted
    return newQuote
  })
  let requote: Promise<Payment> | undefined
  await fire(() => {
    requote = runRequote(client, REFERENCE, CHOICE)
  })
  await expect(requote).resolves.toBe(newQuote)
  expect(abortedBeforeSend).toBe(true)
  expect(client.getQueryData<PaymentEntry>(key)?.payment).toEqual(newQuote)

  // The old poll answers last, with what the server said before the requote.
  await fire(() => calls[1].answer(withStatus('expired')))
  const payment = client.getQueryData<PaymentEntry>(key)?.payment
  expect(payment?.status).toBe('awaiting_payment')
  expect(payment?.quote.expires_at).toBe(NEW_QUOTE.expires_at)
})

test.each([
  ['refused', refused],
  ['timed-out', timedOut],
])('a %s requote re-reads the payment', async (_name, error) => {
  answerWith(withStatus('expired'))
  await mount()
  vi.mocked(requotePayment).mockRejectedValue(error)
  await act(async () => {
    await expect(runRequote(client, REFERENCE, CHOICE)).rejects.toBe(error)
  })
  expect(calls).toHaveLength(2)
})

test('does not poll while the browser is offline, and polls at once when it returns', async () => {
  await mount()
  await fire(() => onlineManager.setOnline(false))
  await advance(30_000)
  expect(calls).toHaveLength(1)
  await fire(() => onlineManager.setOnline(true))
  expect(calls).toHaveLength(2)

  // A drop shorter than one interval leaves no paused poll behind, and still polls on return.
  await advance(1_000)
  await fire(() => onlineManager.setOnline(false))
  await fire(() => onlineManager.setOnline(true))
  expect(calls).toHaveLength(3)
})

test('does nothing without a reference', async () => {
  const { result } = renderHook(() => usePayment(null), {
    wrapper: withClient(client),
  })
  await fire(() => result.current.checkNow())
  await advance(30_000)
  expect(calls).toHaveLength(0)
  expect(result.current).toMatchObject({ entry: undefined, isLoading: false })
})
