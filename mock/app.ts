import express from 'express'
import type { ErrorRequestHandler, Express, Response } from 'express'
import { CURRENCIES } from './fixtures'
import { createStore, type MockStore } from './store'

const PROBLEMS = {
  'quote-not-expired': [409, 'Quote not expired'],
  'payment-not-found': [404, 'Payment not found'],
  'invalid-request': [422, 'Invalid request'],
} as const

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
          ? `The quote is valid until ${result.expires_at}.`
          : 'Only an expired quote can be requoted.',
      )
  })

  api.use(rejectUnparsableBody)

  const app = express()
  app.use('/api', api)
  return app
}
