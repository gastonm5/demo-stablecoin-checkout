import type { MockSettings } from './store'

// Every amount is a literal from the brief. The mock computes none of them.

export const CURRENCIES = [
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
]

export const MERCHANT = { name: 'Nordwind Audio', logo_url: null }
export const ORDER = { currency: 'EUR', amount: '149.90' }

export const DEFAULT_SETTINGS: MockSettings = {
  quote_lifetime_seconds: 900,
  delay_ms: 0,
  fault: 'none',
  clock_offset_seconds: 0,
}

export const FIRST_REFERENCE = 100306
export const TX_HASH = '9d1f4c8a2be7...'

export type Pair = {
  quote: {
    exchange_rate: string
    crypto_amount: string
    network_fee: string
    total_due: string
    crypto_address: string
  }
  underpaid: { amount_received: string; amount_outstanding: string }
  overpaid: { amount_received: string; amount_excess: string }
}

// Keyed `CODE:network`.
export const PAIRS: Record<string, Pair> = {
  'USDT:tron': {
    quote: {
      exchange_rate: '0.9214',
      crypto_amount: '162.69',
      network_fee: '1.00',
      total_due: '163.69',
      crypto_address: 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e',
    },
    underpaid: { amount_received: '120.00', amount_outstanding: '43.69' },
    overpaid: { amount_received: '180.00', amount_excess: '16.31' },
  },
  'USDT:ethereum': {
    quote: {
      exchange_rate: '0.9216',
      crypto_amount: '162.651910',
      network_fee: '4.50',
      total_due: '167.151910',
      crypto_address: '0x72c44d0e29ae46740cd165165780c8a5ac92fd0e',
    },
    underpaid: { amount_received: '120.00', amount_outstanding: '47.151910' },
    overpaid: { amount_received: '180.00', amount_excess: '12.848090' },
  },
  'USDC:ethereum': {
    quote: {
      exchange_rate: '0.9209',
      crypto_amount: '162.775546',
      network_fee: '4.50',
      total_due: '167.275546',
      crypto_address: '0x8f9581fb11f3cb441fc9f969bb2468fc64f9fbe2',
    },
    underpaid: { amount_received: '120.00', amount_outstanding: '47.275546' },
    overpaid: { amount_received: '180.00', amount_excess: '12.724454' },
  },
  'USDC:polygon': {
    quote: {
      exchange_rate: '0.9211',
      crypto_amount: '162.740202',
      network_fee: '0.10',
      total_due: '162.840202',
      crypto_address: '0x80afb2d9d4b673f405cecb802badcf5d0d64d4cb',
    },
    underpaid: { amount_received: '120.00', amount_outstanding: '42.840202' },
    overpaid: { amount_received: '180.00', amount_excess: '17.159798' },
  },
  'USDC:solana': {
    quote: {
      exchange_rate: '0.9212',
      crypto_amount: '162.722536',
      network_fee: '0.01',
      total_due: '162.732536',
      crypto_address: '7Zq6TfGfDLbTzYNbM35keafauXirCsT6yskoKoSRFffL',
    },
    underpaid: { amount_received: '120.00', amount_outstanding: '42.732536' },
    overpaid: { amount_received: '180.00', amount_excess: '17.267464' },
  },
  'ETH:ethereum': {
    quote: {
      exchange_rate: '2764.20',
      crypto_amount: '0.054229071702481731',
      network_fee: '0.001066666666666667',
      total_due: '0.055295738369148398',
      crypto_address: '0x39fc48188b62b7b07580aa3c2c6801d075f54893',
    },
    underpaid: {
      amount_received: '0.040000000000000000',
      amount_outstanding: '0.015295738369148398',
    },
    overpaid: {
      amount_received: '0.060000000000000000',
      amount_excess: '0.004704261630851602',
    },
  },
}
