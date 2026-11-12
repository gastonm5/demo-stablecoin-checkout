import type { DecimalString } from '../api/schemas'

export function formatFiat(
  amount: DecimalString,
  currency: string,
  locale = navigator.language,
): string {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    })
    // The string itself, never a number: the formatter keeps every digit of a decimal string.
    // The ES2023 typings take only a `${number}` literal, which a validated string is not.
    return (formatter.format as (value: string) => string)(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

// The catalogue's fees are read as US dollars; see the design doc's assumptions.
export function formatUsdFee(amount: DecimalString, locale?: string): string {
  return `≈ ${formatFiat(amount, 'USD', locale)}`
}

export function usualTime(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`
}

export function networkShortName(name: string): string {
  return name.replace(/\s*\(.*\)$/, '')
}

export function formatDateTime(
  iso: string,
  locale = navigator.language,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function confirmationsLabel(count: number): string {
  return count === 1 ? '1 confirmation' : `${count} confirmations`
}
