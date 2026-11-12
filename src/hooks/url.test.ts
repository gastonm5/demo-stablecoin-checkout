import { afterEach, expect, test } from 'vitest'
import { ASSUMED_ORDER } from '../config/checkout'
import { readUrl, writeReference } from './url'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

const ORDER_1 = { ...ASSUMED_ORDER, order_id: 'ORD-1' }

test.each([
  ['', { order: ASSUMED_ORDER, reference: null }],
  ['?order_id=ORD-1', { order: ORDER_1, reference: null }],
  [
    '?payment=AQH-100306-PMT',
    { order: ASSUMED_ORDER, reference: 'AQH-100306-PMT' },
  ],
  [
    '?order_id=ORD-1&payment=AQH-1-PMT',
    { order: ORDER_1, reference: 'AQH-1-PMT' },
  ],
  // An empty reference names no payment, so there is nothing to fetch.
  ['?payment=', { order: ASSUMED_ORDER, reference: null }],
])('readUrl(%j)', (search, expected) => {
  expect(readUrl(search)).toEqual(expected)
})

test('writeReference replaces the history entry and keeps order_id', () => {
  window.history.replaceState(null, '', '/?order_id=ORD-1')
  const length = window.history.length

  writeReference('AQH-1-PMT')
  expect(window.location.search).toBe('?order_id=ORD-1&payment=AQH-1-PMT')
  expect(window.history.length).toBe(length)

  writeReference(null)
  expect(window.location.search).toBe('?order_id=ORD-1')
  expect(window.history.length).toBe(length)
})
