import { expect, test } from 'vitest'
import type { DecimalString } from '../api/schemas'
import { makePayment, paymentWith, STATE_FIXTURES } from '../test/fixtures'
import { amountsToSend, fitsDecimals, fractionDigits, toSend } from './money'

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

test('toSend on awaiting_payment is the quote total and the quote address', () => {
  expect(toSend(paymentWith('awaiting_payment'))).toEqual({
    amount: '163.69',
    address: 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e',
  })
})

test('toSend on underpaid is the outstanding amount and the address the status gives', () => {
  const payment = paymentWith('underpaid', {
    crypto_address: 'TXYZ9w8v7u6t5s4r3q2p1n9m8k7j6h5g4f',
  })
  expect(payment.quote.crypto_address).toBe(
    'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e',
  )
  expect(toSend(payment)).toEqual({
    amount: '43.69',
    address: 'TXYZ9w8v7u6t5s4r3q2p1n9m8k7j6h5g4f',
  })
})
