import { expect, test } from 'vitest'
import type { DecimalString } from '../api/schemas'
import { makePayment, STATE_FIXTURES } from '../test/fixtures'
import { amountsToSend, fitsDecimals, fractionDigits } from './money'

test.each([
  ['163.69', 2],
  ['5', 0],
  ['0.055295738369148398', 18],
  ['120.00', 2],
])('%s has %i fraction digits', (amount, digits) => {
  expect(fractionDigits(amount as DecimalString)).toBe(digits)
})

test.each([
  ['163.69', 6, true],
  ['0.055295738369148398', 18, true],
  ['1.1234567', 6, false],
  ['5', 0, true],
])('fitsDecimals(%s, %i) is %s', (amount, decimals, fits) => {
  expect(fitsDecimals(amount as DecimalString, decimals)).toBe(fits)
})

test('amountsToSend is the total, plus the outstanding amount on underpaid', () => {
  expect(amountsToSend(makePayment())).toEqual(['163.69'])
  expect(
    amountsToSend(
      makePayment({ status: 'underpaid', ...STATE_FIXTURES.underpaid }),
    ),
  ).toEqual(['163.69', '43.69'])
})
