export const DEFAULT_ORDER_ID = 'ORD-88213'

export function readUrl(search: string): {
  orderId: string
  reference: string | null
} {
  const params = new URLSearchParams(search)
  return {
    orderId: params.get('order_id') || DEFAULT_ORDER_ID,
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
