import { expect, test } from 'vitest'
import type { PaymentStatus } from '../api/schemas'
import { makePayment, STATE_FIXTURES } from '../test/fixtures'
import {
  currentQuote,
  lastMoney,
  moneySeen,
  recordStatus,
  startSequence,
} from './sequence'
import { carriesMoney, isFinal } from './status'

const FIRST_QUOTE = '2026-08-14T08:52:10.842Z'
const NEW_QUOTE = { expires_at: '2026-08-14T09:07:10.842Z' }
const TX_HASH = STATE_FIXTURES.underpaid.tx_hash

function withStatus(status: string, quote?: Record<string, unknown>) {
  return makePayment({ status, ...STATE_FIXTURES[status] }, quote)
}

test('starts with one entry', () => {
  expect(startSequence(makePayment(), 'creation', 1000)).toStrictEqual({
    startedFrom: 'creation',
    quoteExpiresAt: FIRST_QUOTE,
    quoteStartIndex: 0,
    quoteStartedAt: 1000,
    entries: [{ status: 'awaiting_payment', at: 1000 }],
  })
})

test('after a reload the page did not see the quote begin', () => {
  expect(startSequence(makePayment(), 'reload', 1000).quoteStartedAt).toBe(null)
})

test('a repeated or new status on the same quote keeps its start', () => {
  let s = startSequence(makePayment(), 'creation', 1000)
  s = recordStatus(s, makePayment(), 2000)
  s = recordStatus(s, withStatus('underpaid'), 3000)
  expect(s.quoteStartedAt).toBe(1000)
  s = recordStatus(
    startSequence(makePayment(), 'reload', 1000),
    makePayment(),
    2000,
  )
  expect(s.quoteStartedAt).toBe(null)
})

test('a new quote starts when the page sees it, even after a reload', () => {
  for (const startedFrom of ['creation', 'reload'] as const) {
    let s = startSequence(withStatus('expired'), startedFrom, 1000)
    s = recordStatus(s, makePayment({}, NEW_QUOTE), 2000)
    expect(s.quoteStartedAt).toBe(2000)
  }
})

test('a repeated status updates the last entry', () => {
  let s = startSequence(makePayment(), 'creation', 1000)
  s = recordStatus(
    s,
    makePayment({ status: 'underpaid', ...STATE_FIXTURES.underpaid }),
    2000,
  )
  s = recordStatus(
    s,
    makePayment({
      status: 'underpaid',
      ...STATE_FIXTURES.underpaid,
      amount_received: '140.00',
      amount_outstanding: '23.69',
    }),
    3000,
  )
  expect(s.entries).toHaveLength(2)
  expect(s.entries[1]).toMatchObject({
    status: 'underpaid',
    at: 3000,
    amount_received: '140.00',
    amount_outstanding: '23.69',
  })
})

test('a new status appends', () => {
  let s = startSequence(makePayment(), 'creation', 1000)
  s = recordStatus(s, withStatus('detected'), 2000)
  s = recordStatus(s, makePayment({ status: 'settling' }), 3000)
  expect(s.entries).toStrictEqual([
    { status: 'awaiting_payment', at: 1000 },
    {
      status: 'detected',
      at: 2000,
      amount_received: '163.69',
      tx_hash: TX_HASH,
    },
    { status: 'unknown', at: 3000 },
  ])
})

test('a new expires_at starts a new quote', () => {
  let s = startSequence(makePayment(), 'creation', 1000)
  s = recordStatus(s, withStatus('expired'), 2000)
  s = recordStatus(s, makePayment({}, NEW_QUOTE), 3000)
  expect(s.quoteStartIndex).toBe(2)
  expect(s.quoteExpiresAt).toBe(NEW_QUOTE.expires_at)
  expect(currentQuote(s).map((e) => e.status)).toEqual(['awaiting_payment'])
})

test('a new quote starts even when the status repeats', () => {
  let s = startSequence(makePayment(), 'creation', 1000)
  s = recordStatus(s, makePayment({}, NEW_QUOTE), 2000)
  expect(s.entries).toHaveLength(2)
  expect(currentQuote(s)).toStrictEqual([
    { status: 'awaiting_payment', at: 2000 },
  ])
})

test('a backwards status on the same quote stays in the current quote', () => {
  let s = startSequence(withStatus('detected'), 'reload', 1000)
  s = recordStatus(s, makePayment(), 2000)
  expect(s.startedFrom).toBe('reload')
  expect(s.quoteStartIndex).toBe(0)
  expect(currentQuote(s).map((e) => e.status)).toEqual([
    'detected',
    'awaiting_payment',
  ])
  expect(moneySeen(currentQuote(s))).toBe(true)
})

test('does not mutate the sequence it is given', () => {
  const s = startSequence(makePayment(), 'creation', 1000)
  const before = structuredClone(s)
  recordStatus(s, makePayment(), 2000)
  recordStatus(s, withStatus('detected'), 2000)
  recordStatus(s, makePayment({}, NEW_QUOTE), 2000)
  expect(s).toStrictEqual(before)
})

test('moneySeen and lastMoney', () => {
  let s = startSequence(makePayment(), 'creation', 1000)
  expect(moneySeen(s.entries)).toBe(false)
  expect(lastMoney(s.entries)).toBeUndefined()
  s = recordStatus(s, withStatus('detected'), 2000)
  s = recordStatus(s, withStatus('underpaid'), 3000)
  s = recordStatus(s, withStatus('expired'), 4000)
  expect(moneySeen(s.entries)).toBe(true)
  expect(lastMoney(s.entries)).toStrictEqual({
    status: 'underpaid',
    at: 3000,
    amount_received: '120.00',
    amount_outstanding: '43.69',
    tx_hash: TX_HASH,
  })
})

test.each<[PaymentStatus, boolean, boolean]>([
  ['expired', false, false],
  ['overpaid', true, true],
  ['unknown', false, false],
  ['underpaid', true, false],
  ['failed', false, true],
])('%s: carriesMoney is %s, isFinal is %s', (status, money, final) => {
  expect(carriesMoney(status)).toBe(money)
  expect(isFinal(status)).toBe(final)
})
