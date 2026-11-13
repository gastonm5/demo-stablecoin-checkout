import express from 'express'
import type { ErrorRequestHandler, Express, Response } from 'express'
import { CURRENCIES } from './fixtures.ts'
import { createStore, type MockSettings, type MockStore } from './store.ts'

const PROBLEMS = {
  'quote-not-expired': [409, 'Quote has not expired'],
  'payment-not-found': [404, 'Payment not found'],
  'invalid-request': [422, 'Invalid request'],
  internal: [500, 'Internal server error'],
} as const

const STATUSES: unknown[] = [
  'awaiting_payment',
  'detected',
  'confirming',
  'paid',
  'underpaid',
  'overpaid',
  'expired',
  'failed',
]
const FAULTS: unknown[] = ['none', 'http_500', 'drop']

const isCount = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const SETTINGS: Record<keyof MockSettings, (value: unknown) => boolean> = {
  quote_lifetime_seconds: isCount,
  delay_ms: isCount,
  // May be negative: the panel can put the server clock behind the device's.
  clock_offset_seconds: Number.isInteger,
  fault: (value) => FAULTS.includes(value),
}

// hasOwn keeps inherited names such as `constructor` and `__proto__` out of the settings.
const isSetting = ([key, value]: [string, unknown]) =>
  Object.hasOwn(SETTINGS, key) && SETTINGS[key as keyof MockSettings](value)

function problem(
  res: Response,
  kind: keyof typeof PROBLEMS,
  detail: string,
): void {
  const [status, title] = PROBLEMS[kind]
  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: `https://developers.triple-a.io/errors/${kind}`,
      title,
      status,
      detail,
    })
}

const isText = (value: unknown) => typeof value === 'string'

const notFound = (res: Response, reference: string) =>
  problem(
    res,
    'payment-not-found',
    `No payment has the reference ${reference}.`,
  )

const unknownPair = (res: Response, currency: string, network: string) =>
  problem(res, 'invalid-request', `${currency} on ${network} is not offered.`)

// express.json() reports a body it cannot parse as an error, which would otherwise get Express's HTML page.
const rejectUnparsableBody: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.type === 'entity.parse.failed')
    problem(res, 'invalid-request', 'The request body is not valid JSON.')
  else next(err)
}

export function createMockApp(store: MockStore = createStore()): Express {
  const api = express.Router()

  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  api.use((req, res, next) => {
    const timer = setTimeout(() => {
      const { fault } = store.settings
      // Destroying the socket sends no status at all, so the client sees a network error.
      if (fault === 'drop') req.socket.destroy()
      else if (fault === 'http_500')
        problem(res, 'internal', 'The mock is set to fail every API request.')
      else next()
    }, store.settings.delay_ms)
    // A request whose client has gone must not still run when the delay ends.
    res.once('close', () => clearTimeout(timer))
  })
  api.use(express.json())

  api.get('/currencies', (_req, res) => {
    res.json({ currencies: CURRENCIES })
  })

  api.post('/payments', (req, res) => {
    const { order_id, currency, network } = req.body ?? {}
    if (![order_id, currency, network].every(isText))
      return problem(
        res,
        'invalid-request',
        'order_id, currency and network must be strings.',
      )
    const payment = store.createPayment({ order_id, currency, network })
    if (!payment) return unknownPair(res, currency, network)
    res.status(201).json(payment)
  })

  api.get('/payments/:reference', (req, res) => {
    const payment = store.getPayment(req.params.reference)
    if (!payment) return notFound(res, req.params.reference)
    res.json(payment)
  })

  api.post('/payments/:reference/requote', (req, res) => {
    const { reference } = req.params
    const { currency, network } = req.body ?? {}
    if (!isText(currency) || !isText(network))
      return problem(
        res,
        'invalid-request',
        'currency and network must be strings.',
      )
    const result = store.requote(reference, { currency, network })
    if (result.ok) res.status(201).json(result.payment)
    else if (result.reason === 'not_found') notFound(res, reference)
    else if (result.reason === 'unknown_pair')
      unknownPair(res, currency, network)
    else
      problem(
        res,
        'quote-not-expired',
        result.expires_at
          ? `The current quote is valid until ${result.expires_at}.`
          : 'Only an expired quote can be requoted.',
      )
  })

  api.use(rejectUnparsableBody)

  const control = express.Router()
  control.use(express.json())

  control.get('/state', (_req, res) => {
    res.json({ settings: store.settings, payments: store.listPayments() })
  })

  control.post('/payments/:reference/status', (req, res) => {
    const { reference } = req.params
    const { status, confirmations } = req.body ?? {}
    if (
      !STATUSES.includes(status) ||
      !(confirmations === undefined || isCount(confirmations))
    )
      return problem(
        res,
        'invalid-request',
        `status must be one of ${STATUSES.join(', ')}, and confirmations a whole number of 0 or more.`,
      )
    const payment = store.setStatus(reference, status, confirmations)
    if (!payment) return notFound(res, reference)
    res.json(payment)
  })

  control.post('/payments/:reference/restart', (req, res) => {
    const payment = store.restart(req.params.reference)
    if (!payment) return notFound(res, req.params.reference)
    res.json(payment)
  })

  control.post('/settings', (req, res) => {
    const patch: unknown = req.body
    if (
      typeof patch !== 'object' ||
      patch === null ||
      Array.isArray(patch) ||
      !Object.entries(patch).every(isSetting)
    )
      return problem(
        res,
        'invalid-request',
        'Send a JSON object where quote_lifetime_seconds and delay_ms take a whole number of 0 or more, clock_offset_seconds a whole number, and fault one of none, http_500 or drop.',
      )
    res.json(store.updateSettings(patch))
  })

  control.use(rejectUnparsableBody)

  const app = express()
  // The dev server passes every request through the mock, so the header would land on the page too.
  app.disable('x-powered-by')
  app.use('/api', api)
  app.use('/__mock', control)
  return app
}
