import { ApiError, request } from './client'
import { parseCurrencies, parsePayment } from './schemas'
import type { Currency, Payment } from './schemas'

export type Choice = { currency: string; network: string }

const paymentPath = (reference: string) =>
  `/api/payments/${encodeURIComponent(reference)}`

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
    parse: parsePayment,
  })
}

export function getPayment(
  reference: string,
  signal?: AbortSignal,
): Promise<Payment> {
  return request(paymentPath(reference), { signal, parse: parsePayment })
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
    parse: parsePayment,
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
