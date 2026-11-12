import { ApiError, request } from './client'
import { parseCurrencies, parsePayment } from './schemas'
import type { Currency, Payment } from './schemas'

export type Choice = { currency: string; network: string }

const paymentPath = (reference: string) =>
  `/api/payments/${encodeURIComponent(reference)}`

// An answer about another payment or another pair would show the shopper an address they did not ask for.
function parsePaymentAbout(asked: {
  reference?: string
  order_id?: string
  choice?: Choice
}) {
  return (json: unknown): Payment => {
    const payment = parsePayment(json)
    const { reference, order_id, choice } = asked
    if (
      (reference !== undefined && payment.payment_reference !== reference) ||
      (order_id !== undefined && payment.order_id !== order_id) ||
      (choice !== undefined &&
        (payment.quote.crypto_currency !== choice.currency ||
          payment.quote.network !== choice.network))
    ) {
      throw new Error('The answer is not about what was asked')
    }
    return payment
  }
}

export function getCurrencies(signal?: AbortSignal): Promise<Currency[]> {
  return request('/api/currencies', { signal, parse: parseCurrencies })
}

export function createPayment(
  body: { order_id: string } & Choice,
  signal?: AbortSignal,
): Promise<Payment> {
  return request('/api/payments', {
    method: 'POST',
    body,
    signal,
    parse: parsePaymentAbout({ order_id: body.order_id, choice: body }),
  })
}

export function getPayment(
  reference: string,
  signal?: AbortSignal,
): Promise<Payment> {
  return request(paymentPath(reference), {
    signal,
    parse: parsePaymentAbout({ reference }),
  })
}

export function requotePayment(
  reference: string,
  body: Choice,
  signal?: AbortSignal,
): Promise<Payment> {
  return request(`${paymentPath(reference)}/requote`, {
    method: 'POST',
    body,
    signal,
    parse: parsePaymentAbout({ reference, choice: body }),
  })
}

export function isQuoteNotExpired(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.kind === 'http' &&
    error.status === 409 &&
    error.problem?.type.endsWith('/quote-not-expired') === true
  )
}

export function isNotFound(error: unknown): boolean {
  return (
    error instanceof ApiError && error.kind === 'http' && error.status === 404
  )
}
