import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { parseCurrencies } from '../api/schemas'
import type { Payment } from '../api/schemas'
import { recordStatus, startSequence } from '../domain/sequence'
import { ASSUMED_ORDER } from '../config/checkout'
import type { UseCheckoutResult } from '../hooks/useCheckout'
import type { Catalogue } from '../hooks/useCurrencies'
import type { UsePaymentResult } from '../hooks/usePayment'
import { CURRENCIES_JSON, makePayment, STATE_FIXTURES } from '../test/fixtures'
import { PaymentView } from './PaymentView'

const DEADLINE = Date.parse('2026-08-14T08:52:10.842Z')
const BEFORE = DEADLINE - 60_000
const AFTER = DEADLINE + 60_000
const ADDRESS = 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e'
const HASH = '9d1f4c8a2be7...'
const UNREACHABLE = "We can't reach the payment service."

const withStatus = (status: string, quote?: Record<string, unknown>) =>
  makePayment({ status, ...STATE_FIXTURES[status] }, quote)

// The sequence as the page would have seen it, oldest first.
function paymentResult(
  seen: readonly Payment[],
  over: Partial<UsePaymentResult> = {},
): UsePaymentResult {
  const [first, ...rest] = seen
  return {
    entry: first && {
      payment: seen.at(-1) ?? first,
      sequence: rest.reduce(
        (sequence, payment, i) => recordStatus(sequence, payment, i + 1),
        startSequence(first, 'creation', 0),
      ),
    },
    isLoading: first === undefined,
    error: null,
    lastSuccessAt: Date.now() - 1_000,
    lastFailureAt: null,
    consecutiveFailures: 0,
    checkNow: vi.fn(),
    ...over,
  }
}

function checkoutWith(
  payment: UsePaymentResult,
  over: Partial<UseCheckoutResult> = {},
): UseCheckoutResult {
  return {
    order: ASSUMED_ORDER,
    reference: 'AQH-100306-PMT',
    view: { kind: 'payment' },
    payment,
    submit: vi.fn(),
    submitting: false,
    submitError: null,
    changeChoice: vi.fn(),
    cancelChange: vi.fn(),
    ...over,
  }
}

const catalogue = (over: Partial<Catalogue> = {}): Catalogue => ({
  currencies: parseCurrencies(CURRENCIES_JSON),
  isLoading: false,
  error: null,
  retry: vi.fn(),
  ...over,
})
const loadingCatalogue = () =>
  catalogue({ currencies: undefined, isLoading: true })

function renderView(checkout: UseCheckoutResult, cat = catalogue()) {
  const view = render(<PaymentView checkout={checkout} catalogue={cat} />)
  return {
    checkout,
    catalogue: cat,
    rerender: (next: UseCheckoutResult) =>
      view.rerender(<PaymentView checkout={next} catalogue={cat} />),
  }
}

const announced = () => screen.getByRole('status')
// On the card, not in the announcement that repeats it.
const shown = (text: string) =>
  screen.getByText(text, { ignore: '[role=status], script, style' })

beforeEach(() => {
  // Only the clock: userEvent waits on real timers.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(BEFORE)
})

afterEach(() => {
  vi.useRealTimers()
})

test('shows a loading card before the first answer', () => {
  renderView(checkoutWith(paymentResult([])))
  expect(screen.getByText('Loading your payment…')).toBeInTheDocument()
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByText(/USDT/)).not.toBeInTheDocument()
  expect(screen.queryByText(UNREACHABLE)).not.toBeInTheDocument()
  expect(
    screen.queryByText('You appear to be offline.'),
  ).not.toBeInTheDocument()
})

// A reload during an outage has no status to show yet, but must still say why nothing arrives.
test('the loading card says when the payment service cannot be reached', async () => {
  const { checkout } = renderView(
    checkoutWith(paymentResult([], { consecutiveFailures: 2 })),
  )
  expect(screen.getByText('Loading your payment…')).toBeInTheDocument()
  expect(screen.getByText(UNREACHABLE)).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try now' }))
  expect(checkout.payment.checkNow).toHaveBeenCalledOnce()
  expect(screen.queryByText(/USDT/)).not.toBeInTheDocument()
  expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument()
  expect(screen.queryByTitle(/QR code/)).not.toBeInTheDocument()
})

test('the loading card says when the browser is offline', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  renderView(checkoutWith(paymentResult([])))
  expect(screen.getByText('Loading your payment…')).toBeInTheDocument()
  expect(screen.getByText('You appear to be offline.')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('the pay screen waits for the currency list', () => {
  renderView(
    checkoutWith(paymentResult([withStatus('awaiting_payment')])),
    loadingCatalogue(),
  )
  expect(screen.getByText('Loading the payment details…')).toBeInTheDocument()
  expect(screen.getByText('Nordwind Audio')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/163\.69/)
  expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument()
  expect(screen.queryByTitle(/QR code/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('a status screen does not wait for the currency list', () => {
  renderView(
    checkoutWith(paymentResult([withStatus('detected')])),
    loadingCatalogue(),
  )
  expect(
    screen.getByRole('heading', {
      name: "We've seen your payment on the network",
    }),
  ).toBeInTheDocument()
})

test('a failed catalogue offers Try again and shows no amount', async () => {
  const { checkout, catalogue: cat } = renderView(
    checkoutWith(paymentResult([withStatus('awaiting_payment')])),
    catalogue({ currencies: undefined, error: new Error('down') }),
  )
  expect(shown("We couldn't load the payment details.")).toBeInTheDocument()
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Try again' }))
  expect(cat.retry).toHaveBeenCalledOnce()
  expect(checkout.payment.checkNow).toHaveBeenCalledOnce()
  expect(document.body.textContent).not.toMatch(/163\.69/)
  expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument()
  expect(screen.queryByTitle(/QR code/)).not.toBeInTheDocument()
})

test('an amount with too many decimal places is not shown', () => {
  renderView(
    checkoutWith(
      paymentResult([
        withStatus('awaiting_payment', { total_due: '163.1234567' }),
      ]),
    ),
  )
  expect(document.body.textContent).not.toMatch(/163\.1234567/)
  expect(shown("We couldn't load the payment details.")).toBeInTheDocument()
  expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument()
})

test('shows the pay screen once the amount is checked', () => {
  renderView(checkoutWith(paymentResult([withStatus('awaiting_payment')])))
  expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  expect(screen.getByText(ADDRESS)).toBeInTheDocument()
})

test.each([
  [
    'a live quote keeps its address when polls fail',
    'awaiting_payment',
    BEFORE,
    true,
  ],
  ['underpaid keeps its address when polls fail', 'underpaid', AFTER, true],
  [
    'a quote past its deadline hides its address when polls fail',
    'awaiting_payment',
    AFTER,
    false,
  ],
] as const)('%s', (_, status, now, addressShown) => {
  vi.setSystemTime(now)
  renderView(
    checkoutWith(
      paymentResult([withStatus(status)], {
        lastSuccessAt: DEADLINE - 30_000,
        lastFailureAt: now - 1_000,
        consecutiveFailures: 2,
      }),
    ),
  )
  expect(screen.getByText(UNREACHABLE)).toBeInTheDocument()
  if (addressShown) expect(screen.getByText(ADDRESS)).toBeInTheDocument()
  else expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument()
})

test('a live quote keeps its address while the browser is offline', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  renderView(checkoutWith(paymentResult([withStatus('awaiting_payment')])))
  expect(screen.getByText('You appear to be offline.')).toBeInTheDocument()
  expect(screen.getByText(ADDRESS)).toBeInTheDocument()
})

test('keeps the last status and adds the notice when polls fail', async () => {
  const { checkout } = renderView(
    checkoutWith(
      paymentResult([withStatus('detected')], { consecutiveFailures: 2 }),
    ),
  )
  expect(
    screen.getByRole('heading', {
      name: "We've seen your payment on the network",
    }),
  ).toBeInTheDocument()
  expect(screen.getByText(UNREACHABLE)).toBeInTheDocument()
  expect(
    screen.queryByText('This page updates by itself.'),
  ).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try now' }))
  expect(checkout.payment.checkNow).toHaveBeenCalledOnce()
})

test('changing a live quote asks first', async () => {
  const { checkout } = renderView(
    checkoutWith(paymentResult([withStatus('awaiting_payment')])),
  )
  const user = userEvent.setup()
  const change = () =>
    user.click(
      screen.getByRole('button', { name: 'Change currency or network' }),
    )
  await change()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(checkout.changeChoice).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Stay on this payment' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(checkout.changeChoice).not.toHaveBeenCalled()
  await change()
  await user.click(
    screen.getByRole('button', { name: "I haven't sent anything, change" }),
  )
  expect(checkout.changeChoice).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test.each([
  ['underpaid', 'underpaid', BEFORE],
  ['a quote whose address is hidden', 'awaiting_payment', AFTER],
] as const)('%s offers no change', (_, status, now) => {
  vi.setSystemTime(now)
  renderView(
    checkoutWith(
      paymentResult([withStatus(status)], { lastSuccessAt: DEADLINE - 30_000 }),
    ),
  )
  expect(screen.getByText('Tron (TRC-20) network')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Change currency or network' }),
  ).not.toBeInTheDocument()
})

test('the expired screen requotes the same choice and changes without asking', async () => {
  const { checkout } = renderView(
    checkoutWith(paymentResult([withStatus('expired')]), {
      submitting: false,
    }),
  )
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('checkbox', { name: 'I have not sent a payment' }),
  )
  await user.click(screen.getByRole('button', { name: 'Get a new quote' }))
  expect(checkout.submit).toHaveBeenCalledExactlyOnceWith({
    currency: 'USDT',
    network: 'tron',
  })
  await user.click(
    screen.getByRole('button', { name: 'Change currency or network' }),
  )
  expect(checkout.changeChoice).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('the expired screen shows a requote in flight and its failure', () => {
  renderView(
    checkoutWith(paymentResult([withStatus('expired')]), {
      submitting: true,
      submitError: new Error('down'),
    }),
  )
  expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent(
    "We couldn't get a new quote. Try again.",
  )
})

test.each([
  [
    'expired after part of the payment',
    [withStatus('underpaid'), withStatus('expired')],
    '43.69 USDT',
  ],
  [
    'checking after a status the page does not know',
    [withStatus('detected'), makePayment({ status: 'on_hold' })],
    HASH,
  ],
  [
    'failed after a payment was seen',
    [withStatus('confirming'), withStatus('failed')],
    'Payment seen',
  ],
] as const)('%s gets the money seen earlier', (_, seen, text) => {
  renderView(checkoutWith(paymentResult(seen)))
  expect(screen.getByText(text)).toBeInTheDocument()
})

test('announces a new status and moves focus to its headline', () => {
  const { rerender } = renderView(
    checkoutWith(paymentResult([withStatus('detected')])),
  )
  expect(document.body).toHaveFocus()
  rerender(
    checkoutWith(paymentResult([withStatus('detected'), withStatus('paid')])),
  )
  expect(announced()).toHaveTextContent('Payment complete')
  expect(announced()).toHaveAttribute('aria-live', 'polite')
  expect(
    screen.getByRole('heading', { name: 'Payment complete' }),
  ).toHaveFocus()
})

test('announces what to send when the pay screen appears, and leaves focus alone', () => {
  const { rerender } = renderView(checkoutWith(paymentResult([])))
  expect(announced().textContent).toBe('')
  rerender(checkoutWith(paymentResult([withStatus('awaiting_payment')])))
  expect(announced()).toHaveTextContent('Send 163.69 USDT on Tron (TRC-20)')
  expect(document.body).toHaveFocus()
  rerender(
    checkoutWith(
      paymentResult([withStatus('awaiting_payment'), withStatus('underpaid')]),
    ),
  )
  expect(announced()).toHaveTextContent('Send 43.69 USDT on Tron (TRC-20)')
  expect(document.body).toHaveFocus()
})
