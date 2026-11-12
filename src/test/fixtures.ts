import { parsePayment } from '../api/schemas'
import type { Payment } from '../api/schemas'

// The brief's values, restated here because the client may not import the mock.

const TX_HASH = '9d1f4c8a2be7...'
const SETTLED_AT = '2026-08-14T08:47:31.004Z'

export const STATE_FIXTURES: Record<string, Record<string, unknown>> = {
  awaiting_payment: {},
  detected: {
    confirmations: 0,
    required_confirmations: 1,
    amount_received: '163.69',
    tx_hash: TX_HASH,
    detected_at: '2026-08-14T08:44:02.120Z',
  },
  confirming: {
    confirmations: 2,
    required_confirmations: 3,
    amount_received: '163.69',
    tx_hash: TX_HASH,
  },
  paid: {
    confirmations: 3,
    required_confirmations: 3,
    amount_received: '163.69',
    tx_hash: TX_HASH,
    settled_at: SETTLED_AT,
  },
  underpaid: {
    amount_received: '120.00',
    amount_outstanding: '43.69',
    crypto_address: 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e',
    tx_hash: TX_HASH,
  },
  overpaid: {
    amount_received: '180.00',
    amount_excess: '16.31',
    tx_hash: TX_HASH,
    settled_at: SETTLED_AT,
  },
  expired: { expired_at: '2026-08-14T08:52:10.842Z' },
  failed: { reason: 'settlement_rejected' },
}

export function paymentJson(
  state: Record<string, unknown> = {},
  quote: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    payment_reference: 'AQH-100306-PMT',
    order_id: 'ORD-88213',
    status: 'awaiting_payment',
    merchant: { name: 'Nordwind Audio', logo_url: null },
    order: { currency: 'EUR', amount: '149.90' },
    quote: {
      crypto_currency: 'USDT',
      network: 'tron',
      network_name: 'Tron (TRC-20)',
      exchange_rate: '0.9214',
      crypto_amount: '162.69',
      network_fee: '1.00',
      total_due: '163.69',
      crypto_address: 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e',
      required_confirmations: 1,
      expires_at: '2026-08-14T08:52:10.842Z',
      ...quote,
    },
    ...state,
  }
}

export function makePayment(
  state?: Record<string, unknown>,
  quote?: Record<string, unknown>,
): Payment {
  return parsePayment(paymentJson(state, quote))
}

export const CURRENCIES_JSON: unknown = {
  currencies: [
    {
      code: 'USDT',
      name: 'Tether',
      decimals: 6,
      networks: [
        {
          id: 'tron',
          name: 'Tron (TRC-20)',
          network_fee: '1.00',
          required_confirmations: 1,
          avg_confirmation_seconds: 60,
        },
        {
          id: 'ethereum',
          name: 'Ethereum (ERC-20)',
          network_fee: '4.50',
          required_confirmations: 3,
          avg_confirmation_seconds: 180,
        },
      ],
    },
    {
      code: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      networks: [
        {
          id: 'ethereum',
          name: 'Ethereum (ERC-20)',
          network_fee: '4.50',
          required_confirmations: 3,
          avg_confirmation_seconds: 180,
        },
        {
          id: 'polygon',
          name: 'Polygon',
          network_fee: '0.10',
          required_confirmations: 6,
          avg_confirmation_seconds: 30,
        },
        {
          id: 'solana',
          name: 'Solana',
          network_fee: '0.01',
          required_confirmations: 1,
          avg_confirmation_seconds: 15,
        },
      ],
    },
    {
      code: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      networks: [
        {
          id: 'ethereum',
          name: 'Ethereum',
          network_fee: '3.20',
          required_confirmations: 3,
          avg_confirmation_seconds: 180,
        },
      ],
    },
  ],
}
