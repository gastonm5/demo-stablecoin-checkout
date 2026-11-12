import { expect, test } from 'vitest'
import { CURRENCIES_JSON, paymentJson, STATE_FIXTURES } from '../test/fixtures'
import { parseCurrencies, parsePayment, parseProblem } from './schemas'

test.each(Object.keys(STATE_FIXTURES))('parses the %s fixture', (status) => {
  const p = parsePayment(paymentJson({ status, ...STATE_FIXTURES[status] }))
  expect(p.status).toBe(status)
  expect(p.quote.total_due).toBe('163.69')
})

test('keeps the fields of a status', () => {
  const p = parsePayment(
    paymentJson({ status: 'underpaid', ...STATE_FIXTURES.underpaid }),
  )
  expect(p).toMatchObject({ status: 'underpaid', ...STATE_FIXTURES.underpaid })
})

test('parses the catalogue', () =>
  expect(parseCurrencies(CURRENCIES_JSON)).toHaveLength(3))

test('rejects a numeric amount in the catalogue', () => {
  const body = {
    currencies: [
      {
        code: 'USDT',
        name: 'Tether',
        decimals: 6,
        networks: [
          {
            id: 'tron',
            name: 'Tron (TRC-20)',
            network_fee: 1,
            required_confirmations: 1,
            avg_confirmation_seconds: 60,
          },
        ],
      },
    ],
  }
  expect(() => parseCurrencies(body)).toThrow()
})

test('keeps an eighteen-place amount exact', () => {
  const p = parsePayment(paymentJson({}, { total_due: '0.055295738369148398' }))
  expect(p.quote.total_due).toBe('0.055295738369148398')
})

test.each([163.69, '1e3', '-1', '1.', '.5', '', ' 1', '1,5'])(
  'rejects %o as an amount',
  (bad) => {
    expect(() => parsePayment(paymentJson({}, { total_due: bad }))).toThrow()
  },
)

test('rejects a numeric amount inside a status', () => {
  expect(() =>
    parsePayment(
      paymentJson({
        status: 'detected',
        ...STATE_FIXTURES.detected,
        amount_received: 163.69,
      }),
    ),
  ).toThrow()
})

test('maps a status it does not know to unknown', () => {
  expect(parsePayment(paymentJson({ status: 'refunded' }))).toMatchObject({
    status: 'unknown',
    raw_status: 'refunded',
  })
})

test('rejects a payment with no status string', () => {
  expect(() => parsePayment(paymentJson({ status: 7 }))).toThrow()
})

test.each(['2026-08-14T08:52:10.842Z', '2026-08-14T11:52:10+03:00'])(
  'accepts %s as expires_at',
  (ok) => {
    expect(
      parsePayment(paymentJson({}, { expires_at: ok })).quote.expires_at,
    ).toBe(ok)
  },
)

test.each(['', 'soon', '2026-08-14', '2026-08-14T08:52:10', 1794503441])(
  'rejects %o as expires_at',
  (bad) => {
    expect(() => parsePayment(paymentJson({}, { expires_at: bad }))).toThrow()
  },
)

test('rejects a status timestamp with no zone', () => {
  expect(() =>
    parsePayment(
      paymentJson({ status: 'expired', expired_at: '2026-08-14T08:52:10' }),
    ),
  ).toThrow()
})

test('rejects a known status that is missing its fields', () => {
  expect(() => parsePayment(paymentJson({ status: 'underpaid' }))).toThrow()
})

test('reads a problem body, and returns null for anything else', () => {
  const problem = {
    type: 'https://developers.triple-a.io/errors/quote-not-expired',
    title: 'Quote has not expired',
    status: 409,
    detail: 'Only an expired quote can be requoted.',
  }
  expect(parseProblem(problem)).toEqual(problem)
  const noDetail = { type: problem.type, title: problem.title, status: 409 }
  expect(parseProblem(noDetail)).toEqual(noDetail)
  expect(parseProblem({ error: 'Not found' })).toBeNull()
  expect(parseProblem('<html>Bad gateway</html>')).toBeNull()
  expect(parseProblem(null)).toBeNull()
})
