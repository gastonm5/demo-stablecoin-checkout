import type { Payment } from '../api/schemas'
import { remainingMs } from './countdown'
import { currentQuote, moneySeen } from './sequence'
import type { StatusSequence } from './sequence'
import { carriesMoney } from './status'

export const FRESH_ANSWER_MS = 10_000
export const FAILURES_BEFORE_NOTICE = 2

export type ClockState =
  'running' | 'checking' | 'still_valid' | 'cannot_confirm' | 'none'

export type Screen =
  | {
      kind: 'pay'
      mode: 'full' | 'remaining'
      clock: ClockState
      showAddress: boolean
      remainingMs: number | null
    }
  | { kind: 'pay_loading' }
  | { kind: 'waiting' }
  | { kind: 'complete'; overpaid: boolean }
  | {
      kind: 'expired'
      variant: 'plain' | 'cautious' | 'dead_end'
      after: 'partial' | 'payment' | null
    }
  | { kind: 'failed'; moneySeen: 'yes' | 'no' | 'unknown' }
  | { kind: 'checking' }

export type ScreenInput = {
  payment: Payment
  sequence: StatusSequence
  now: number // device clock, ms
  lastSuccessAt: number // device time of the last valid response for this payment
  lastFailureAt: number | null
  detailsChecked: boolean // the currency list is loaded, holds the quote's currency and network under its name, and amountsToSend(payment) all fit its decimals
}

export function deriveScreen(input: ScreenInput): Screen {
  const { payment, sequence, detailsChecked } = input
  switch (payment.status) {
    case 'paid':
      return { kind: 'complete', overpaid: false }
    case 'overpaid':
      return { kind: 'complete', overpaid: true }
    case 'detected':
    case 'confirming':
      return { kind: 'waiting' }
    case 'unknown':
      return { kind: 'checking' }
    case 'failed': {
      if (moneySeen(sequence.entries))
        return { kind: 'failed', moneySeen: 'yes' }
      // After a reload the page cannot know whether money arrived earlier.
      const unknown = sequence.startedFrom === 'reload'
      return { kind: 'failed', moneySeen: unknown ? 'unknown' : 'no' }
    }
    case 'expired': {
      // An unknown status says nothing about the money; only a known one can reopen a new quote.
      const before = currentQuote(sequence)
        .slice(0, -1)
        .findLast((entry) => entry.status !== 'unknown')
      // No new quote once part or all of the money was seen: the API does not say what happens to it.
      if (before && carriesMoney(before.status)) {
        const after = before.status === 'underpaid' ? 'partial' : 'payment'
        return { kind: 'expired', variant: 'dead_end', after }
      }
      const cautious = sequence.startedFrom === 'reload'
      return {
        kind: 'expired',
        variant: cautious ? 'cautious' : 'plain',
        after: null,
      }
    }
    case 'awaiting_payment':
      // Going backwards may be a stale answer with the money already sent; an address would invite paying twice.
      if (moneySeen(currentQuote(sequence))) return { kind: 'checking' }
      if (!detailsChecked) return { kind: 'pay_loading' }
      return payInFull(input)
    case 'underpaid':
      if (!detailsChecked) return { kind: 'pay_loading' }
      // Any money stops the clock: the shopper can always send the rest.
      return {
        kind: 'pay',
        mode: 'remaining',
        clock: 'none',
        showAddress: true,
        remainingMs: null,
      }
    default:
      return payment satisfies never
  }
}

// The countdown is information, not authority: at zero only a server answer can show the address again.
function payInFull(input: ScreenInput): Screen {
  const { payment, now, lastSuccessAt, lastFailureAt } = input
  const deadline = Date.parse(payment.quote.expires_at)
  const left = remainingMs(payment.quote.expires_at, now)
  const pay = { kind: 'pay', mode: 'full', remainingMs: 0 } as const
  if (left > 0) {
    return { ...pay, clock: 'running', showAddress: true, remainingMs: left }
  }
  if (lastSuccessAt >= deadline && now - lastSuccessAt <= FRESH_ANSWER_MS) {
    return { ...pay, clock: 'still_valid', showAddress: true }
  }
  if (
    lastFailureAt !== null &&
    lastFailureAt > lastSuccessAt &&
    lastFailureAt >= deadline
  ) {
    return { ...pay, clock: 'cannot_confirm', showAddress: false }
  }
  return { ...pay, clock: 'checking', showAddress: false }
}

export type Connection = 'ok' | 'offline' | 'unreachable'

export function deriveConnection(
  online: boolean,
  consecutiveFailures: number,
): Connection {
  if (!online) return 'offline'
  if (consecutiveFailures >= FAILURES_BEFORE_NOTICE) return 'unreachable'
  return 'ok'
}
