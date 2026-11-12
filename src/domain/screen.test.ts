import { expect, test } from 'vitest'
import type { Payment } from '../api/schemas'
import { makePayment, STATE_FIXTURES } from '../test/fixtures'
import { deriveConnection, deriveScreen } from './screen'
import type { ScreenInput } from './screen'
import { recordStatus, startSequence } from './sequence'

const D = Date.parse(makePayment().quote.expires_at)
const NEW_QUOTE = { expires_at: '2026-08-14T09:07:10.842Z' }

function withStatus(status: string, quote?: Record<string, unknown>) {
  return makePayment({ status, ...STATE_FIXTURES[status] }, quote)
}

const input = (over: Partial<ScreenInput>): ScreenInput => ({
  payment: makePayment(),
  sequence: startSequence(makePayment(), 'creation', D - 60_000),
  now: D - 30_000,
  lastSuccessAt: D - 31_000,
  lastFailureAt: null,
  amountsChecked: true,
  ...over,
})

// The last payment is the server's current answer, as it always is for the page.
function after(
  payments: Payment[],
  startedFrom: 'creation' | 'reload' = 'creation',
  over: Partial<ScreenInput> = {},
) {
  const [first, ...rest] = payments
  const sequence = rest.reduce(
    (s, p, i) => recordStatus(s, p, D - 60_000 + i + 1),
    startSequence(first, startedFrom, D - 60_000),
  )
  return deriveScreen(
    input({ payment: payments[payments.length - 1], sequence, ...over }),
  )
}

const statuses = (
  list: string[],
  startedFrom: 'creation' | 'reload' = 'creation',
  over: Partial<ScreenInput> = {},
) =>
  after(
    list.map((s) => withStatus(s)),
    startedFrom,
    over,
  )

const PAY_REMAINING = {
  kind: 'pay',
  mode: 'remaining',
  clock: 'none',
  showAddress: true,
  remainingMs: null,
}

test('time left shows the pay screen with a running clock', () => {
  expect(deriveScreen(input({}))).toEqual({
    kind: 'pay',
    mode: 'full',
    clock: 'running',
    showAddress: true,
    remainingMs: 30_000,
  })
})

test.each([
  [
    'checking: at zero with no answer since the deadline',
    { now: D + 1, lastSuccessAt: D - 500 },
    'checking',
    false,
  ],
  [
    'checking: exactly at the deadline',
    { now: D, lastSuccessAt: D - 500 },
    'checking',
    false,
  ],
  [
    'still valid: a fresh answer after the deadline',
    { now: D + 5_000, lastSuccessAt: D + 100 },
    'still_valid',
    true,
  ],
  [
    'still valid: an answer exactly ten seconds old',
    { now: D + 10_100, lastSuccessAt: D + 100 },
    'still_valid',
    true,
  ],
  [
    'checking again: that answer is older than ten seconds',
    { now: D + 10_200, lastSuccessAt: D + 100 },
    'checking',
    false,
  ],
  [
    'cannot confirm: the check after the deadline failed',
    { now: D + 1_000, lastSuccessAt: D - 500, lastFailureAt: D + 200 },
    'cannot_confirm',
    false,
  ],
  [
    'checking: the failure came before the deadline',
    { now: D + 1_000, lastSuccessAt: D - 500, lastFailureAt: D - 200 },
    'checking',
    false,
  ],
  [
    'checking: the failure came before the last answer',
    { now: D + 20_000, lastSuccessAt: D + 100, lastFailureAt: D + 50 },
    'checking',
    false,
  ],
  [
    'still valid: a failure after a fresh answer waits out the ten seconds',
    { now: D + 5_000, lastSuccessAt: D + 100, lastFailureAt: D + 3_000 },
    'still_valid',
    true,
  ],
  [
    'cannot confirm: that answer has gone stale',
    { now: D + 10_200, lastSuccessAt: D + 100, lastFailureAt: D + 3_000 },
    'cannot_confirm',
    false,
  ],
])('%s', (_name, over, clock, showAddress) => {
  expect(deriveScreen(input(over))).toMatchObject({
    kind: 'pay',
    mode: 'full',
    clock,
    showAddress,
    remainingMs: 0,
  })
})

test('a clock two minutes behind after a hidden tab is just a smaller number', () => {
  expect(deriveScreen(input({ now: D - 150_000 }))).toMatchObject({
    remainingMs: 150_000,
  })
  expect(deriveScreen(input({ now: D - 30_000 }))).toMatchObject({
    remainingMs: 30_000,
  })
})

test('underpaid shows the remaining amount with no clock', () => {
  expect(statuses(['awaiting_payment', 'underpaid'])).toEqual(PAY_REMAINING)
})

test('underpaid past the old deadline still shows the address', () => {
  expect(
    statuses(['awaiting_payment', 'underpaid'], 'creation', {
      now: D + 3_600_000,
    }),
  ).toEqual(PAY_REMAINING)
})

test.each([['detected'], ['confirming'], ['underpaid']])(
  'awaiting_payment after %s hides the address',
  (money) => {
    for (const amountsChecked of [true, false]) {
      expect(
        statuses(['awaiting_payment', money, 'awaiting_payment'], 'creation', {
          amountsChecked,
        }),
      ).toEqual({ kind: 'checking' })
    }
  },
)

test('only a new quote brings the address back', () => {
  expect(
    after([
      makePayment(),
      withStatus('detected'),
      withStatus('awaiting_payment', NEW_QUOTE),
    ]),
  ).toMatchObject({ kind: 'pay', mode: 'full', showAddress: true })
})

test('the pay screen waits for the amount check', () => {
  expect(deriveScreen(input({ amountsChecked: false }))).toEqual({
    kind: 'pay_loading',
  })
  expect(
    statuses(['awaiting_payment', 'underpaid'], 'creation', {
      amountsChecked: false,
    }),
  ).toEqual({ kind: 'pay_loading' })
})

test.each([
  ['detected', { kind: 'waiting' }],
  ['confirming', { kind: 'waiting' }],
  ['paid', { kind: 'complete', overpaid: false }],
  ['overpaid', { kind: 'complete', overpaid: true }],
  ['settling', { kind: 'checking' }],
  ['expired', { kind: 'expired', variant: 'plain', after: null }],
  ['failed', { kind: 'failed', moneySeen: 'no' }],
])(
  'status-only screens do not wait for the amount check: %s',
  (status, screen) => {
    expect(
      statuses(['awaiting_payment', status], 'creation', {
        amountsChecked: false,
      }),
    ).toEqual(screen)
  },
)

test.each([
  [
    'plain',
    ['awaiting_payment', 'expired'],
    'creation',
    { variant: 'plain', after: null },
  ],
  [
    'dead end after a partial payment',
    ['awaiting_payment', 'underpaid', 'expired'],
    'creation',
    { variant: 'dead_end', after: 'partial' },
  ],
  [
    'dead end after a full payment was seen',
    ['awaiting_payment', 'detected', 'expired'],
    'creation',
    { variant: 'dead_end', after: 'payment' },
  ],
  [
    'plain again when the money went away first',
    ['awaiting_payment', 'detected', 'awaiting_payment', 'expired'],
    'creation',
    { variant: 'plain', after: null },
  ],
  [
    'cautious after a reload',
    ['expired'],
    'reload',
    { variant: 'cautious', after: null },
  ],
  [
    'evidence beats caution',
    ['underpaid', 'expired'],
    'reload',
    { variant: 'dead_end', after: 'partial' },
  ],
  ...(['detected', 'confirming', 'paid', 'overpaid'] as const).map(
    (money) =>
      [
        `dead end straight after ${money}`,
        [money, 'expired'],
        'creation',
        { variant: 'dead_end', after: 'payment' },
      ] as const,
  ),
  [
    'dead end straight after underpaid',
    ['underpaid', 'expired'],
    'creation',
    { variant: 'dead_end', after: 'partial' },
  ],
  // settling is a status the page does not know, so it parses as unknown.
  [
    'an unknown status after a partial payment does not reopen a new quote',
    ['awaiting_payment', 'underpaid', 'settling', 'expired'],
    'creation',
    { variant: 'dead_end', after: 'partial' },
  ],
  [
    'an unknown status after a full payment does not reopen a new quote',
    ['awaiting_payment', 'detected', 'settling', 'expired'],
    'creation',
    { variant: 'dead_end', after: 'payment' },
  ],
  [
    'plain when only an unknown status came before',
    ['awaiting_payment', 'settling', 'expired'],
    'creation',
    { variant: 'plain', after: null },
  ],
  [
    'cautious when only an unknown status came before a reload',
    ['settling', 'expired'],
    'reload',
    { variant: 'cautious', after: null },
  ],
  [
    'plain when the server said awaiting_payment after the money',
    ['awaiting_payment', 'detected', 'awaiting_payment', 'settling', 'expired'],
    'creation',
    { variant: 'plain', after: null },
  ],
] as const)('expired: %s', (_name, list, startedFrom, expected) => {
  // The default clock still shows time left: the server's expired wins over it.
  expect(statuses([...list], startedFrom)).toEqual({
    kind: 'expired',
    ...expected,
  })
})

test('expired after a requote ignores money on the earlier quote', () => {
  expect(
    after([
      withStatus('underpaid'),
      withStatus('expired'),
      withStatus('awaiting_payment', NEW_QUOTE),
      withStatus('expired', NEW_QUOTE),
    ]),
  ).toEqual({ kind: 'expired', variant: 'plain', after: null })
})

test('expired on a new quote looks only at that quote', () => {
  expect(
    after([withStatus('underpaid'), withStatus('expired', NEW_QUOTE)]),
  ).toEqual({ kind: 'expired', variant: 'plain', after: null })
})

test.each([
  [['awaiting_payment', 'failed'], 'creation', 'no'],
  [['awaiting_payment', 'confirming', 'failed'], 'creation', 'yes'],
  [['failed'], 'reload', 'unknown'],
  [['underpaid', 'expired', 'failed'], 'reload', 'yes'],
] as const)(
  'failed: %j from %s -> moneySeen %s',
  (list, startedFrom, moneySeen) => {
    expect(statuses([...list], startedFrom)).toEqual({
      kind: 'failed',
      moneySeen,
    })
  },
)

test('failed counts money seen on an earlier quote', () => {
  expect(
    after([
      withStatus('underpaid'),
      withStatus('expired'),
      withStatus('awaiting_payment', NEW_QUOTE),
      withStatus('failed', NEW_QUOTE),
    ]),
  ).toEqual({ kind: 'failed', moneySeen: 'yes' })
})

test('paid, overpaid, detected, confirming and unknown', () => {
  expect(statuses(['paid'])).toEqual({ kind: 'complete', overpaid: false })
  expect(statuses(['overpaid'])).toEqual({ kind: 'complete', overpaid: true })
  expect(statuses(['detected'])).toEqual({ kind: 'waiting' })
  expect(statuses(['confirming'])).toEqual({ kind: 'waiting' })
  expect(statuses(['awaiting_payment', 'settling'])).toEqual({
    kind: 'checking',
  })
})

test('deriveConnection', () => {
  expect(deriveConnection(false, 0)).toBe('offline')
  expect(deriveConnection(true, 0)).toBe('ok')
  expect(deriveConnection(true, 1)).toBe('ok')
  expect(deriveConnection(true, 2)).toBe('unreachable')
  expect(deriveConnection(false, 5)).toBe('offline')
})
