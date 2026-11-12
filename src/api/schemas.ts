import { z } from 'zod'

// A JSON number has already been through a float, so only a plain decimal string is an amount.
const decimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .brand<'DecimalString'>()
export type DecimalString = z.infer<typeof decimalString>

const count = z.int().nonnegative()
const timestamp = z.iso.datetime({ offset: true })

const network = z.object({
  id: z.string(),
  name: z.string(),
  network_fee: decimalString,
  required_confirmations: count,
  avg_confirmation_seconds: count,
})
export type Network = z.infer<typeof network>

const currency = z.object({
  code: z.string(),
  name: z.string(),
  decimals: count,
  networks: z.array(network),
})
export type Currency = z.infer<typeof currency>

const quote = z.object({
  crypto_currency: z.string(),
  network: z.string(),
  network_name: z.string(),
  exchange_rate: decimalString,
  crypto_amount: decimalString,
  network_fee: decimalString,
  total_due: decimalString,
  crypto_address: z.string(),
  required_confirmations: count,
  expires_at: timestamp,
})
export type Quote = z.infer<typeof quote>

const paymentBase = z.object({
  payment_reference: z.string(),
  order_id: z.string(),
  merchant: z.object({ name: z.string(), logo_url: z.string().nullable() }),
  order: z.object({ currency: z.string(), amount: decimalString }),
  quote,
})
export type PaymentBase = z.infer<typeof paymentBase>

const confirmations = {
  confirmations: count,
  required_confirmations: count,
  amount_received: decimalString,
  tx_hash: z.string(),
}

const knownState = z.discriminatedUnion('status', [
  z.object({ status: z.literal('awaiting_payment') }),
  z.object({
    status: z.literal('detected'),
    ...confirmations,
    detected_at: timestamp,
  }),
  z.object({ status: z.literal('confirming'), ...confirmations }),
  z.object({
    status: z.literal('paid'),
    ...confirmations,
    settled_at: timestamp,
  }),
  z.object({
    status: z.literal('underpaid'),
    amount_received: decimalString,
    amount_outstanding: decimalString,
    crypto_address: z.string(),
    tx_hash: z.string(),
  }),
  z.object({
    status: z.literal('overpaid'),
    amount_received: decimalString,
    amount_excess: decimalString,
    tx_hash: z.string(),
    settled_at: timestamp,
  }),
  z.object({ status: z.literal('expired'), expired_at: timestamp }),
  z.object({ status: z.literal('failed'), reason: z.string() }),
])
const knownStatuses: ReadonlySet<string> = new Set(
  knownState.options.map((option) => option.shape.status.value),
)

export type PaymentState =
  z.infer<typeof knownState> | { status: 'unknown'; raw_status: string }
export type Payment = PaymentBase & PaymentState
export type PaymentStatus = Payment['status']

const problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.int(),
  detail: z.string().optional(),
})
export type Problem = z.infer<typeof problem>

export function parseCurrencies(json: unknown): Currency[] {
  return z.object({ currencies: z.array(currency) }).parse(json).currencies
}

export function parsePayment(json: unknown): Payment {
  const { status, ...base } = paymentBase
    .extend({ status: z.string() })
    .parse(json)
  // A new server status is not an error: the page shows "we're checking" and keeps polling.
  if (!knownStatuses.has(status)) {
    return { ...base, status: 'unknown', raw_status: status }
  }
  return { ...base, ...knownState.parse(json) }
}

export function parseProblem(json: unknown): Problem | null {
  const result = problem.safeParse(json)
  return result.success ? result.data : null
}
