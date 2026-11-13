import { expect, test } from 'vitest'
import { parseCurrencies } from '../api/schemas'
import { CURRENCIES_JSON, makePayment, STATE_FIXTURES } from '../test/fixtures'
import { detailsMatch } from './details'

const currencies = parseCurrencies(CURRENCIES_JSON)
const underpaid = (state: Record<string, unknown> = {}) =>
  makePayment({ status: 'underpaid', ...STATE_FIXTURES.underpaid, ...state })

test('a quote whose currency, network and amounts the list holds matches', () => {
  expect(detailsMatch(makePayment(), currencies)).toBe(true)
  expect(detailsMatch(underpaid(), currencies)).toBe(true)
})

test.each([
  [
    'the currency is missing from the list',
    makePayment(),
    currencies.filter((c) => c.code !== 'USDT'),
  ],
  [
    'the network is missing from the currency',
    makePayment({}, { network: 'polygon', network_name: 'Polygon' }),
    currencies,
  ],
  [
    'the network is listed under another name',
    makePayment({}, { network_name: 'Tron' }),
    currencies,
  ],
  [
    'total_due has more places than the currency allows',
    makePayment({}, { total_due: '163.1234567' }),
    currencies,
  ],
  [
    'amount_outstanding on underpaid has more places than the currency allows',
    underpaid({ amount_outstanding: '43.1234567' }),
    currencies,
  ],
])('no match when %s', (_, payment, list) => {
  expect(detailsMatch(payment, list)).toBe(false)
})
