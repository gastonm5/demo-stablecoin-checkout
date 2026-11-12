import { parseOrderSummary } from '../api/schemas'
import type { OrderSummary } from '../api/schemas'

// Stands for the order handed to the page by whatever sent the shopper here; the API serves none before a payment.
export const ASSUMED_ORDER: OrderSummary = parseOrderSummary({
  order_id: 'ORD-88213',
  merchant: { name: 'Nordwind Audio', logo_url: null },
  order: { currency: 'EUR', amount: '149.90' },
})

export function readUrl(search: string): {
  order: OrderSummary
  reference: string | null
} {
  const params = new URLSearchParams(search)
  return {
    order: {
      ...ASSUMED_ORDER,
      order_id: params.get('order_id') || ASSUMED_ORDER.order_id,
    },
    reference: params.get('payment') || null,
  }
}

// Replaces rather than pushes, so Back does not walk through earlier payments.
export function writeReference(reference: string | null): void {
  const url = new URL(window.location.href)
  if (reference === null) url.searchParams.delete('payment')
  else url.searchParams.set('payment', reference)
  window.history.replaceState(window.history.state, '', url)
}
