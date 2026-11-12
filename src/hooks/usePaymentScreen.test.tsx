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

function result(payment: Payment): UsePaymentResult {
  return {
    entry: { payment, sequence: startSequence(payment, 'creation', 0) },
    isLoading: false,
    error: null,
    lastSuccessAt: DEADLINE - 61_000,
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

test('a failed catalogue is a details problem for a pay status only', () => {
  const failed = catalogue({ currencies: undefined, error: new Error('down') })
  const hook = mount(withStatus('awaiting_payment'), failed)
  expect(hook.result.current.detailsProblem).toBe(true)
  expect(hook.result.current.screen).toEqual({ kind: 'pay_loading' })
  hook.rerender({ p: withStatus('underpaid'), c: failed })
  expect(hook.result.current.detailsProblem).toBe(true)
  hook.rerender({ p: withStatus('detected'), c: failed })
  expect(hook.result.current.detailsProblem).toBe(false)
  expect(hook.result.current.screen).toEqual({ kind: 'waiting' })
})

test('a catalogue without the quote currency is a details problem', () => {
  const [, ...others] = parseCurrencies(CURRENCIES_JSON)
  expect(others.map((c) => c.code)).not.toContain('USDT')
  const hook = mount(
    withStatus('awaiting_payment'),
    catalogue({ currencies: others }),
  )
  expect(hook.result.current.detailsProblem).toBe(true)
  expect(hook.result.current.screen).toEqual({ kind: 'pay_loading' })
})

test('an amount with too many decimal places is a details problem', () => {
  const hook = mount(
    withStatus('awaiting_payment', { total_due: '163.1234567' }),
  )
  expect(hook.result.current.detailsProblem).toBe(true)
  expect(hook.result.current.screen).toEqual({ kind: 'pay_loading' })
  hook.rerender({
    p: makePayment({
      status: 'underpaid',
      ...STATE_FIXTURES.underpaid,
      amount_outstanding: '43.1234567',
    }),
    c: catalogue(),
  })
  expect(hook.result.current.detailsProblem).toBe(true)
  expect(hook.result.current.screen).toEqual({ kind: 'pay_loading' })
})

test('a quote network missing from the catalogue currency is a details problem', () => {
  const polygon = { network: 'polygon', network_name: 'Polygon' }
  const hook = mount(withStatus('awaiting_payment', polygon))
  expect(hook.result.current.detailsProblem).toBe(true)
  expect(hook.result.current.screen).toEqual({ kind: 'pay_loading' })
  hook.rerender({ p: withStatus('underpaid', polygon), c: catalogue() })
  expect(hook.result.current.detailsProblem).toBe(true)
  expect(hook.result.current.screen).toEqual({ kind: 'pay_loading' })
})

test('a quote network name other than the catalogue one is a details problem', () => {
  const hook = mount(withStatus('awaiting_payment', { network_name: 'Tron' }))
  expect(hook.result.current.detailsProblem).toBe(true)
  expect(hook.result.current.screen).toEqual({ kind: 'pay_loading' })
})

test('a catalogue that is still loading is not a problem yet', () => {
  const hook = mount(
    withStatus('awaiting_payment'),
    catalogue({ currencies: undefined, isLoading: true }),
  )
  expect(hook.result.current.detailsProblem).toBe(false)
  expect(hook.result.current.screen).toEqual({ kind: 'pay_loading' })
})

test('a checked quote gets the pay screen, the usual time and the connection', () => {
  const hook = mount(withStatus('awaiting_payment'))
  const state = hook.result.current
  expect(state.detailsProblem).toBe(false)
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
    variant: 'dead_end',
    after: 'partial',
  })
})
