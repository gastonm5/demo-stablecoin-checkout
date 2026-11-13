import {
  CURRENCIES,
  DEFAULT_SETTINGS,
  FIRST_REFERENCE,
  MERCHANT,
  ORDER,
  PAIRS,
  TX_HASH,
  type Pair,
} from './fixtures.ts'

export type Fault = 'none' | 'http_500' | 'drop'
export type MockSettings = {
  quote_lifetime_seconds: number
  delay_ms: number
  fault: Fault
  clock_offset_seconds: number
}
export type PaymentRecord = Record<string, unknown> & {
  payment_reference: string
  status: string
}
export type RequoteResult =
  | { ok: true; payment: PaymentRecord }
  | {
      ok: false
      reason: 'not_found' | 'not_expired' | 'unknown_pair'
      expires_at?: string
    }
export type MockStore = {
  settings: MockSettings
  now(): number
  createPayment(input: {
    order_id: string
    currency: string
    network: string
  }): PaymentRecord | null
  getPayment(reference: string): PaymentRecord | undefined
  requote(
    reference: string,
    input: { currency: string; network: string },
  ): RequoteResult
  setStatus(
    reference: string,
    status: string,
    confirmations?: number,
  ): PaymentRecord | undefined
  restart(reference: string): PaymentRecord | undefined
  updateSettings(patch: Partial<MockSettings>): MockSettings
  listPayments(): PaymentRecord[]
}

type Quote = Pair['quote'] & {
  crypto_currency: string
  network: string
  network_name: string
  required_confirmations: number
  expires_at: string
}
type Payment = PaymentRecord & {
  order_id: string
  merchant: typeof MERCHANT
  order: typeof ORDER
  quote: Quote
}

const iso = (ms: number) => new Date(ms).toISOString()

function statusFields(
  quote: Quote,
  status: string,
  confirmations: number,
  now: string,
) {
  const required = quote.required_confirmations
  const pair = PAIRS[`${quote.crypto_currency}:${quote.network}`]
  const received = {
    required_confirmations: required,
    amount_received: quote.total_due,
    tx_hash: TX_HASH,
  }
  switch (status) {
    case 'detected':
      return { confirmations: 0, ...received, detected_at: now }
    case 'confirming':
      return {
        confirmations: Math.min(Math.max(confirmations, 0), required),
        ...received,
      }
    case 'paid':
      return { confirmations: required, ...received, settled_at: now }
    case 'underpaid':
      return {
        ...pair.underpaid,
        crypto_address: quote.crypto_address,
        tx_hash: TX_HASH,
      }
    case 'overpaid':
      return { ...pair.overpaid, tx_hash: TX_HASH, settled_at: now }
    case 'expired':
      return { expired_at: now }
    case 'failed':
      return { reason: 'settlement_rejected' }
    default:
      return {}
  }
}

export function createStore(clock: () => number = Date.now): MockStore {
  const payments = new Map<string, Payment>()
  let nextReference = FIRST_REFERENCE

  function quoteFor(currency: string, network: string): Quote | undefined {
    const key = `${currency}:${network}`
    const listed = CURRENCIES.find((c) => c.code === currency)?.networks.find(
      (n) => n.id === network,
    )
    if (!listed || !Object.hasOwn(PAIRS, key)) return undefined
    return {
      crypto_currency: currency,
      network,
      network_name: listed.name,
      ...PAIRS[key].quote,
      required_confirmations: listed.required_confirmations,
      expires_at: iso(
        store.now() + store.settings.quote_lifetime_seconds * 1000,
      ),
    }
  }

  // Rebuilt from the base fields so nothing from the previous status survives.
  function save(payment: Payment, status: string, fields: object): Payment {
    const { payment_reference, order_id, merchant, order, quote } = payment
    const saved = {
      payment_reference,
      order_id,
      status,
      merchant,
      order,
      quote,
      ...fields,
    }
    payments.set(payment_reference, saved)
    return saved
  }

  function expireIfDue(payment: Payment): Payment {
    const deadline = payment.quote.expires_at
    return payment.status === 'awaiting_payment' &&
      store.now() > Date.parse(deadline)
      ? save(payment, 'expired', { expired_at: deadline })
      : payment
  }

  const store: MockStore = {
    settings: { ...DEFAULT_SETTINGS },

    now: () => clock() + store.settings.clock_offset_seconds * 1000,

    createPayment({ order_id, currency, network }) {
      const quote = quoteFor(currency, network)
      if (!quote) return null
      const payment: Payment = {
        payment_reference: `AQH-${nextReference++}-PMT`,
        order_id,
        status: 'awaiting_payment',
        merchant: MERCHANT,
        order: ORDER,
        quote,
      }
      payments.set(payment.payment_reference, payment)
      return payment
    },

    getPayment(reference) {
      const payment = payments.get(reference)
      return payment && expireIfDue(payment)
    },

    requote(reference, { currency, network }) {
      const payment = payments.get(reference)
      if (!payment) return { ok: false, reason: 'not_found' }
      const quote = quoteFor(currency, network)
      if (!quote) return { ok: false, reason: 'unknown_pair' }
      const current = expireIfDue(payment)
      if (current.status === 'awaiting_payment')
        return {
          ok: false,
          reason: 'not_expired',
          expires_at: current.quote.expires_at,
        }
      if (current.status !== 'expired')
        return { ok: false, reason: 'not_expired' }
      return {
        ok: true,
        payment: save({ ...current, quote }, 'awaiting_payment', {}),
      }
    },

    setStatus(reference, status, confirmations = 1) {
      const payment = payments.get(reference)
      if (!payment) return undefined
      return save(
        payment,
        status,
        statusFields(payment.quote, status, confirmations, iso(store.now())),
      )
    },

    // Not through requote, which refuses anything that has not expired.
    restart(reference) {
      const payment = payments.get(reference)
      if (!payment) return undefined
      const { crypto_currency, network } = payment.quote
      const quote = quoteFor(crypto_currency, network)
      return quote && save({ ...payment, quote }, 'awaiting_payment', {})
    },

    updateSettings(patch) {
      return Object.assign(store.settings, patch)
    },

    listPayments() {
      return Array.from(payments.values(), expireIfDue)
    },
  }

  return store
}
