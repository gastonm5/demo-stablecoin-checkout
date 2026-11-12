import { expect, test } from 'vitest'
import type { DecimalString } from '../api/schemas'
import {
  confirmationsLabel,
  formatDateTime,
  formatFiat,
  formatUsdFee,
  networkShortName,
  usualTime,
} from './format'

test('formats fiat for the locale', () => {
  expect(formatFiat('149.90' as DecimalString, 'EUR', 'de-DE')).toMatch(
    /^149,90\s€$/,
  )
  expect(formatFiat('149.90' as DecimalString, 'EUR', 'en-US')).toMatch(
    /^€\s?149\.90$/,
  )
})

test('keeps a number too long for a float exact', () => {
  expect(
    formatFiat('1234567890123456.78' as DecimalString, 'EUR', 'en-US'),
  ).toMatch(/^€\s?1,234,567,890,123,456\.78$/)
})

test('falls back to the amount as sent when the currency code is rejected', () => {
  expect(formatFiat('149.90' as DecimalString, 'EURO', 'en-US')).toBe(
    '149.90 EURO',
  )
})

test.each([
  [15, '15 s'],
  [30, '30 s'],
  [60, '1 min'],
  [180, '3 min'],
])('usualTime(%i)', (seconds, expected) => {
  expect(usualTime(seconds)).toBe(expected)
})

test.each([
  ['Tron (TRC-20)', 'Tron'],
  ['Ethereum (ERC-20)', 'Ethereum'],
  ['Polygon', 'Polygon'],
])('networkShortName(%s)', (name, expected) => {
  expect(networkShortName(name)).toBe(expected)
})

test('formatUsdFee', () => {
  expect(formatUsdFee('1.00' as DecimalString, 'en-US')).toBe('≈ $1.00')
  expect(formatUsdFee('0.01' as DecimalString, 'en-US')).toBe('≈ $0.01')
})

test('confirmationsLabel', () => {
  expect(confirmationsLabel(1)).toBe('1 confirmation')
  expect(confirmationsLabel(3)).toBe('3 confirmations')
})

test('formatDateTime', () => {
  // The device's own time zone applies, and midday UTC is 14 or 15 August in every one of them.
  expect(formatDateTime('2026-08-14T12:00:00.000Z', 'en-US')).toMatch(
    /^Aug 1[45], 2026, \d{1,2}:\d{2}\s[AP]M$/,
  )
})
