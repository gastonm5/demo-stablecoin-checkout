// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createMockApp } from './app'
import { createStore, type MockStore } from './store'
import { startServer } from './testServer'

// The assertions check every shape, so the tests read response bodies loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any

const START = Date.parse('2026-08-14T08:37:10.842Z')
const DEFAULTS = {
  quote_lifetime_seconds: 900,
  delay_ms: 0,
  fault: 'none',
  clock_offset_seconds: 0,
}

let t: number
let store: MockStore
let server: { url: string; close(): Promise<void> }
let url: string
let ref: string

beforeEach(async () => {
  t = START
  store = createStore(() => t)
  server = await startServer(createMockApp(store))
  url = server.url
  ref = (await createPayment('USDT', 'ethereum')).payment_reference
})

afterEach(() => server.close())

function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function ok(res: Promise<Response>, status = 200): Promise<Body> {
  const answer = await res
  expect(answer.status).toBe(status)
  return answer.json()
}

const createPayment = (currency: string, network: string) =>
  ok(post('/api/payments', { order_id: 'ORD-88213', currency, network }), 201)

const setStatus = (reference: string, status: string, confirmations?: number) =>
  ok(post(`/__mock/payments/${reference}/status`, { status, confirmations }))

const configure = (patch: object) => ok(post('/__mock/settings', patch))

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

test.each([
  ['awaiting_payment', []],
  [
    'detected',
    [
      'confirmations',
      'required_confirmations',
      'amount_received',
      'tx_hash',
      'detected_at',
    ],
  ],
  [
    'confirming',
    ['confirmations', 'required_confirmations', 'amount_received', 'tx_hash'],
  ],
  [
    'paid',
    [
      'confirmations',
      'required_confirmations',
      'amount_received',
      'tx_hash',
      'settled_at',
    ],
  ],
  [
    'underpaid',
    ['amount_received', 'amount_outstanding', 'crypto_address', 'tx_hash'],
  ],
  ['overpaid', ['amount_received', 'amount_excess', 'tx_hash', 'settled_at']],
  ['expired', ['expired_at']],
  ['failed', ['reason']],
])('setting %s adds exactly its fields', async (status, fields) => {
  // A previous status with other fields first, so stale fields would show.
  await setStatus(ref, status === 'paid' ? 'underpaid' : 'paid')
  const body = await setStatus(ref, status)
  const base = [
    'payment_reference',
    'order_id',
    'status',
    'merchant',
    'order',
    'quote',
  ]
  expect(body.status).toBe(status)
  expect(Object.keys(body).sort()).toEqual([...base, ...fields].sort())
})

test('confirming takes a confirmations count', async () => {
  expect(await setStatus(ref, 'confirming', 2)).toMatchObject({
    confirmations: 2,
    required_confirmations: 3,
  })
})

test('underpaid on Tron uses the brief amounts', async () => {
  const { payment_reference } = await createPayment('USDT', 'tron')
  expect(await setStatus(payment_reference, 'underpaid')).toMatchObject({
    amount_received: '120.00',
    amount_outstanding: '43.69',
  })
})

test('a status outside the eight is refused', async () => {
  const res = await post(`/__mock/payments/${ref}/status`, {
    status: 'refunded',
  })
  expect(res.status).toBe(422)
  expect((await ok(fetch(`${url}/api/payments/${ref}`))).status).toBe(
    'awaiting_payment',
  )
})

test('quote lifetime applies to new quotes', async () => {
  expect(await configure({ quote_lifetime_seconds: 30 })).toEqual({
    ...DEFAULTS,
    quote_lifetime_seconds: 30,
  })
  const { quote } = await createPayment('USDT', 'tron')
  expect(Date.parse(quote.expires_at)).toBe(t + 30_000)
})

test('the server clock offset moves expires_at', async () => {
  await configure({ clock_offset_seconds: 300 })
  const { quote } = await createPayment('USDT', 'tron')
  expect(Date.parse(quote.expires_at)).toBe(t + 300_000 + 900_000)
})

test('the server clock can run behind', async () => {
  await configure({ clock_offset_seconds: -300 })
  const { quote } = await createPayment('USDT', 'tron')
  expect(Date.parse(quote.expires_at)).toBe(t - 300_000 + 900_000)
})

test.each([
  [
    'a missing status',
    () => post(`/__mock/payments/${ref}/status`, {}),
    422,
    'invalid-request',
  ],
  [
    'a confirmations count that is not a whole number',
    () =>
      post(`/__mock/payments/${ref}/status`, {
        status: 'confirming',
        confirmations: '2',
      }),
    422,
    'invalid-request',
  ],
  [
    'a status body that is an array',
    () => post(`/__mock/payments/${ref}/status`, []),
    422,
    'invalid-request',
  ],
  [
    'a settings body that is an array',
    () => post('/__mock/settings', []),
    422,
    'invalid-request',
  ],
  [
    'a settings request with no JSON body',
    () => fetch(`${url}/__mock/settings`, { method: 'POST' }),
    422,
    'invalid-request',
  ],
  [
    'an unknown reference',
    () => post('/__mock/payments/NOPE/status', { status: 'paid' }),
    404,
    'payment-not-found',
  ],
  [
    'a negative quote lifetime',
    () => post('/__mock/settings', { quote_lifetime_seconds: -30 }),
    422,
    'invalid-request',
  ],
  [
    'a negative delay',
    () => post('/__mock/settings', { delay_ms: -1 }),
    422,
    'invalid-request',
  ],
  [
    'a delay sent as a string',
    () => post('/__mock/settings', { delay_ms: '80' }),
    422,
    'invalid-request',
  ],
  [
    'an unknown fault',
    () => post('/__mock/settings', { fault: 'timeout' }),
    422,
    'invalid-request',
  ],
  [
    'an unknown setting',
    () => post('/__mock/settings', { quote_lifetime: 30 }),
    422,
    'invalid-request',
  ],
  [
    'an inherited property name',
    () => post('/__mock/settings', { constructor: 30 }),
    422,
    'invalid-request',
  ],
  [
    'a settings body that is not JSON',
    () =>
      fetch(`${url}/__mock/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{nope',
      }),
    422,
    'invalid-request',
  ],
])(
  '%s is refused with a problem document',
  async (_name, send, status, slug) => {
    const res = await send()
    expect(res.status).toBe(status)
    expect(res.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    const body: Body = await res.json()
    expect(body).toMatchObject({
      type: `https://developers.triple-a.io/errors/${slug}`,
      status,
    })
    expect(typeof body.title).toBe('string')
    expect(typeof body.detail).toBe('string')
  },
)

test('a refused settings patch changes nothing', async () => {
  const res = await post('/__mock/settings', { delay_ms: 80, fault: 'nope' })
  expect(res.status).toBe(422)
  expect((await ok(fetch(`${url}/__mock/state`))).settings).toEqual(DEFAULTS)
})

test('http_500 fails API requests with a complete problem document', async () => {
  await configure({ fault: 'http_500' })
  const res = await fetch(`${url}/api/currencies`)
  expect(res.status).toBe(500)
  expect(res.headers.get('content-type')).toContain('application/problem+json')
  expect(res.headers.get('cache-control')).toBe('no-store')
  const body: Body = await res.json()
  expect(body.type).toBe('https://developers.triple-a.io/errors/internal')
  expect(body.status).toBe(500)
  expect(typeof body.title).toBe('string')
  expect(typeof body.detail).toBe('string')
})

test('drop closes the connection without a response', async () => {
  await configure({ fault: 'drop' })
  await expect(fetch(`${url}/api/currencies`)).rejects.toThrow()
})

test('a delay holds the response', async () => {
  await configure({ delay_ms: 80 })
  const started = performance.now()
  await ok(fetch(`${url}/api/currencies`))
  expect(performance.now() - started).toBeGreaterThanOrEqual(80)
})

test('a request abandoned during the delay never reaches its handler', async () => {
  const reads = vi.spyOn(store, 'getPayment')
  await configure({ delay_ms: 200 })
  const aborting = new AbortController()
  const { signal } = aborting
  const abandoned = [
    // A late GET would still read the store; a late POST has lost its body by then.
    fetch(`${url}/api/payments/${ref}`, { signal }),
    fetch(`${url}/api/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        order_id: 'ORD-88213',
        currency: 'USDT',
        network: 'tron',
      }),
      signal,
    }),
  ]
  await wait(50)
  aborting.abort()
  for (const request of abandoned) await expect(request).rejects.toThrow()
  await wait(300)
  expect(reads).not.toHaveBeenCalled()
  expect((await ok(fetch(`${url}/__mock/state`))).payments).toHaveLength(1)
})

test.each(['drop', 'http_500'])(
  'control endpoints ignore faults: %s with a long delay',
  async (fault) => {
    await configure({ fault, delay_ms: 60_000 })
    // A delayed control request would time out here instead of hanging the run.
    const timeout = () => ({ signal: AbortSignal.timeout(1_000) })
    expect(
      (await ok(fetch(`${url}/__mock/state`, timeout()))).settings,
    ).toEqual({ ...DEFAULTS, fault, delay_ms: 60_000 })
    expect(
      await ok(
        fetch(`${url}/__mock/payments/${ref}/status`, {
          ...timeout(),
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'paid' }),
        }),
      ),
    ).toMatchObject({ status: 'paid' })
  },
)

test('state lists settings and payments', async () => {
  t += 5_000
  const second = await createPayment('USDC', 'solana')
  const first = await setStatus(ref, 'detected')
  expect(await ok(fetch(`${url}/__mock/state`))).toEqual({
    settings: DEFAULTS,
    payments: [first, second],
  })
})
