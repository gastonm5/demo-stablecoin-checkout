import type { DecimalString, Payment } from '../api/schemas'
import type { With } from './screen'

export function fractionDigits(amount: DecimalString): number {
  return amount.split('.')[1]?.length ?? 0
}

export function fitsDecimals(amount: DecimalString, decimals: number): boolean {
  return fractionDigits(amount) <= decimals
}

export function toSend(payment: With<'awaiting_payment' | 'underpaid'>): {
  amount: DecimalString
  address: string
} {
  // The underpaid status carries its own address: the server's latest word on where the rest goes.
  return payment.status === 'underpaid'
    ? { amount: payment.amount_outstanding, address: payment.crypto_address }
    : { amount: payment.quote.total_due, address: payment.quote.crypto_address }
}

export function amountsToSend(payment: Payment): DecimalString[] {
  return payment.status === 'underpaid'
    ? [payment.quote.total_due, payment.amount_outstanding]
    : [payment.quote.total_due]
}
