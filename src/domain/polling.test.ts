import { expect, test } from 'vitest'
import type { PaymentStatus } from '../api/schemas'
import { pollInterval } from './polling'

test.each<[PaymentStatus | undefined, number, number | false]>([
  [undefined, 0, 3_000],
  ['awaiting_payment', 0, 3_000],
  ['underpaid', 0, 3_000],
  ['detected', 0, 3_000],
  ['confirming', 0, 3_000],
  ['unknown', 0, 3_000],
  ['expired', 0, 15_000],
  ['paid', 0, false],
  ['overpaid', 0, false],
  ['failed', 0, false],
  ['failed', 3, false],
  ['awaiting_payment', 1, 6_000],
  ['awaiting_payment', 2, 12_000],
  ['awaiting_payment', 3, 24_000],
  ['awaiting_payment', 4, 30_000],
  ['awaiting_payment', 9, 30_000],
  [undefined, 2, 12_000],
  ['expired', 1, 15_000],
  ['expired', 3, 24_000],
  ['expired', 4, 30_000],
])('pollInterval(%s, %i) is %s', (status, failures, expected) => {
  expect(pollInterval(status, failures)).toBe(expected)
})
