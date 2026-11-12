import type { PaymentStatus } from '../api/schemas'

export const FINAL_STATUSES = [
  'paid',
  'overpaid',
  'failed',
] as const satisfies readonly PaymentStatus[]
export const MONEY_STATUSES = [
  'detected',
  'confirming',
  'paid',
  'underpaid',
  'overpaid',
] as const satisfies readonly PaymentStatus[]

export function isFinal(status: PaymentStatus): boolean {
  return (FINAL_STATUSES as readonly PaymentStatus[]).includes(status)
}

export function carriesMoney(status: PaymentStatus): boolean {
  return (MONEY_STATUSES as readonly PaymentStatus[]).includes(status)
}
