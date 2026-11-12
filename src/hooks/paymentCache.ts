import type { QueryClient } from '@tanstack/react-query'
import { requotePayment } from '../api/endpoints'
import type { Choice } from '../api/endpoints'
import type { Payment } from '../api/schemas'
import { recordStatus, startSequence } from '../domain/sequence'
import type { StatusSequence } from '../domain/sequence'

export type PaymentEntry = { payment: Payment; sequence: StatusSequence }

export const paymentKey = (reference: string) => ['payment', reference] as const

// The one place a server answer becomes cached data, so the sequence cannot drift from the payment.
export function mergePayment(
  previous: PaymentEntry | undefined,
  payment: Payment,
  at: number,
): PaymentEntry {
  return {
    payment,
    sequence: previous
      ? recordStatus(previous.sequence, payment, at)
      : startSequence(payment, 'reload', at),
  }
}

export function seedCreatedPayment(
  client: QueryClient,
  payment: Payment,
  at: number,
): void {
  client.setQueryData<PaymentEntry>(paymentKey(payment.payment_reference), {
    payment,
    sequence: startSequence(payment, 'creation', at),
  })
}

export async function runRequote(
  client: QueryClient,
  reference: string,
  choice: Choice,
): Promise<Payment> {
  const queryKey = paymentKey(reference)
  // A poll that answers after the requote would carry the old quote and read as a new one.
  await client.cancelQueries({ queryKey })
  try {
    const payment = await requotePayment(reference, choice)
    client.setQueryData<PaymentEntry>(queryKey, (previous) =>
      mergePayment(previous, payment, Date.now()),
    )
    return payment
  } catch (error) {
    // The requote may have gone through, or the server refused it: either way only a fresh read says which.
    await client.invalidateQueries({ queryKey })
    throw error
  }
}
