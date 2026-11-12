import type { DecimalString, Payment } from '../api/schemas'

export function fractionDigits(amount: DecimalString): number {
  return amount.split('.')[1]?.length ?? 0
}

export function fitsDecimals(amount: DecimalString, decimals: number): boolean {
  return fractionDigits(amount) <= decimals
}

export function amountsToSend(payment: Payment): DecimalString[] {
  return payment.status === 'underpaid'
    ? [payment.quote.total_due, payment.amount_outstanding]
    : [payment.quote.total_due]
}
