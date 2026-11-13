import type { DecimalString, Payment, PaymentStatus } from '../api/schemas'
import { carriesMoney } from './status'

export type SequenceEntry = {
  status: PaymentStatus
  at: number
  amount_received?: DecimalString
  amount_outstanding?: DecimalString
  tx_hash?: string
}

export type StatusSequence = {
  startedFrom: 'creation' | 'reload'
  quoteExpiresAt: string // the expires_at of the quote the latest entries belong to
  quoteStartIndex: number // index of the first entry of the current quote
  quoteStartedAt: number | null // device time the page saw the current quote begin; null after a reload, until a new quote
  entries: SequenceEntry[]
}

function toEntry(payment: Payment, at: number): SequenceEntry {
  const entry: SequenceEntry = { status: payment.status, at }
  if ('amount_received' in payment)
    entry.amount_received = payment.amount_received
  if ('amount_outstanding' in payment)
    entry.amount_outstanding = payment.amount_outstanding
  if ('tx_hash' in payment) entry.tx_hash = payment.tx_hash
  return entry
}

export function startSequence(
  payment: Payment,
  startedFrom: 'creation' | 'reload',
  at: number,
): StatusSequence {
  return {
    startedFrom,
    quoteExpiresAt: payment.quote.expires_at,
    quoteStartIndex: 0,
    quoteStartedAt: startedFrom === 'creation' ? at : null,
    entries: [toEntry(payment, at)],
  }
}

export function recordStatus(
  sequence: StatusSequence,
  payment: Payment,
  at: number,
): StatusSequence {
  const { entries } = sequence
  const entry = toEntry(payment, at)
  // Status alone never starts a quote: a backwards status stays in the quote that saw the money.
  if (payment.quote.expires_at !== sequence.quoteExpiresAt) {
    return {
      ...sequence,
      quoteExpiresAt: payment.quote.expires_at,
      quoteStartIndex: entries.length,
      quoteStartedAt: at,
      entries: [...entries, entry],
    }
  }
  const repeated = entries.at(-1)?.status === payment.status
  return {
    ...sequence,
    entries: repeated ? [...entries.slice(0, -1), entry] : [...entries, entry],
  }
}

export function currentQuote(sequence: StatusSequence): SequenceEntry[] {
  return sequence.entries.slice(sequence.quoteStartIndex)
}

export function moneySeen(entries: SequenceEntry[]): boolean {
  return entries.some((entry) => carriesMoney(entry.status))
}

export function lastMoney(entries: SequenceEntry[]): SequenceEntry | undefined {
  return entries.findLast((entry) => carriesMoney(entry.status))
}
