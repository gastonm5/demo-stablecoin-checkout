// @vitest-environment node
import { afterEach, beforeEach, expect, test } from 'vitest'
import { createMockApp } from './app'
import { createStore, type MockStore } from './store'
import { startServer } from './testServer'

// The assertions check every shape, so the tests read response bodies loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any

const START = Date.parse('2026-08-14T08:37:10.842Z')
const TX_HASH = '9d1f4c8a2be7...'
const SIX_PAIRS = [
  ['USDT', 'tron'],
  ['USDT', 'ethereum'],
  ['USDC', 'ethereum'],
  ['USDC', 'polygon'],
  ['USDC', 'solana'],
  ['ETH', 'ethereum'],
]
const NEVER_EXPIRING = [
  'detected',
  'confirming',
  'paid',
  'underpaid',
  'overpaid',
  'failed',
]

let t: number
let store: MockStore
let server: { url: string; close(): Promise<void> }
let url: string

beforeEach(async () => {
  t = START
  store = createStore(() => t)
  server = await startServer(createMockApp(store))
  url = server.url
})

afterEach(() => server.close())

const at = (ms: number) => new Date(ms).toISOString()

async function getJson(path: string): Promise<Body> {
  const res = await fetch(`${url}${path}`)
  expect(res.status).toBe(200)
  expect(res.headers.get('cache-control')).toBe('no-store')
  return res.json()
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function createPayment(currency = 'USDT', network = 'tron') {
  const res = await post('/api/payments', {
    order_id: 'ORD-88213',
    currency,
    network,
  })
  expect(res.status).toBe(201)
  const body: Body = await res.json()
  return body
}

test('serves the catalogue exactly as the brief gives it', async () => {
  const { currencies } = await getJson('/api/currencies')
  expect(currencies.map((c: Body) => [c.code, c.decimals])).toEqual([
    ['USDT', 6],
    ['USDC', 6],
    ['ETH', 18],
  ])
  expect(currencies[0].networks[0]).toEqual({
    id: 'tron',
    name: 'Tron (TRC-20)',
    network_fee: '1.00',
    required_confirmations: 1,
    avg_confirmation_seconds: 60,
  })
  expect(currencies[2].networks[0].network_fee).toBe('3.20')
  expect(
    currencies.flatMap((c: Body) =>
      c.networks.map((n: Body) => [
        c.code,
        c.name,
        n.id,
        n.name,
        n.network_fee,
        n.required_confirmations,
        n.avg_confirmation_seconds,
      ]),
    ),
  ).toEqual([
    ['USDT', 'Tether', 'tron', 'Tron (TRC-20)', '1.00', 1, 60],
    ['USDT', 'Tether', 'ethereum', 'Ethereum (ERC-20)', '4.50', 3, 180],
    ['USDC', 'USD Coin', 'ethereum', 'Ethereum (ERC-20)', '4.50', 3, 180],
    ['USDC', 'USD Coin', 'polygon', 'Polygon', '0.10', 6, 30],
    ['USDC', 'USD Coin', 'solana', 'Solana', '0.01', 1, 15],
    ['ETH', 'Ethereum', 'ethereum', 'Ethereum', '3.20', 3, 180],
  ])
})

test('creates the payment the brief shows for USDT on Tron', async () => {
  const res = await post('/api/payments', {
    order_id: 'ORD-88213',
    currency: 'USDT',
    network: 'tron',
  })
  expect(res.status).toBe(201)
  expect(res.headers.get('cache-control')).toBe('no-store')
  const body: Body = await res.json()
  expect(body).toMatchObject({
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
    },
  })
  expect(Date.parse(body.quote.expires_at)).toBe(t + 900_000)
})

test('gives every create a new reference', async () => {
  expect((await createPayment()).payment_reference).toBe('AQH-100306-PMT')
  expect((await createPayment()).payment_reference).toBe('AQH-100307-PMT')
})

test.each(SIX_PAIRS)(
  '%s:%s amounts are strings within the currency decimals',
  async (currency, network) => {
    const { currencies } = await getJson('/api/currencies')
    const { decimals } = currencies.find((c: Body) => c.code === currency)
    const { payment_reference: ref, quote } = await createPayment(
      currency,
      network,
    )
    store.setStatus(ref, 'underpaid')
    const underpaid = await getJson(`/api/payments/${ref}`)
    store.setStatus(ref, 'overpaid')
    const overpaid = await getJson(`/api/payments/${ref}`)
    const amounts = {
      crypto_amount: quote.crypto_amount,
      network_fee: quote.network_fee,
      total_due: quote.total_due,
      'underpaid amount_received': underpaid.amount_received,
      amount_outstanding: underpaid.amount_outstanding,
      'overpaid amount_received': overpaid.amount_received,
      amount_excess: overpaid.amount_excess,
    }
    for (const [field, amount] of Object.entries(amounts)) {
      expect(typeof amount, field).toBe('string')
      expect(amount, field).toMatch(/^\d+(\.\d+)?$/)
      expect(amount.split('.')[1]?.length ?? 0, field).toBeLessThanOrEqual(
        decimals,
      )
    }
  },
)

test('an ETH quote keeps all eighteen places', async () => {
  const { quote } = await createPayment('ETH', 'ethereum')
  expect(quote.total_due).toBe('0.055295738369148398')
})

test('GET returns the whole payment with the status fields', async () => {
  const created = await createPayment()
  t += 5_000
  store.setStatus(created.payment_reference, 'detected')
  expect(
    await getJson(`/api/payments/${created.payment_reference}`),
  ).toMatchObject({
    merchant: created.merchant,
    order: created.order,
    quote: created.quote,
    status: 'detected',
    confirmations: 0,
    detected_at: at(t),
  })
})

test('awaiting_payment expires on read once the deadline passes', async () => {
  const { payment_reference: ref, quote } = await createPayment()
  t += 900_000
  expect((await getJson(`/api/payments/${ref}`)).status).toBe(
    'awaiting_payment',
  )
  t += 1
  expect(await getJson(`/api/payments/${ref}`)).toMatchObject({
    status: 'expired',
    expired_at: quote.expires_at,
  })
})

test.each(NEVER_EXPIRING)(
  'a %s payment never expires by itself',
  async (status) => {
    const { payment_reference: ref } = await createPayment()
    store.setStatus(ref, status)
    t += 10 * 900_000
    expect((await getJson(`/api/payments/${ref}`)).status).toBe(status)
  },
)

test.each(['awaiting_payment', ...NEVER_EXPIRING])(
  'requote is refused unless the quote has expired: %s',
  async (status) => {
    const { payment_reference: ref } = await createPayment()
    store.setStatus(ref, status)
    const res = await post(`/api/payments/${ref}/requote`, {
      currency: 'USDT',
      network: 'tron',
    })
    expect(res.status).toBe(409)
    expect(res.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await res.json()).toMatchObject({
      type: 'https://developers.triple-a.io/errors/quote-not-expired',
      status: 409,
    })
    expect((await getJson(`/api/payments/${ref}`)).status).toBe(status)
  },
)

test('a refused requote of a live quote says until when it is valid', async () => {
  const { payment_reference: ref, quote } = await createPayment()
  const res = await post(`/api/payments/${ref}/requote`, {
    currency: 'USDT',
    network: 'tron',
  })
  expect(await res.json()).toEqual({
    type: 'https://developers.triple-a.io/errors/quote-not-expired',
    title: 'Quote has not expired',
    status: 409,
    detail: `The current quote is valid until ${quote.expires_at}.`,
  })
})

test('requote from expired keeps the reference and returns a fresh quote for the new pair', async () => {
  const { payment_reference } = await createPayment()
  t += 900_001
  const res = await post(`/api/payments/${payment_reference}/requote`, {
    currency: 'USDC',
    network: 'solana',
  })
  expect(res.status).toBe(201)
  expect(res.headers.get('cache-control')).toBe('no-store')
  const body: Body = await res.json()
  expect(body).toMatchObject({
    payment_reference,
    status: 'awaiting_payment',
    quote: {
      crypto_currency: 'USDC',
      network: 'solana',
      network_name: 'Solana',
      total_due: '162.732536',
      crypto_address: '7Zq6TfGfDLbTzYNbM35keafauXirCsT6yskoKoSRFffL',
      required_confirmations: 1,
    },
  })
  expect(Date.parse(body.quote.expires_at)).toBe(t + 900_000)
  expect(body).not.toHaveProperty('expired_at')
  expect(await getJson(`/api/payments/${payment_reference}`)).toEqual(body)
})

test.each([
  [
    'an unknown reference',
    () => fetch(`${url}/api/payments/NOPE`),
    404,
    'payment-not-found',
  ],
  [
    'an unknown reference on requote',
    () =>
      post('/api/payments/NOPE/requote', { currency: 'USDT', network: 'tron' }),
    404,
    'payment-not-found',
  ],
  [
    'an unknown pair',
    () =>
      post('/api/payments', {
        order_id: 'ORD-1',
        currency: 'ETH',
        network: 'tron',
      }),
    422,
    'invalid-request',
  ],
  [
    'a missing field',
    () => post('/api/payments', { order_id: 'ORD-1' }),
    422,
    'invalid-request',
  ],
  [
    'a body that is not JSON',
    () =>
      fetch(`${url}/api/payments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{nope',
      }),
    422,
    'invalid-request',
  ],
  [
    'an unknown pair on requote of a live quote',
    async () => {
      const { payment_reference: ref } = await createPayment()
      return post(`/api/payments/${ref}/requote`, {
        currency: 'ETH',
        network: 'tron',
      })
    },
    422,
    'invalid-request',
  ],
  [
    'an unknown pair on requote of an expired quote',
    async () => {
      const { payment_reference: ref } = await createPayment()
      t += 900_001
      return post(`/api/payments/${ref}/requote`, {
        currency: 'ETH',
        network: 'tron',
      })
    },
    422,
    'invalid-request',
  ],
  [
    'a missing field on requote',
    async () => {
      const { payment_reference: ref } = await createPayment()
      t += 900_001
      return post(`/api/payments/${ref}/requote`, { currency: 'USDT' })
    },
    422,
    'invalid-request',
  ],
])('%s is a complete problem document', async (_name, send, status, slug) => {
  const res = await send()
  expect(res.status).toBe(status)
  expect(res.headers.get('content-type')).toContain('application/problem+json')
  expect(res.headers.get('cache-control')).toBe('no-store')
  const body: Body = await res.json()
  expect(body).toMatchObject({
    type: `https://developers.triple-a.io/errors/${slug}`,
    status,
  })
  expect(typeof body.title).toBe('string')
  expect(typeof body.detail).toBe('string')
})

test.each([
  ['awaiting_payment', {}],
  [
    'detected',
    {
      confirmations: 0,
      required_confirmations: 3,
      amount_received: '167.151910',
      tx_hash: TX_HASH,
      detected_at: at(START + 5_000),
    },
  ],
  [
    'confirming',
    {
      confirmations: 1,
      required_confirmations: 3,
      amount_received: '167.151910',
      tx_hash: TX_HASH,
    },
  ],
  [
    'paid',
    {
      confirmations: 3,
      required_confirmations: 3,
      amount_received: '167.151910',
      tx_hash: TX_HASH,
      settled_at: at(START + 5_000),
    },
  ],
  [
    'underpaid',
    {
      amount_received: '120.00',
      amount_outstanding: '47.151910',
      crypto_address: '0x72c44d0e29ae46740cd165165780c8a5ac92fd0e',
      tx_hash: TX_HASH,
    },
  ],
  [
    'overpaid',
    {
      amount_received: '180.00',
      amount_excess: '12.848090',
      tx_hash: TX_HASH,
      settled_at: at(START + 5_000),
    },
  ],
  ['expired', { expired_at: at(START + 5_000) }],
  ['failed', { reason: 'settlement_rejected' }],
])(
  'setStatus %s sets exactly its fields and drops the previous ones',
  async (status, fields) => {
    const created = await createPayment('USDT', 'ethereum')
    const ref = created.payment_reference
    store.setStatus(ref, status === 'underpaid' ? 'overpaid' : 'underpaid')
    t += 5_000
    store.setStatus(ref, status)
    const body = await getJson(`/api/payments/${ref}`)
    const { payment_reference, order_id, merchant, order, quote, ...rest } =
      body
    expect({ payment_reference, order_id, merchant, order, quote }).toEqual({
      payment_reference: ref,
      order_id: created.order_id,
      merchant: created.merchant,
      order: created.order,
      quote: created.quote,
    })
    expect(rest).toEqual({ status, ...fields })
  },
)

test('confirming takes the given count, clamped to 0..required', async () => {
  const { payment_reference: ref } = await createPayment('USDT', 'ethereum')
  const confirmationsAfter = (count: number) =>
    store.setStatus(ref, 'confirming', count)?.confirmations
  expect(confirmationsAfter(2)).toBe(2)
  expect(confirmationsAfter(7)).toBe(3)
  expect(confirmationsAfter(-1)).toBe(0)
})

test('new quotes follow the current lifetime and server clock', async () => {
  expect(
    store.updateSettings({
      quote_lifetime_seconds: 30,
      clock_offset_seconds: 300,
    }),
  ).toEqual({
    quote_lifetime_seconds: 30,
    delay_ms: 0,
    fault: 'none',
    clock_offset_seconds: 300,
  })
  expect(store.now()).toBe(t + 300_000)
  const { quote } = await createPayment()
  expect(Date.parse(quote.expires_at)).toBe(t + 300_000 + 30_000)
})

test('lists payments oldest first, with expiry applied', async () => {
  const first = await createPayment()
  t += 600_000
  const second = await createPayment('USDC', 'solana')
  t += 300_001
  expect(
    store.listPayments().map((p) => [p.payment_reference, p.status]),
  ).toEqual([
    [first.payment_reference, 'expired'],
    [second.payment_reference, 'awaiting_payment'],
  ])
})
