import { focusManager, onlineManager } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../api/client'
import {
  createPayment,
  getCurrencies,
  getPayment,
  requotePayment,
} from '../api/endpoints'
import { parseCurrencies } from '../api/schemas'
import type { Payment } from '../api/schemas'
import { CURRENCIES_JSON, makePayment, STATE_FIXTURES } from '../test/fixtures'
import { createTestClient, withClient } from '../test/query'
import { useCheckout } from './useCheckout'
import { useCurrencies } from './useCurrencies'

vi.mock('../api/endpoints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/endpoints')>()),
  createPayment: vi.fn(),
  getCurrencies: vi.fn(),
  getPayment: vi.fn(),
  requotePayment: vi.fn(),
}))

const REFERENCE = 'AQH-100306-PMT'
const CHOICE = { currency: 'USDT', network: 'tron' }
const OTHER_CHOICE = { currency: 'USDC', network: 'polygon' }

const withStatus = (status: string, quote?: Record<string, unknown>) =>
  makePayment({ status, ...STATE_FIXTURES[status] }, quote)
const awaiting = withStatus('awaiting_payment')
const expired = withStatus('expired')
const newQuote = withStatus('awaiting_payment', {
  expires_at: '2026-08-14T09:07:10.842Z',
})
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

let client: QueryClient

// A request that answers only when the test says so.
function held<T>() {
  let answer: (value: T) => void = () => {}
  const promise = new Promise<T>((resolve) => {
    answer = resolve
  })
  return { promise, answer: (value: T) => answer(value) }
}

// The library's notifications are zero-delay timers, so each act lets them run.
const fire = (trigger: () => void) =>
  act(async () => {
    trigger()
    await vi.advanceTimersByTimeAsync(0)
  })

async function advance(ms: number) {
  for (let left = ms; left > 0; left -= 1_000) {
    await act(() => vi.advanceTimersByTimeAsync(Math.min(left, 1_000)))
  }
}

async function mount(search = '') {
  window.history.replaceState(null, '', `/${search}`)
  const hook = renderHook(() => useCheckout(), { wrapper: withClient(client) })
  await fire(() => {})
  return hook
}

async function onRequotePicker() {
  vi.mocked(getPayment).mockResolvedValue(expired)
  const hook = await mount(`?payment=${REFERENCE}`)
  await fire(() => hook.result.current.changeChoice())
  expect(hook.result.current.view).toEqual({
    kind: 'picker',
    mode: 'requote',
    notice: null,
  })
  return hook
}

beforeEach(() => {
  vi.useFakeTimers()
  client = createTestClient()
  vi.mocked(getPayment).mockResolvedValue(awaiting)
  vi.mocked(createPayment).mockResolvedValue(awaiting)
  vi.mocked(requotePayment).mockResolvedValue(newQuote)
})

afterEach(() => {
  cleanup()
  vi.runOnlyPendingTimers()
  expect(vi.getTimerCount()).toBe(0)
  expect(focusManager.hasListeners()).toBe(false)
  expect(onlineManager.hasListeners()).toBe(false)
  client.clear()
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  vi.useRealTimers()
})

test('opens on the picker with the default order', async () => {
  const { result } = await mount()
  expect(result.current).toMatchObject({
    orderId: 'ORD-88213',
    reference: null,
    view: { kind: 'picker', mode: 'create', notice: null },
    submitting: false,
    submitError: null,
  })
  expect(getPayment).not.toHaveBeenCalled()
})

test('submit creates a payment for the order and the choice', async () => {
  const { result } = await mount()
  await fire(() => result.current.submit(CHOICE))
  expect(createPayment).toHaveBeenCalledWith({
    order_id: 'ORD-88213',
    currency: 'USDT',
    network: 'tron',
  })
})

test('a second submit before any re-render is ignored', async () => {
  const create = held<Payment>()
  vi.mocked(createPayment).mockReturnValue(create.promise)
  const { result } = await mount()
  await fire(() => {
    result.current.submit(CHOICE)
    result.current.submit(CHOICE)
  })
  expect(createPayment).toHaveBeenCalledTimes(1)
  expect(result.current.submitting).toBe(true)

  await fire(() => create.answer(awaiting))
  expect(result.current.submitting).toBe(false)
  expect(createPayment).toHaveBeenCalledTimes(1)
})

test('after creation it shows the payment and puts the reference in the URL', async () => {
  const { result } = await mount()
  const length = window.history.length
  await fire(() => result.current.submit(CHOICE))
  await fire(() => {})

  expect(result.current).toMatchObject({
    reference: REFERENCE,
    view: { kind: 'payment' },
    submitting: false,
    submitError: null,
  })
  expect(window.location.search).toContain(`payment=${REFERENCE}`)
  expect(window.history.length).toBe(length)
  // The first poll has answered, and the page still knows it saw the payment from its creation.
  expect(getPayment).toHaveBeenCalledTimes(1)
  expect(result.current.payment.entry?.sequence.startedFrom).toBe('creation')
})

test('a failed create keeps the picker and reports the error', async () => {
  vi.mocked(createPayment).mockRejectedValue(timedOut)
  const { result } = await mount()
  await fire(() => result.current.submit(CHOICE))
  expect(result.current).toMatchObject({
    reference: null,
    view: { kind: 'picker', mode: 'create', notice: null },
    submitting: false,
    submitError: timedOut,
  })
  expect(window.location.search).toBe('')

  vi.mocked(createPayment).mockResolvedValue(awaiting)
  await fire(() => result.current.submit(CHOICE))
  expect(result.current).toMatchObject({
    view: { kind: 'payment' },
    submitError: null,
  })
})

test('a reference in the URL resumes the payment', async () => {
  const { result } = await mount(`?order_id=ORD-1&payment=${REFERENCE}`)
  expect(getPayment).toHaveBeenCalledWith(REFERENCE, expect.anything())
  expect(result.current).toMatchObject({
    orderId: 'ORD-1',
    reference: REFERENCE,
    view: { kind: 'payment' },
  })
  expect(result.current.payment.entry?.sequence.startedFrom).toBe('reload')
})

test('an unknown reference returns to the picker with a notice and clears the URL', async () => {
  vi.mocked(getPayment).mockRejectedValue(notFound)
  const { result } = await mount('?order_id=ORD-1&payment=AQH-999999-PMT')
  expect(result.current).toMatchObject({
    reference: null,
    view: { kind: 'picker', mode: 'create', notice: 'payment_not_found' },
  })
  expect(window.location.search).toBe('?order_id=ORD-1')

  // The notice clears on the next submit, which creates rather than requotes.
  vi.mocked(createPayment).mockReturnValue(held<Payment>().promise)
  await fire(() => result.current.submit(CHOICE))
  expect(result.current.view).toEqual({
    kind: 'picker',
    mode: 'create',
    notice: null,
  })
  expect(createPayment).toHaveBeenCalledTimes(1)
  expect(requotePayment).not.toHaveBeenCalled()
})

test('a payment that disappears mid-session returns to the picker with a notice', async () => {
  vi.mocked(getPayment)
    .mockResolvedValueOnce(awaiting)
    .mockRejectedValue(notFound)
  const { result } = await mount(`?payment=${REFERENCE}`)
  expect(result.current.view).toEqual({ kind: 'payment' })

  await advance(3_000)
  expect(getPayment).toHaveBeenCalledTimes(2)
  expect(result.current).toMatchObject({
    reference: null,
    view: { kind: 'picker', mode: 'create', notice: 'payment_not_found' },
  })
  expect(window.location.search).toBe('')
})

test('changing a live quote drops the payment', async () => {
  const { result } = await mount(`?order_id=ORD-1&payment=${REFERENCE}`)
  await fire(() => result.current.changeChoice())
  expect(result.current).toMatchObject({
    reference: null,
    view: { kind: 'picker', mode: 'create', notice: null },
  })
  expect(window.location.search).toBe('?order_id=ORD-1')

  // The abandoned payment is no longer polled.
  await advance(6_000)
  expect(getPayment).toHaveBeenCalledTimes(1)
})

test('changing an expired quote keeps the payment and requotes', async () => {
  const { result } = await onRequotePicker()
  expect(result.current.reference).toBe(REFERENCE)
  expect(window.location.search).toBe(`?payment=${REFERENCE}`)

  await fire(() => result.current.submit(OTHER_CHOICE))
  expect(requotePayment).toHaveBeenCalledWith(REFERENCE, OTHER_CHOICE)
  expect(createPayment).not.toHaveBeenCalled()
  expect(result.current).toMatchObject({
    reference: REFERENCE,
    view: { kind: 'payment' },
    submitError: null,
  })
  expect(result.current.payment.entry?.payment).toEqual(newQuote)
})

test('the payment keeps polling while the picker is open for a requote', async () => {
  const { result } = await onRequotePicker()
  expect(getPayment).toHaveBeenCalledTimes(1)
  await advance(15_000)
  expect(getPayment).toHaveBeenCalledTimes(2)
  expect(result.current.view).toMatchObject({ mode: 'requote' })
})

test('a late payment closes the picker', async () => {
  const { result } = await onRequotePicker()
  vi.mocked(getPayment).mockResolvedValue(withStatus('detected'))
  await advance(15_000)
  expect(result.current.view).toEqual({ kind: 'payment' })
})

test('once a late payment closes the picker, a later expiry does not reopen it', async () => {
  const { result } = await onRequotePicker()
  vi.mocked(getPayment).mockResolvedValue(withStatus('underpaid'))
  await advance(15_000)
  expect(result.current.view).toEqual({ kind: 'payment' })

  // The server ends the partial payment: the expired screen decides what to offer, not a requote picker.
  vi.mocked(getPayment).mockResolvedValue(expired)
  await advance(3_000)
  expect(result.current.payment.entry?.payment.status).toBe('expired')
  expect(result.current.view).toEqual({ kind: 'payment' })
})

test('a refused requote goes back to the payment without an error', async () => {
  const { result } = await onRequotePicker()
  vi.mocked(requotePayment).mockRejectedValue(refused)
  await fire(() => result.current.submit(OTHER_CHOICE))
  expect(result.current).toMatchObject({
    reference: REFERENCE,
    view: { kind: 'payment' },
    submitting: false,
    submitError: null,
  })
})

test('a second requote before any re-render is ignored', async () => {
  const { result } = await onRequotePicker()
  const requote = held<Payment>()
  vi.mocked(requotePayment).mockReturnValue(requote.promise)
  await fire(() => {
    result.current.submit(OTHER_CHOICE)
    result.current.submit(OTHER_CHOICE)
  })
  expect(requotePayment).toHaveBeenCalledTimes(1)
  expect(result.current.submitting).toBe(true)

  await fire(() => requote.answer(newQuote))
  expect(requotePayment).toHaveBeenCalledTimes(1)
  expect(result.current.submitting).toBe(false)
})

test('submit from the payment view requotes the expired payment', async () => {
  vi.mocked(getPayment).mockResolvedValue(expired)
  const { result } = await mount(`?payment=${REFERENCE}`)
  expect(result.current.view).toEqual({ kind: 'payment' })
  await fire(() => result.current.submit(CHOICE))
  expect(requotePayment).toHaveBeenCalledWith(REFERENCE, CHOICE)
  expect(createPayment).not.toHaveBeenCalled()
  expect(result.current.view).toEqual({ kind: 'payment' })
})

test('a requote that fails reports the error and stays on the picker', async () => {
  const { result } = await onRequotePicker()
  vi.mocked(requotePayment).mockRejectedValue(timedOut)
  await fire(() => result.current.submit(OTHER_CHOICE))
  expect(result.current).toMatchObject({
    reference: REFERENCE,
    view: { kind: 'picker', mode: 'requote', notice: null },
    submitting: false,
    submitError: timedOut,
  })
})

test('cancelChange returns to the payment', async () => {
  const { result } = await onRequotePicker()
  await fire(() => result.current.cancelChange())
  expect(result.current).toMatchObject({
    reference: REFERENCE,
    view: { kind: 'payment' },
  })
  expect(requotePayment).not.toHaveBeenCalled()
})

test('the catalogue is not retried after a 4xx', async () => {
  const unprocessable = new ApiError('http', 'GET answered 422', {
    status: 422,
  })
  vi.mocked(getCurrencies).mockRejectedValue(unprocessable)
  const { result } = renderHook(() => useCurrencies(), {
    wrapper: withClient(client),
  })
  await advance(10_000)
  expect(getCurrencies).toHaveBeenCalledTimes(1)
  expect(result.current).toMatchObject({
    currencies: undefined,
    isLoading: false,
    error: unprocessable,
  })
})

test('the catalogue retries an outage twice before it reports it, and retry asks again', async () => {
  const outage = new ApiError('http', 'GET answered 503', { status: 503 })
  vi.mocked(getCurrencies).mockRejectedValue(outage)
  const { result } = renderHook(() => useCurrencies(), {
    wrapper: withClient(client),
  })
  await fire(() => {})
  expect(result.current).toMatchObject({ isLoading: true, error: null })

  await advance(10_000)
  expect(getCurrencies).toHaveBeenCalledTimes(3)
  expect(result.current).toMatchObject({ isLoading: false, error: outage })

  const currencies = parseCurrencies(CURRENCIES_JSON)
  vi.mocked(getCurrencies).mockResolvedValue(currencies)
  await fire(() => result.current.retry())
  expect(getCurrencies).toHaveBeenCalledTimes(4)
  expect(result.current).toMatchObject({ currencies, error: null })
})
