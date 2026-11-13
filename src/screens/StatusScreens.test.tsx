import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { formatDateTime } from '../domain/format'
import { startSequence } from '../domain/sequence'
import type { SequenceEntry } from '../domain/sequence'
import { paymentWith, STATE_FIXTURES } from '../test/fixtures'
import { CheckingScreen } from './CheckingScreen'
import { CompleteScreen } from './CompleteScreen'
import { ExpiredScreen } from './ExpiredScreen'
import { FailedScreen } from './FailedScreen'
import { reasonText } from './statusText'
import { WaitingScreen } from './WaitingScreen'

type ExpiredProps = ComponentProps<typeof ExpiredScreen>
type ExpiredFacts =
  | { variant: 'plain' | 'cautious' }
  | { variant: 'dead_end'; after: 'partial' | 'payment' }

const REFERENCE = 'AQH-100306-PMT'
const HASH = '9d1f4c8a2be7...'
const ADDRESS = 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e'

// on_hold is a status the page does not know, so it parses as unknown.
const unknownStatus = () => paymentWith('unknown', { status: 'on_hold' })
const waiting = (status: 'detected' | 'confirming') =>
  ({ kind: 'waiting', payment: paymentWith(status) }) as const
const complete = (status: 'paid' | 'overpaid') =>
  ({ kind: 'complete', payment: paymentWith(status) }) as const
const checking = () => ({ kind: 'checking', payment: unknownStatus() }) as const

// The entry the sequence records for a status, so its amounts are validated strings.
const entryFor = (status: 'underpaid' | 'confirming'): SequenceEntry =>
  startSequence(paymentWith(status), 'creation', 0).entries[0]
// amount_received 120.00, amount_outstanding 43.69
const partialMoney = entryFor('underpaid')
// amount_received 163.69
const fullMoney = entryFor('confirming')

function expired(facts: ExpiredFacts, more: Partial<ExpiredProps> = {}) {
  const props: ExpiredProps = {
    screen: { kind: 'expired', payment: paymentWith('expired'), ...facts },
    money:
      'after' in facts
        ? facts.after === 'partial'
          ? partialMoney
          : fullMoney
        : undefined,
    requoting: false,
    error: null,
    onRequote: vi.fn(),
    onChange: vi.fn(),
    ...more,
  }
  return { props, node: <ExpiredScreen {...props} /> }
}

const failed = (moneySeen: 'yes' | 'no' | 'unknown') => (
  <FailedScreen
    screen={{ kind: 'failed', payment: paymentWith('failed'), moneySeen }}
    money={moneySeen === 'yes' ? fullMoney : undefined}
  />
)

const STATUS_SCREENS: [string, () => ReactNode][] = [
  ['detected', () => <WaitingScreen screen={waiting('detected')} />],
  ['confirming', () => <WaitingScreen screen={waiting('confirming')} />],
  ['paid', () => <CompleteScreen screen={complete('paid')} />],
  ['overpaid', () => <CompleteScreen screen={complete('overpaid')} />],
  ['expired, plain', () => expired({ variant: 'plain' }).node],
  ['expired, cautious', () => expired({ variant: 'cautious' }).node],
  [
    'expired after part',
    () => expired({ variant: 'dead_end', after: 'partial' }).node,
  ],
  [
    'expired after a payment',
    () => expired({ variant: 'dead_end', after: 'payment' }).node,
  ],
  ['failed, money seen', () => failed('yes')],
  ['failed, no money', () => failed('no')],
  ['failed, money unknown', () => failed('unknown')],
  ['checking', () => <CheckingScreen screen={checking()} />],
]

// The whole text of an element, so a sentence split by <strong> is matched in one piece.
const fullText = (text: string) =>
  screen.getByText((_, element) => element?.textContent === text)

const buttonNames = () =>
  screen.getAllByRole('button').map((button) => button.textContent)

test.each(['plain', 'cautious'] as const)(
  'expired, %s: the new quote and the change link need the tick box',
  async (variant) => {
    const { props, node } = expired({ variant })
    render(node)
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'Get a new quote' })
    const link = screen.getByRole('button', {
      name: 'Change currency or network',
    })
    expect(button).toBeDisabled()
    expect(link).toBeDisabled()
    await user.click(button)
    await user.click(link)
    expect(props.onRequote).not.toHaveBeenCalled()
    expect(props.onChange).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('checkbox', { name: 'I have not sent a payment' }),
    )
    await user.click(button)
    expect(props.onRequote).toHaveBeenCalledTimes(1)
    await user.click(link)
    expect(props.onChange).toHaveBeenCalledTimes(1)
  },
)

test('expired: says what it shows and what it hides', () => {
  render(expired({ variant: 'plain' }).node)
  expect(
    screen.getByRole('heading', { name: 'This quote has expired' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Expired quote')).toBeInTheDocument()
  expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  expect(
    screen.getByText(
      formatDateTime(STATE_FIXTURES.expired.expired_at as string),
    ),
  ).toBeInTheDocument()
  expect(
    fullText(
      'Already sent? Do not send again. We are still watching for your payment.',
    ),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Still checking for a late payment.'),
  ).toBeInTheDocument()
  expect(screen.queryByText(/If you sent any funds/)).not.toBeInTheDocument()
})

test('expired: while a new quote is on its way the button says so', async () => {
  render(expired({ variant: 'plain' }, { requoting: true }).node)
  await userEvent
    .setup()
    .click(screen.getByRole('checkbox', { name: 'I have not sent a payment' }))
  expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
  expect(
    screen.queryByRole('button', { name: 'Get a new quote' }),
  ).not.toBeInTheDocument()
})

test('expired: a failed new quote says so', () => {
  render(expired({ variant: 'plain' }, { error: new Error('down') }).node)
  expect(screen.getByRole('alert')).toHaveTextContent(
    "We couldn't get a new quote. Try again.",
  )
})

test.each([
  ['plain', { variant: 'plain' }],
  ['cautious', { variant: 'cautious' }],
  ['dead_end partial', { variant: 'dead_end', after: 'partial' }],
  ['dead_end payment', { variant: 'dead_end', after: 'payment' }],
] as const)('expired, %s: never shows the address', (_, facts) => {
  render(expired(facts).node)
  expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument()
  expect(screen.queryByTitle(/QR code/)).not.toBeInTheDocument()
})

test('expired: the cautious variant warns about earlier funds', () => {
  render(expired({ variant: 'cautious' }).node)
  const warning = screen.getByText(
    'If you sent any funds for this payment, do not get a new quote. Contact Nordwind Audio.',
  )
  expect(warning.compareDocumentPosition(screen.getByRole('checkbox'))).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  )
})

test('expired after a partial payment is a dead end', () => {
  render(expired({ variant: 'dead_end', after: 'partial' }).node)
  expect(screen.getByText("The full amount wasn't reached")).toBeInTheDocument()
  expect(screen.getByText('Received before it expired')).toBeInTheDocument()
  expect(screen.getByText('120.00 USDT')).toBeInTheDocument()
  expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  expect(screen.getByText('43.69 USDT')).toBeInTheDocument()
  expect(screen.getByText('Missing')).toBeInTheDocument()
  expect(
    fullText(
      'This payment expired before the rest arrived. We are still watching in case it is on its way. Do not send again.',
    ),
  ).toBeInTheDocument()
  expect(
    fullText(
      "This page can't complete this payment or tell you what happens to the 120.00 USDT you sent. Contact Nordwind Audio and quote reference AQH-100306-PMT.",
    ),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Still checking for a late payment.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /quote/i }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText('Change currency or network'),
  ).not.toBeInTheDocument()
  expect(buttonNames()).toEqual([
    'Copy transaction hash',
    'Copy payment reference',
  ])
})

test('expired after a full payment was seen is a dead end too', () => {
  render(expired({ variant: 'dead_end', after: 'payment' }).node)
  expect(
    screen.getByRole('heading', { name: 'This payment expired' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Payment seen')).toBeInTheDocument()
  expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  expect(
    fullText('We saw a payment before it expired. Do not send again.'),
  ).toBeInTheDocument()
  expect(
    fullText(
      "This page can't complete this payment or tell you what happens to the 163.69 USDT you sent. Contact Nordwind Audio and quote reference AQH-100306-PMT.",
    ),
  ).toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(
    screen.queryByText('Change currency or network'),
  ).not.toBeInTheDocument()
  expect(buttonNames()).toEqual([
    'Copy transaction hash',
    'Copy payment reference',
  ])
})

test('overpaid tells the truth about the extra', () => {
  render(<CompleteScreen screen={complete('overpaid')} />)
  expect(screen.getByText('Payment complete')).toBeInTheDocument()
  expect(screen.getByText('Received')).toBeInTheDocument()
  expect(screen.getByText('180.00 USDT')).toBeInTheDocument()
  expect(screen.getByText('Amount due')).toBeInTheDocument()
  expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  expect(screen.getByText('Extra sent')).toBeInTheDocument()
  expect(screen.getByText('16.31 USDT')).toBeInTheDocument()
  expect(
    screen.getByText(/You sent 16.31 USDT more than was due/),
  ).toBeInTheDocument()
  expect(screen.getByText(/can't return the extra amount/)).toBeInTheDocument()
  expect(
    fullText(
      "You sent 16.31 USDT more than was due. This page can't return the extra amount. Contact Nordwind Audio and quote reference AQH-100306-PMT.",
    ),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Your order is paid. Nothing more to send.'),
  ).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/refund/i)
})

test('paid shows the amount, the reference and the settled time', () => {
  render(<CompleteScreen screen={complete('paid')} />)
  expect(
    screen.getByRole('heading', { name: 'Payment complete' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Paid')).toBeInTheDocument()
  expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  expect(screen.getByText(REFERENCE)).toBeInTheDocument()
  expect(screen.getByText('Settled')).toBeInTheDocument()
  expect(
    screen.getByText(formatDateTime(STATE_FIXTURES.paid.settled_at as string)),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Nordwind Audio has your payment for order ORD-88213.'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Nothing more to do. You can close this page.'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Extra sent')).not.toBeInTheDocument()
})

test('detected says seen on the network, not received', () => {
  render(<WaitingScreen screen={waiting('detected')} usualSeconds={60} />)
  expect(
    screen.getByRole('heading', {
      name: "We've seen your payment on the network",
    }),
  ).toBeInTheDocument()
  expect(screen.getByText('Payment seen')).toBeInTheDocument()
  expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  expect(
    screen.getByText(
      "Waiting for it to be confirmed. You don't need to send anything else.",
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('Confirmations')).toBeInTheDocument()
  expect(screen.getByText('0 of 1')).toBeInTheDocument()
  expect(screen.getByText('Usually about 1 min on Tron.')).toBeInTheDocument()
  expect(screen.getByText('Seen at')).toBeInTheDocument()
  expect(
    screen.getByText(
      formatDateTime(STATE_FIXTURES.detected.detected_at as string),
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('This page updates by itself.')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/received|complete/i)
})

test('confirming shows its progress', () => {
  render(<WaitingScreen screen={waiting('confirming')} />)
  expect(screen.getByText('2 of 3')).toBeInTheDocument()
  expect(screen.queryByText('Seen at')).not.toBeInTheDocument()
  expect(screen.queryByText(/Usually about/)).not.toBeInTheDocument()
})

test.each(STATUS_SCREENS)(
  '%s shows the full reference with a labelled copy button, and no address',
  (_, node) => {
    render(node())
    expect(screen.getByText(REFERENCE)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Copy payment reference' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute(
      'tabindex',
      '-1',
    )
    expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument()
    expect(screen.queryByTitle(/QR code/)).not.toBeInTheDocument()
  },
)

test.each([
  ['detected', () => <WaitingScreen screen={waiting('detected')} />],
  ['paid', () => <CompleteScreen screen={complete('paid')} />],
  ['overpaid', () => <CompleteScreen screen={complete('overpaid')} />],
  [
    'expired after part',
    () => expired({ variant: 'dead_end', after: 'partial' }).node,
  ],
  [
    'expired after a payment',
    () => expired({ variant: 'dead_end', after: 'payment' }).node,
  ],
  ['failed, money seen', () => failed('yes')],
])('%s shows the transaction hash', (_, node) => {
  render(node())
  expect(screen.getByText(HASH)).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Copy transaction hash' }),
  ).toBeInTheDocument()
})

test('the copy buttons copy the exact reference and hash', async () => {
  render(<CompleteScreen screen={complete('paid')} />)
  const user = userEvent.setup()
  const writeText = vi.spyOn(navigator.clipboard, 'writeText')
  await user.click(
    screen.getByRole('button', { name: 'Copy transaction hash' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Copy payment reference' }),
  )
  expect(writeText.mock.calls).toEqual([[HASH], [REFERENCE]])
})

test.each([
  ['yes', /We saw your payment/],
  ['no', /The settlement was rejected/],
  ['unknown', /If you sent any funds/],
] as const)('failed, money %s', (moneySeen, wording) => {
  render(failed(moneySeen))
  expect(
    screen.getByRole('heading', {
      name: 'This payment could not be completed',
    }),
  ).toBeInTheDocument()
  expect(screen.getByText(wording)).toBeInTheDocument()
  expect(
    fullText(
      'Do not send anything more. Contact Nordwind Audio and quote the reference.',
    ),
  ).toBeInTheDocument()
  if (moneySeen === 'yes') {
    expect(
      screen.getByText(
        'We saw your payment, but it could not be completed. The settlement was rejected.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Payment seen')).toBeInTheDocument()
    expect(screen.getByText('163.69 USDT')).toBeInTheDocument()
  } else {
    expect(screen.getByText('The settlement was rejected.')).toBeInTheDocument()
    expect(screen.queryByText(/We saw/)).not.toBeInTheDocument()
    expect(screen.queryByText('Payment seen')).not.toBeInTheDocument()
    expect(screen.queryByText(HASH)).not.toBeInTheDocument()
  }
  const unsure = screen.queryByText(
    'If you sent any funds for this payment, tell Nordwind Audio.',
  )
  if (moneySeen === 'unknown') expect(unsure).toBeInTheDocument()
  else expect(unsure).not.toBeInTheDocument()
})

test.each(['yes', 'no', 'unknown'] as const)(
  'failed, money %s, has no button but the copy ones, and shows the reason code',
  (moneySeen) => {
    render(failed(moneySeen))
    expect(buttonNames().every((name) => name?.startsWith('Copy '))).toBe(true)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      screen.getByText('Reason code: settlement_rejected'),
    ).toBeInTheDocument()
  },
)

test('a reason the page does not know gets generic wording', () => {
  expect(reasonText('settlement_rejected')).toBe('The settlement was rejected.')
  expect(reasonText('chain_reorg')).toBe(
    'The payment service reported a problem.',
  )
  render(
    <FailedScreen
      screen={{
        kind: 'failed',
        payment: paymentWith('failed', { reason: 'chain_reorg' }),
        moneySeen: 'no',
      }}
    />,
  )
  expect(
    screen.getByText('The payment service reported a problem.'),
  ).toBeInTheDocument()
  expect(screen.getByText('Reason code: chain_reorg')).toBeInTheDocument()
})

test('checking gives the reference and a way forward', () => {
  render(<CheckingScreen screen={checking()} />)
  expect(
    screen.getByRole('heading', { name: "We're checking your payment" }),
  ).toBeInTheDocument()
  expect(screen.getByText(REFERENCE)).toBeInTheDocument()
  expect(screen.getByText(/contact Nordwind Audio/)).toBeInTheDocument()
  expect(
    fullText(
      "Don't send again. If this doesn't change, contact Nordwind Audio and quote reference AQH-100306-PMT.",
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('This page updates by itself.')).toBeInTheDocument()
  expect(screen.queryByText(HASH)).not.toBeInTheDocument()
})

test('checking keeps the transaction seen earlier', () => {
  render(<CheckingScreen screen={checking()} money={fullMoney} />)
  expect(screen.getByText(HASH)).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Copy transaction hash' }),
  ).toBeInTheDocument()
})

test('a connection notice replaces the strip text', () => {
  render(
    <WaitingScreen
      screen={waiting('detected')}
      notice={<span>You appear to be offline.</span>}
    />,
  )
  expect(screen.getByText('You appear to be offline.')).toBeInTheDocument()
  expect(
    screen.queryByText('This page updates by itself.'),
  ).not.toBeInTheDocument()
})

test('the failed screen draws no strip, but a connection notice still gets one', () => {
  const { container, unmount } = render(failed('no'))
  // Besides the strip, the card has one region, so a second child means a strip was drawn.
  expect(container.firstElementChild?.childElementCount).toBe(1)
  unmount()
  render(
    <FailedScreen
      screen={{
        kind: 'failed',
        payment: paymentWith('failed'),
        moneySeen: 'no',
      }}
      notice={<span>You appear to be offline.</span>}
    />,
  )
  expect(screen.getByText('You appear to be offline.')).toBeInTheDocument()
})
