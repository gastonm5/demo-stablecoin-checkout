import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { parseCurrencies } from '../api/schemas'
import type { Payment } from '../api/schemas'
import { recordStatus, startSequence } from '../domain/sequence'
import { CURRENCIES_JSON, makePayment, STATE_FIXTURES } from '../test/fixtures'
import type { Catalogue } from './useCurrencies'
import type { UsePaymentResult } from './usePayment'
import { usePaymentScreen } from './usePaymentScreen'

const DEADLINE = Date.parse('2026-08-14T08:52:10.842Z')
const NEXT_QUOTE = { expires_at: '2026-08-14T08:54:10.842Z' }

const withStatus = (status: string, quote?: Record<string, unknown>) =>
  makePayment({ status, ...STATE_FIXTURES[status] }, quote)

const catalogue = (over: Partial<Catalogue> = {}): Catalogue => ({
  currencies: parseCurrencies(CURRENCIES_JSON),
  isLoading: false,
  error: null,
  retry: vi.fn(),
  ...over,
})

const checkNow = vi.fn()

function result(
  payment: Payment,
  lastSuccessAt = DEADLINE - 61_000,
): UsePaymentResult {
  return {
    entry: { payment, sequence: startSequence(payment, 'creation', 0) },
    isLoading: false,
    error: null,
    lastSuccessAt,
    lastFailureAt: null,
    consecutiveFailures: 0,
    // A new function on every render, as usePayment returns, so a render alone re-runs any effect that uses it.
    checkNow: () => checkNow(),
  }
}

function mount(payment: Payment, cat: Catalogue = catalogue()) {
  return renderHook(({ p, c }) => usePaymentScreen(result(p), c), {
    initialProps: { p: payment, c: cat },
  })
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(DEADLINE - 60_000)
  checkNow.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

test('asks the server once when the countdown reaches zero', () => {
  mount(withStatus('awaiting_payment'))
  advance(59_000)
  expect(checkNow).not.toHaveBeenCalled()
  advance(2_000)
  expect(checkNow).toHaveBeenCalledOnce()
})

test('does not ask again on later renders of the same quote', () => {
  const hook = mount(withStatus('awaiting_payment'))
  advance(61_000)
  advance(30_000)
  hook.rerender({ p: withStatus('awaiting_payment'), c: catalogue() })
  expect(checkNow).toHaveBeenCalledOnce()
})

test('a new quote gets its own check at zero', () => {
  const hook = mount(withStatus('awaiting_payment'))
  advance(61_000)
  hook.rerender({
    p: withStatus('awaiting_payment', NEXT_QUOTE),
    c: catalogue(),
  })
  advance(118_000)
  expect(checkNow).toHaveBeenCalledOnce()
  advance(2_000)
  expect(checkNow).toHaveBeenCalledTimes(2)
})

test('does not ask when the server has answered since the deadline', () => {
  vi.setSystemTime(DEADLINE + 1_000)
  renderHook(() =>
    usePaymentScreen(
      { ...result(withStatus('awaiting_payment')), lastSuccessAt: DEADLINE },
      catalogue(),
    ),
  )
  advance(30_000)
  expect(checkNow).not.toHaveBeenCalled()
})

test('does not ask at zero for a status with no clock', () => {
  mount(withStatus('underpaid'))
  advance(120_000)
  expect(checkNow).not.toHaveBeenCalled()
})

test.each([
  'underpaid',
  'detected',
  'confirming',
  'paid',
  'overpaid',
  'expired',
  'failed',
])('runs no clock on %s', (status) => {
  mount(withStatus(status))
  expect(vi.getTimerCount()).toBe(0)
})

test('runs the clock on awaiting_payment', () => {
  mount(withStatus('awaiting_payment'))
  expect(vi.getTimerCount()).toBe(1)
})

function fromExpired() {
  return renderHook(
    ({ p, at }) => usePaymentScreen(result(p, at), catalogue()),
    { initialProps: { p: withStatus('expired'), at: Date.now() } },
  )
}

test('a new quote after a stopped clock counts down from the time of its answer', () => {
  const hook = fromExpired()
  // Set without a tick, so the clock's own value is sixty seconds old whatever runs it.
  vi.setSystemTime(Date.now() + 60_000)
  const awaiting = withStatus('awaiting_payment', NEXT_QUOTE)
  hook.rerender({ p: awaiting, at: Date.now() })
  expect(hook.result.current.screen).toEqual({
    kind: 'pay',
    mode: 'full',
    payment: awaiting,
    clock: 'running',
    showAddress: true,
    remainingMs: Date.parse(NEXT_QUOTE.expires_at) - Date.now(),
    // The fixture's sequence begins at device time zero.
    lifetimeMs: Date.parse(NEXT_QUOTE.expires_at),
  })
})

test('a quote past its deadline after a stopped clock is still valid, not counting down', () => {
  const hook = fromExpired()
  // Past the new deadline on the device, while the clock's own value is still before it.
  vi.setSystemTime(Date.parse(NEXT_QUOTE.expires_at) + 5_000)
  const awaiting = withStatus('awaiting_payment', NEXT_QUOTE)
  hook.rerender({ p: awaiting, at: Date.now() })
  expect(hook.result.current.screen).toEqual({
    kind: 'pay',
    mode: 'full',
    payment: awaiting,
    clock: 'still_valid',
    showAddress: true,
  })
  expect(checkNow).not.toHaveBeenCalled()
})

test('a new quote after the device clock went back counts down from its answer and checks at its own deadline', () => {
  const hook = fromExpired()
  // Set back without a tick, so a value the clock kept from before is an hour ahead of the answer.
  vi.setSystemTime(Date.now() - 3_600_000)
  const deadline = Date.now() + 15 * 60_000
  const awaiting = withStatus('awaiting_payment', {
    expires_at: new Date(deadline).toISOString(),
  })
  hook.rerender({ p: awaiting, at: Date.now() })
  expect(hook.result.current.screen).toEqual({
    kind: 'pay',
    mode: 'full',
    payment: awaiting,
    clock: 'running',
    showAddress: true,
    remainingMs: deadline - Date.now(),
    lifetimeMs: deadline,
  })
  expect(checkNow).not.toHaveBeenCalled()
  advance(15 * 60_000 - 1_000)
  expect(checkNow).not.toHaveBeenCalled()
  advance(2_000)
  expect(checkNow).toHaveBeenCalledOnce()
})

test('a still valid screen hides the address once its answer is more than ten seconds old', () => {
  vi.setSystemTime(DEADLINE + 1_000)
  const awaiting = withStatus('awaiting_payment')
  const { result: state } = renderHook(() =>
    usePaymentScreen(result(awaiting, DEADLINE + 1_000), catalogue()),
  )
  advance(10_000)
  expect(state.current.screen).toMatchObject({ clock: 'still_valid' })
  advance(1_000)
  expect(state.current.screen).toEqual({
    kind: 'pay',
    mode: 'full',
    payment: awaiting,
    clock: 'checking',
    showAddress: false,
  })
})

// The card that waits for the list, with "Try again" when the list cannot check this payment.
const payLoading = (payment: Payment, problem: boolean) => ({
  kind: 'pay_loading',
  payment,
  problem,
})

test('a failed catalogue is a problem for a pay status, and a status screen does not wait for it', () => {
  const failed = catalogue({ currencies: undefined, error: new Error('down') })
  const awaiting = withStatus('awaiting_payment')
  const hook = mount(awaiting, failed)
  expect(hook.result.current.screen).toEqual(payLoading(awaiting, true))
  const underpaid = withStatus('underpaid')
  hook.rerender({ p: underpaid, c: failed })
  expect(hook.result.current.screen).toEqual(payLoading(underpaid, true))
  const detected = withStatus('detected')
  hook.rerender({ p: detected, c: failed })
  expect(hook.result.current.screen).toEqual({
    kind: 'waiting',
    payment: detected,
  })
})

test('a catalogue without the quote currency is a details problem', () => {
  const [, ...others] = parseCurrencies(CURRENCIES_JSON)
  expect(others.map((c) => c.code)).not.toContain('USDT')
  const awaiting = withStatus('awaiting_payment')
  const hook = mount(awaiting, catalogue({ currencies: others }))
  expect(hook.result.current.screen).toEqual(payLoading(awaiting, true))
})

test('an amount with too many decimal places is a details problem', () => {
  const awaiting = withStatus('awaiting_payment', { total_due: '163.1234567' })
  const hook = mount(awaiting)
  expect(hook.result.current.screen).toEqual(payLoading(awaiting, true))
  const underpaid = makePayment({
    status: 'underpaid',
    ...STATE_FIXTURES.underpaid,
    amount_outstanding: '43.1234567',
  })
  hook.rerender({ p: underpaid, c: catalogue() })
  expect(hook.result.current.screen).toEqual(payLoading(underpaid, true))
})

test('a quote network missing from the catalogue currency is a details problem', () => {
  const polygon = { network: 'polygon', network_name: 'Polygon' }
  const awaiting = withStatus('awaiting_payment', polygon)
  const hook = mount(awaiting)
  expect(hook.result.current.screen).toEqual(payLoading(awaiting, true))
  const underpaid = withStatus('underpaid', polygon)
  hook.rerender({ p: underpaid, c: catalogue() })
  expect(hook.result.current.screen).toEqual(payLoading(underpaid, true))
})

test('a quote network name other than the catalogue one is a details problem', () => {
  const awaiting = withStatus('awaiting_payment', { network_name: 'Tron' })
  const hook = mount(awaiting)
  expect(hook.result.current.screen).toEqual(payLoading(awaiting, true))
})

test('a catalogue that is still loading is not a problem yet', () => {
  const awaiting = withStatus('awaiting_payment')
  const hook = mount(
    awaiting,
    catalogue({ currencies: undefined, isLoading: true }),
  )
  expect(hook.result.current.screen).toEqual(payLoading(awaiting, false))
})

// A failed refetch keeps the list it already had, and that list still checks the quote.
test('a catalogue that has both currencies and an error still gives the pay screen', () => {
  const hook = mount(
    withStatus('awaiting_payment'),
    catalogue({ error: new Error('down') }),
  )
  expect(hook.result.current.screen).toMatchObject({
    kind: 'pay',
    mode: 'full',
    showAddress: true,
  })
})

test('a checked quote gets the pay screen, the usual time and the connection', () => {
  const hook = mount(withStatus('awaiting_payment'))
  const state = hook.result.current
  expect(state.screen).toMatchObject({ kind: 'pay', clock: 'running' })
  expect(state.connection).toBe('ok')
  expect(state.usualSeconds).toBe(60)
  expect(state.money).toBeUndefined()
})

test('money is the last status that carried it', () => {
  const underpaid = withStatus('underpaid')
  const expired = withStatus('expired')
  const sequence = recordStatus(
    startSequence(underpaid, 'creation', 0),
    expired,
    1,
  )
  const { result: state } = renderHook(() =>
    usePaymentScreen(
      { ...result(expired), entry: { payment: expired, sequence } },
      catalogue(),
    ),
  )
  expect(state.current.money).toMatchObject({
    status: 'underpaid',
    amount_received: '120.00',
    amount_outstanding: '43.69',
  })
  expect(state.current.screen).toEqual({
    kind: 'expired',
    payment: expired,
    variant: 'dead_end',
    after: 'partial',
  })
})
