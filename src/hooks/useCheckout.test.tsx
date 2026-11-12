import { focusManager, onlineManager } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useLayoutEffect, useRef } from 'react'
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
import {
  CURRENCIES_JSON,
  makePayment,
  OTHER_ORDER,
  STATE_FIXTURES,
} from '../test/fixtures'
import { createTestClient, withClient } from '../test/query'
import { resetVisibility, setVisibility } from '../test/visibility'
import { paymentKey } from './paymentCache'
import type { PaymentEntry } from './paymentCache'
import { ASSUMED_ORDER } from '../config/checkout'
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

// Waits one real task, so every promise chain runs first. The library's notifications wait on fake
// timers, so nothing reaches React and it does not render.
const drainPromises = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
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
  onlineManager.setOnline(true)
  resetVisibility()
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  vi.useRealTimers()
})

test('opens on the picker with the default order', async () => {
  const { result } = await mount()
  expect(result.current).toMatchObject({
    order: ASSUMED_ORDER,
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

test("the order shown is the URL's until a payment exists, then the payment's", async () => {
  const other = makePayment(OTHER_ORDER)
  vi.mocked(createPayment).mockResolvedValue(other)
  vi.mocked(getPayment).mockResolvedValue(other)
  const { result } = await mount('?order_id=ORD-1')
  const fromUrl = { ...ASSUMED_ORDER, order_id: 'ORD-1' }
  expect(result.current.order).toEqual(fromUrl)

  await fire(() => result.current.submit(CHOICE))
  expect(createPayment).toHaveBeenCalledWith({ order_id: 'ORD-1', ...CHOICE })
  expect(result.current.order).toMatchObject(OTHER_ORDER)

  // A payment the server no longer knows takes its order with it.
  vi.mocked(getPayment).mockRejectedValue(notFound)
  await advance(3_000)
  expect(result.current.reference).toBeNull()
  expect(result.current.order).toEqual(fromUrl)
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

test('a submit after the create answered but before it rendered is ignored', async () => {
  const create = held<Payment>()
  vi.mocked(createPayment).mockReturnValue(create.promise)
  const { result } = await mount()
  // The handler a click still reaches until React commits the payment view.
  const { submit } = result.current
  await act(async () => {
    submit(CHOICE)
    create.answer(awaiting)
    await drainPromises()
    expect(client.getQueryData(paymentKey(REFERENCE))).toBeDefined()
    expect(result.current.reference).toBeNull()
    submit(CHOICE)
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(createPayment).toHaveBeenCalledTimes(1)
  expect(requotePayment).not.toHaveBeenCalled()
  expect(result.current.reference).toBe(REFERENCE)
})

test('a submit in the commit that mounts the hook keeps the latch held', async () => {
  const create = held<Payment>()
  vi.mocked(createPayment).mockReturnValue(create.promise)
  const { result } = renderHook(
    () => {
      const checkout = useCheckout()
      const sent = useRef(false)
      // After the commit, before the passive effects flush: where a browser can deliver a click.
      useLayoutEffect(() => {
        if (sent.current) return
        sent.current = true
        checkout.submit(CHOICE)
      })
      return checkout
    },
    { wrapper: withClient(client) },
  )
  await fire(() => result.current.submit(CHOICE))
  expect(createPayment).toHaveBeenCalledTimes(1)
  await fire(() => create.answer(awaiting))
})

// A write that settles at once batches submitting's true and false into one render.
test('after a create that settles at once, the next submit goes through', async () => {
  vi.mocked(createPayment).mockRejectedValueOnce(timedOut)
  const { result } = await mount()
  await fire(() => result.current.submit(CHOICE))
  expect(result.current.submitError).toBe(timedOut)

  await fire(() => result.current.submit(CHOICE))
  expect(createPayment).toHaveBeenCalledTimes(2)
  expect(result.current.reference).toBe(REFERENCE)

  // The next write follows the payment that now exists.
  await fire(() => result.current.submit(CHOICE))
  expect(createPayment).toHaveBeenCalledTimes(2)
  expect(requotePayment).toHaveBeenCalledTimes(1)
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
    order: { order_id: 'ORD-88213' }, // the payment's, not the URL's
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

test.each(['underpaid', 'detected', 'confirming', 'paid'])(
  'changeChoice on %s keeps the payment',
  async (status) => {
    vi.mocked(getPayment).mockResolvedValue(withStatus(status))
    const { result } = await mount(`?payment=${REFERENCE}`)
    await fire(() => result.current.changeChoice())
    expect(result.current).toMatchObject({
      reference: REFERENCE,
      view: { kind: 'payment' },
    })
    expect(window.location.search).toBe(`?payment=${REFERENCE}`)
  },
)

test('changeChoice keeps a payment that is awaiting again after money was seen on this quote', async () => {
  vi.mocked(getPayment)
    .mockResolvedValueOnce(withStatus('detected'))
    .mockResolvedValue(awaiting)
  const { result } = await mount(`?payment=${REFERENCE}`)
  await advance(3_000)
  expect(result.current.payment.entry?.payment.status).toBe('awaiting_payment')

  await fire(() => result.current.changeChoice())
  expect(result.current).toMatchObject({
    reference: REFERENCE,
    view: { kind: 'payment' },
  })
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

test('a submit after the requote answered but before it rendered is ignored', async () => {
  const { result } = await onRequotePicker()
  const requote = held<Payment>()
  vi.mocked(requotePayment).mockReturnValue(requote.promise)
  const { submit } = result.current
  await act(async () => {
    submit(OTHER_CHOICE)
    // The requote is sent only after the poll in flight is cancelled.
    await drainPromises()
    requote.answer(newQuote)
    await drainPromises()
    expect(
      client.getQueryData<PaymentEntry>(paymentKey(REFERENCE))?.payment,
    ).toEqual(newQuote)
    expect(result.current.view).toMatchObject({ mode: 'requote' })
    submit(OTHER_CHOICE)
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(requotePayment).toHaveBeenCalledTimes(1)
  expect(result.current.view).toEqual({ kind: 'payment' })
})

test('after a requote that settles at once, the next submit goes through', async () => {
  const { result } = await onRequotePicker()
  await fire(() => result.current.submit(OTHER_CHOICE))
  expect(result.current.view).toEqual({ kind: 'payment' })
  await fire(() => result.current.submit(OTHER_CHOICE))
  expect(requotePayment).toHaveBeenCalledTimes(2)
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

test('a requote the server answers with 404 shows the notice without an error', async () => {
  const { result } = await onRequotePicker()
  vi.mocked(requotePayment).mockRejectedValue(notFound)
  vi.mocked(getPayment).mockRejectedValue(notFound)
  await fire(() => result.current.submit(OTHER_CHOICE))
  expect(result.current).toMatchObject({
    reference: null,
    view: { kind: 'picker', mode: 'create', notice: 'payment_not_found' },
    submitting: false,
    submitError: null,
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

test.each<[string, () => void, () => void]>([
  [
    'the tab is shown again',
    () => setVisibility('hidden'),
    () => setVisibility('visible'),
  ],
  [
    'the connection returns',
    () => onlineManager.setOnline(false),
    () => onlineManager.setOnline(true),
  ],
])(
  'a catalogue that failed for good asks again when %s',
  async (_name, leave, back) => {
    const outage = new ApiError('http', 'GET answered 503', { status: 503 })
    vi.mocked(getCurrencies).mockRejectedValue(outage)
    const { result } = renderHook(() => useCurrencies(), {
      wrapper: withClient(client),
    })
    await advance(10_000)
    expect(getCurrencies).toHaveBeenCalledTimes(3)
    expect(result.current).toMatchObject({ isLoading: false, error: outage })

    await fire(leave)
    expect(getCurrencies).toHaveBeenCalledTimes(3)
    await fire(back)
    expect(getCurrencies).toHaveBeenCalledTimes(4)
  },
)
