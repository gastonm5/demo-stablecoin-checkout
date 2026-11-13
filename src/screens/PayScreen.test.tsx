import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QRCodeSVG } from 'qrcode.react'
import type { ComponentProps } from 'react'
import { expect, test, vi } from 'vitest'
import { paymentWith } from '../test/fixtures'
import { PayScreen } from './PayScreen'

type Props = ComponentProps<typeof PayScreen>
type PayView = Props['screen']

const ADDRESS = 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e'
const running = {
  kind: 'pay',
  mode: 'full',
  payment: paymentWith('awaiting_payment'),
  clock: 'running',
  showAddress: true,
  remainingMs: 767_000,
} as const
const remaining = {
  kind: 'pay',
  mode: 'remaining',
  payment: paymentWith('underpaid'),
  clock: 'none',
  showAddress: true,
} as const
// Past the deadline the clock alone decides whether the address shows.
const timedOut = (
  clock: 'checking' | 'cannot_confirm' | 'still_valid',
): PayView => {
  const { payment } = running
  return clock === 'still_valid'
    ? { kind: 'pay', mode: 'full', payment, clock, showAddress: true }
    : { kind: 'pay', mode: 'full', payment, clock, showAddress: false }
}
const ethQuote = {
  crypto_currency: 'ETH',
  network: 'ethereum',
  network_name: 'Ethereum',
  exchange_rate: '2764.20',
  crypto_amount: '0.054229071702481731',
  network_fee: '0.001066666666666667',
  total_due: '0.055295738369148398',
  crypto_address: '0x39fc48188b62b7b07580aa3c2c6801d075f54893',
}

function renderPay(overrides: Partial<Props> = {}) {
  return render(
    <PayScreen screen={running} onChange={() => {}} {...overrides} />,
  )
}

async function copyWith(buttonName: string) {
  const user = userEvent.setup()
  const writeText = vi.spyOn(navigator.clipboard, 'writeText')
  await user.click(screen.getByRole('button', { name: buttonName }))
  return writeText
}

// The whole text of an element, so a sentence split by <strong> is matched in one piece.
const fullText = (text: string) =>
  screen.getByText((_, element) => element?.textContent === text)

test('names the network on the banner, the address label, the copy button and the QR', () => {
  renderPay()
  expect(screen.getByText('Tron (TRC-20) network')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Send USDT on Tron only. Any other network loses your funds.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('Tron (TRC-20) address')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Copy Tron address' }),
  ).toBeInTheDocument()
  expect(screen.getByText('TRON (TRC-20) ONLY')).toBeInTheDocument()
  expect(
    screen.getByTitle('QR code for the Tron (TRC-20) address'),
  ).toBeInTheDocument()
})

test('the QR holds exactly the address, with a quiet zone of four modules', () => {
  const cells = (svg: Element | null) =>
    [...(svg?.querySelectorAll('path') ?? [])].map((p) => p.getAttribute('d'))
  // The same library encoding the bare address: any other value draws other cells.
  const alone = render(<QRCodeSVG value={ADDRESS} marginSize={4} />)
  const expected = cells(alone.container.querySelector('svg'))
  alone.unmount()
  renderPay()
  const qr = screen
    .getByTitle('QR code for the Tron (TRC-20) address')
    .closest('svg')
  expect(cells(qr)).toEqual(expected)
  // This address takes 29 modules a side; the quiet zone adds four on each side.
  expect(qr).toHaveAttribute('viewBox', '0 0 37 37')
  expect(screen.getByText('Scan with your wallet app')).toBeInTheDocument()
  expect(
    screen.getByText(
      'The code holds the address only. Enter the amount yourself.',
    ),
  ).toBeInTheDocument()
})

test('shows the amount exactly as sent and copies it without the unit', async () => {
  renderPay()
  expect(screen.getByText('Send exactly')).toBeInTheDocument()
  expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  expect(
    screen.getByText(
      '162.69 USDT + 1.00 USDT network fee · 1 USDT = 0.9214 EUR',
    ),
  ).toBeInTheDocument()
  const writeText = await copyWith('Copy amount')
  expect(writeText).toHaveBeenCalledExactlyOnceWith('163.69')
})

test('keeps all eighteen places of an ETH amount', async () => {
  renderPay({
    screen: {
      ...running,
      payment: paymentWith('awaiting_payment', {}, ethQuote),
    },
  })
  const amount = screen.getByText('0.055295738369148398 ETH')
  // Eighteen places are wider than the card; they must wrap, not overflow.
  expect(amount).toHaveClass('break-all')
  expect(
    screen.getByText(
      '0.054229071702481731 ETH + 0.001066666666666667 ETH network fee · 1 ETH = 2764.20 EUR',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('Ethereum network')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Copy Ethereum address' }),
  ).toBeInTheDocument()
  const writeText = await copyWith('Copy amount')
  expect(writeText).toHaveBeenCalledExactlyOnceWith('0.055295738369148398')
})

test('copies the full address', async () => {
  renderPay()
  expect(screen.getByText(ADDRESS)).toBeInTheDocument()
  const writeText = await copyWith('Copy Tron address')
  expect(writeText).toHaveBeenCalledExactlyOnceWith(ADDRESS)
})

test('shows the merchant, the order and the fiat amount', () => {
  expect(navigator.language).toBe('en-US')
  renderPay()
  expect(screen.getByText('Nordwind Audio')).toBeInTheDocument()
  expect(screen.getByText('Order ORD-88213')).toBeInTheDocument()
  expect(screen.getByText('€149.90')).toBeInTheDocument()
})

test('shows the countdown', () => {
  renderPay()
  expect(screen.getByText('Rate held for')).toBeInTheDocument()
  const timer = screen.getByRole('timer')
  expect(timer).toHaveTextContent('12:47')
  expect(timer).not.toHaveAttribute('aria-live')
})

test.each([
  ['checking', "Time's up."],
  ['cannot_confirm', "We can't confirm this quote is still live."],
] as const)('%s hides the address and the QR', (clock, text) => {
  renderPay({ screen: timedOut(clock) })
  expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument()
  expect(screen.queryByText(/address$/)).not.toBeInTheDocument()
  expect(screen.queryByTitle(/QR code/)).not.toBeInTheDocument()
  expect(screen.queryByText(/ONLY$/)).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /address/ }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByText('The address is hidden until we can confirm this quote.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  expect(screen.getByText(text)).toBeInTheDocument()
})

test('still valid shows the address and no timer', () => {
  renderPay({ screen: timedOut('still_valid') })
  expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  expect(screen.queryByText('Rate held for')).not.toBeInTheDocument()
  expect(screen.getByText(ADDRESS)).toBeInTheDocument()
  expect(
    screen.getByTitle('QR code for the Tron (TRC-20) address'),
  ).toBeInTheDocument()
  expect(screen.getByText('This quote is still valid.')).toBeInTheDocument()
})

test('underpaid shows the remaining amount, what arrived, and no countdown', () => {
  renderPay({ screen: remaining, onChange: null })
  expect(screen.getByText('Send the remaining')).toBeInTheDocument()
  expect(screen.getByText('43.69 USDT')).toBeInTheDocument()
  expect(
    screen.getByText(/We received 120.00 of 163.69 USDT/),
  ).toBeInTheDocument()
  expect(
    fullText(
      'Part of your payment arrived. We received 120.00 of 163.69 USDT.',
    ),
  ).toBeInTheDocument()
  // The notice comes before the network banner.
  expect(
    screen
      .getByText('Part of your payment arrived.')
      .compareDocumentPosition(screen.getByText('Tron (TRC-20) network')),
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  expect(screen.queryByText('Send exactly')).not.toBeInTheDocument()
  expect(screen.queryByText('163.69 USDT')).not.toBeInTheDocument()
  expect(screen.queryByText(/network fee/)).not.toBeInTheDocument()
  expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  expect(
    screen.queryByText('Change currency or network'),
  ).not.toBeInTheDocument()
  expect(screen.getByText(ADDRESS)).toBeInTheDocument()
  expect(
    screen.getByText(
      'Same address as before. The code holds the address only.',
    ),
  ).toBeInTheDocument()
})

test('underpaid copies the remaining amount', async () => {
  renderPay({ screen: remaining, onChange: null })
  const writeText = await copyWith('Copy amount')
  expect(writeText).toHaveBeenCalledExactlyOnceWith('43.69')
})

test('underpaid shows the address its own status gives', async () => {
  const other = 'TXYZ9w8v7u6t5s4r3q2p1n9m8k7j6h5g4f'
  const payment = paymentWith('underpaid', { crypto_address: other })
  renderPay({ screen: { ...remaining, payment }, onChange: null })
  expect(screen.getByText(other)).toBeInTheDocument()
  const writeText = await copyWith('Copy Tron address')
  expect(writeText).toHaveBeenCalledExactlyOnceWith(other)
})

test.each([
  ['none', remaining, 'Send the rest in one transfer to the same address.'],
  [
    'checking',
    timedOut('checking'),
    "Time's up. Checking with the payment service.",
  ],
  [
    'still_valid',
    timedOut('still_valid'),
    'This quote is still valid. Your device clock looks wrong, so the timer is hidden.',
  ],
  [
    'cannot_confirm',
    timedOut('cannot_confirm'),
    "We can't confirm this quote is still live. Don't send until this page reconnects.",
  ],
] as const)('the strip for %s', (_, view, text) => {
  renderPay({ screen: view })
  expect(fullText(text)).toBeInTheDocument()
})

test('a connection notice replaces the strip text', () => {
  renderPay({
    screen: timedOut('still_valid'),
    notice: <span>You appear to be offline.</span>,
  })
  expect(screen.getByText('You appear to be offline.')).toBeInTheDocument()
  expect(
    screen.queryByText('This quote is still valid.'),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Change currency or network' }),
  ).toBeInTheDocument()
})

test('the change link asks the caller to change', async () => {
  const onChange = vi.fn()
  renderPay({ onChange })
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Change currency or network' }))
  expect(onChange).toHaveBeenCalledOnce()
})
