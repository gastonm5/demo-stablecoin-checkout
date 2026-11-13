import type { Payment } from '../api/schemas'
import { remainingMs } from './countdown'
import { currentQuote, moneySeen } from './sequence'
import type { StatusSequence } from './sequence'
import { carriesMoney } from './status'

export const FRESH_ANSWER_MS = 10_000
export const FAILURES_BEFORE_NOTICE = 2

export type With<S extends Payment['status']> = Extract<Payment, { status: S }>

export type DetailsState = 'loading' | 'unavailable' | 'ready'

export type Screen =
  | {
      kind: 'pay'
      mode: 'full'
      payment: With<'awaiting_payment'>
      clock: 'running'
      showAddress: true
      remainingMs: number
    }
  | {
      kind: 'pay'
      mode: 'full'
      payment: With<'awaiting_payment'>
      clock: 'still_valid'
      showAddress: true
    }
  | {
      kind: 'pay'
      mode: 'full'
      payment: With<'awaiting_payment'>
      clock: 'checking' | 'cannot_confirm'
      showAddress: false
    }
  | {
      kind: 'pay'
      mode: 'remaining'
      payment: With<'underpaid'>
      clock: 'none'
      showAddress: true
    }
  | {
      kind: 'pay_loading'
      payment: With<'awaiting_payment' | 'underpaid'>
      problem: boolean
    }
  | { kind: 'waiting'; payment: With<'detected' | 'confirming'> }
  | { kind: 'complete'; payment: With<'paid' | 'overpaid'> }
  | { kind: 'expired'; payment: With<'expired'>; variant: 'plain' | 'cautious' }
  | {
      kind: 'expired'
      payment: With<'expired'>
      variant: 'dead_end'
      after: 'partial' | 'payment'
    }
  | {
      kind: 'failed'
      payment: With<'failed'>
      moneySeen: 'yes' | 'no' | 'unknown'
    }
  | { kind: 'checking'; payment: With<'unknown' | 'awaiting_payment'> }

export type ClockState = Extract<Screen, { kind: 'pay' }>['clock']

export type ScreenInput = {
  payment: Payment
  sequence: StatusSequence
  now: number // device clock, ms
  lastSuccessAt: number // device time of the last valid response for this payment
  lastFailureAt: number | null
  details: DetailsState // ready: the currency list is loaded, holds the quote's currency and network under its name, and amountsToSend(payment) all fit its decimals
}

export function deriveScreen(input: ScreenInput): Screen {
  const { payment, sequence, details } = input
  switch (payment.status) {
    case 'paid':
    case 'overpaid':
      return { kind: 'complete', payment }
    case 'detected':
    case 'confirming':
      return { kind: 'waiting', payment }
    case 'unknown':
      return { kind: 'checking', payment }
    case 'failed': {
      if (moneySeen(sequence.entries))
        return { kind: 'failed', payment, moneySeen: 'yes' }
      // After a reload the page cannot know whether money arrived earlier.
      const unknown = sequence.startedFrom === 'reload'
      return { kind: 'failed', payment, moneySeen: unknown ? 'unknown' : 'no' }
    }
    case 'expired': {
      // An unknown status says nothing about the money; only a known one can reopen a new quote.
      const before = currentQuote(sequence)
        .slice(0, -1)
        .findLast((entry) => entry.status !== 'unknown')
      // No new quote once part or all of the money was seen: the API does not say what happens to it.
      if (before && carriesMoney(before.status)) {
        const after = before.status === 'underpaid' ? 'partial' : 'payment'
        return { kind: 'expired', payment, variant: 'dead_end', after }
      }
      const cautious = sequence.startedFrom === 'reload'
      return {
        kind: 'expired',
        payment,
        variant: cautious ? 'cautious' : 'plain',
      }
    }
    case 'awaiting_payment':
      // Going backwards may be a stale answer with the money already sent; an address would invite paying twice.
      if (moneySeen(currentQuote(sequence)))
        return { kind: 'checking', payment }
      if (details !== 'ready')
        return {
          kind: 'pay_loading',
          payment,
          problem: details === 'unavailable',
        }
      return payInFull(payment, input)
    case 'underpaid':
      if (details !== 'ready')
        return {
          kind: 'pay_loading',
          payment,
          problem: details === 'unavailable',
        }
      // Any money stops the clock: the shopper can always send the rest.
      return {
        kind: 'pay',
        mode: 'remaining',
        payment,
        clock: 'none',
        showAddress: true,
      }
    default:
      return payment satisfies never
  }
}

// The countdown is information, not authority: at zero only a server answer can show the address again.
function payInFull(
  payment: With<'awaiting_payment'>,
  { now, lastSuccessAt, lastFailureAt }: ScreenInput,
): Screen {
  const deadline = Date.parse(payment.quote.expires_at)
  const left = remainingMs(payment.quote.expires_at, now)
  const pay = { kind: 'pay', mode: 'full', payment } as const
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
