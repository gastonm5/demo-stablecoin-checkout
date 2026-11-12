import { parseOrderSummary } from '../api/schemas'
import type { OrderSummary } from '../api/schemas'

// Stands for the order handed to the page by whatever sent the shopper here; the API serves none before a payment.
export const ASSUMED_ORDER: OrderSummary = parseOrderSummary({
  order_id: 'ORD-88213',
  merchant: { name: 'Nordwind Audio', logo_url: null },
  order: { currency: 'EUR', amount: '149.90' },
})
