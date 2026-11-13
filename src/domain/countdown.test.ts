import { expect, test } from 'vitest'
import { formatRemaining, remainingMs, remainingShare } from './countdown'

test.each([
  [767_000, '12:47'],
  [59_999, '1:00'],
  [1, '0:01'],
  [999, '0:01'],
  [1_000, '0:01'],
  [1_001, '0:02'],
  [0, '0:00'],
  [-5, '0:00'],
  [3_599_000, '59:59'],
  [3_599_999, '1:00:00'],
  [3_600_000, '1:00:00'],
  [3_723_000, '1:02:03'],
])('formatRemaining(%i) is %s', (ms, expected) => {
  expect(formatRemaining(ms)).toBe(expected)
})

test('remainingMs is the deadline minus now', () => {
  const expiresAt = '2026-08-14T08:52:10.842Z'
  const deadline = Date.parse(expiresAt)
  expect(remainingMs(expiresAt, deadline - 767_000)).toBe(767_000)
  expect(remainingMs(expiresAt, deadline + 5_000)).toBe(-5_000)
  expect(remainingMs('2026-08-14T10:52:10.842+02:00', deadline)).toBe(0)
})

test.each([
  [900_000, 900_000, 1],
  [450_000, 900_000, 0.5],
  [1, 900_000, 1 / 900_000],
  [0, 900_000, 0],
  [-5_000, 900_000, 0],
  [960_000, 900_000, 1],
])('remainingShare(%i, %i) is %d', (left, lifetime, expected) => {
  expect(remainingShare(left, lifetime)).toBe(expected)
})
