import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CURRENCIES_JSON, paymentJson } from '../test/fixtures'
import { ApiError } from './client'
import type { ApiErrorKind } from './client'
import {
  createPayment,
  getCurrencies,
  getPayment,
  isNotFound,
  isQuoteNotExpired,
  requotePayment,
} from './endpoints'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

const respond = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))

function sent() {
  const [url, init] = fetchMock.mock.calls[0] ?? []
  const body = init?.body === undefined ? undefined : JSON.parse(`${init.body}`)
  return { url, method: init?.method, body }
}

const CHOICE = { currency: 'USDT', network: 'tron' }

test('getCurrencies reads the catalogue', async () => {
  respond(CURRENCIES_JSON)
  await expect(getCurrencies()).resolves.toHaveLength(3)
  expect(sent()).toEqual({ url: '/api/currencies', method: 'GET' })
})

test('createPayment posts the order and the choice', async () => {
  respond(paymentJson(), 201)
  const payment = await createPayment({ order_id: 'ORD-88213', ...CHOICE })
  expect(payment.payment_reference).toBe('AQH-100306-PMT')
  expect(sent()).toEqual({
    url: '/api/payments',
    method: 'POST',
    body: { order_id: 'ORD-88213', currency: 'USDT', network: 'tron' },
  })
})

test('requotePayment posts the choice to the requote path', async () => {
  respond(paymentJson(), 201)
  await requotePayment('AQH-100306-PMT', CHOICE)
  expect(sent()).toEqual({
    url: '/api/payments/AQH-100306-PMT/requote',
    method: 'POST',
    body: CHOICE,
  })
})

test('getPayment encodes the reference', async () => {
  respond(paymentJson({ payment_reference: 'a/b c?' }))
  await getPayment('a/b c?')
  expect(sent()).toEqual({ url: '/api/payments/a%2Fb%20c%3F', method: 'GET' })
})

const ORDER = { order_id: 'ORD-88213', ...CHOICE }

test.each<[string, Record<string, unknown>, () => Promise<unknown>]>([
  ['getPayment, another reference', {}, () => getPayment('AQH-999999-PMT')],
  [
    'requotePayment, another reference',
    {},
    () => requotePayment('AQH-999999-PMT', CHOICE),
  ],
  [
    'createPayment, another order',
    {},
    () => createPayment({ ...ORDER, order_id: 'ORD-99999' }),
  ],
  [
    'createPayment, another currency',
    { crypto_currency: 'USDC' },
    () => createPayment(ORDER),
  ],
  [
    'createPayment, another network',
    { network: 'ethereum' },
    () => createPayment(ORDER),
  ],
  [
    'requotePayment, another currency',
    { crypto_currency: 'USDC' },
    () => requotePayment('AQH-100306-PMT', CHOICE),
  ],
  [
    'requotePayment, another network',
    { network: 'ethereum' },
    () => requotePayment('AQH-100306-PMT', CHOICE),
  ],
])(
  'an answer about something other than what was asked is invalid: %s',
  async (_name, quote, call) => {
    respond(paymentJson({}, quote))
    const error = await call().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'invalid' })
  },
)

test.each<[string, (signal: AbortSignal) => Promise<unknown>]>([
  ['getCurrencies', (signal) => getCurrencies(signal)],
  [
    'createPayment',
    (signal) => createPayment({ order_id: 'ORD-88213', ...CHOICE }, signal),
  ],
  ['getPayment', (signal) => getPayment('AQH-100306-PMT', signal)],
  [
    'requotePayment',
    (signal) => requotePayment('AQH-100306-PMT', CHOICE, signal),
  ],
])('%s passes the caller signal on', async (_name, call) => {
  const caller = new AbortController()
  caller.abort()
  await expect(call(caller.signal)).rejects.toBe(caller.signal.reason)
  expect(fetchMock).not.toHaveBeenCalled()
})

const problemOf = (status: number, problem?: { type: string }) =>
  problem && { title: 'Problem', status, ...problem }
const apiError = (
  kind: ApiErrorKind,
  status: number,
  problem?: { type: string },
) =>
  new ApiError(kind, `answered ${status}`, {
    status,
    problem: problemOf(status, problem),
  })
const http = (status: number, problem?: { type: string }) =>
  apiError('http', status, problem)
const QUOTE_NOT_EXPIRED = {
  type: 'https://developers.triple-a.io/errors/quote-not-expired',
}

test.each<[string, unknown, boolean, boolean]>([
  ['a 409 quote-not-expired', http(409, QUOTE_NOT_EXPIRED), true, false],
  [
    'a 409 of another type',
    http(409, { type: 'https://developers.triple-a.io/errors/conflict' }),
    false,
    false,
  ],
  ['a 409 without a problem', http(409), false, false],
  ['a 400 quote-not-expired', http(400, QUOTE_NOT_EXPIRED), false, false],
  ['a 404', http(404), false, true],
  ['a 500', http(500), false, false],
  ['a network error', new ApiError('network', 'down'), false, false],
  [
    'an invalid error with a 409 quote-not-expired',
    apiError('invalid', 409, QUOTE_NOT_EXPIRED),
    false,
    false,
  ],
  [
    'a network error with a 409 quote-not-expired',
    apiError('network', 409, QUOTE_NOT_EXPIRED),
    false,
    false,
  ],
  ['an invalid error with a 404', apiError('invalid', 404), false, false],
  ['a network error with a 404', apiError('network', 404), false, false],
  ['a plain error', new Error('404'), false, false],
  [
    'a lookalike 409 quote-not-expired',
    { kind: 'http', status: 409, problem: problemOf(409, QUOTE_NOT_EXPIRED) },
    false,
    false,
  ],
  ['a lookalike 404', { kind: 'http', status: 404 }, false, false],
])(
  'isQuoteNotExpired and isNotFound recognise their errors and nothing else: %s',
  (_name, error, quoteNotExpired, notFound) => {
    expect(isQuoteNotExpired(error)).toBe(quoteNotExpired)
    expect(isNotFound(error)).toBe(notFound)
  },
)
