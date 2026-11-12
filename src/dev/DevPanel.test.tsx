import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { mergePayment } from '../hooks/paymentCache'
import type { PaymentEntry } from '../hooks/paymentCache'
import { makePayment, STATE_FIXTURES } from '../test/fixtures'
import { DevPanel } from './DevPanel'
import { getMockSettings, updateMockSettings } from './mockControl'
import type { MockSettings } from './mockControl'

const statusCommand = vi.hoisted(() => ({
  sent: vi.fn(),
  answer: (): Promise<void> => Promise.resolve(),
}))

vi.mock('./mockControl', () => ({
  getMockSettings: vi.fn(),
  // A plain function: a vi.fn handles the promises it returns, which would hide an unhandled rejection.
  setMockStatus: (...args: unknown[]) => {
    statusCommand.sent(...args)
    return statusCommand.answer()
  },
  updateMockSettings: vi.fn(),
}))

const REFERENCE = 'AQH-100306-PMT'
const STATUSES = [
  'awaiting_payment',
  'detected',
  'confirming',
  'paid',
  'underpaid',
  'overpaid',
  'expired',
  'failed',
]
const SETTINGS: MockSettings = {
  quote_lifetime_seconds: 900,
  delay_ms: 0,
  fault: 'none',
  clock_offset_seconds: 0,
}

const withStatus = (status: string, state = STATE_FIXTURES[status]) =>
  makePayment({ status, ...state })

function entryOf(...statuses: string[]): PaymentEntry | undefined {
  return statuses.reduce<PaymentEntry | undefined>(
    (entry, status, at) => mergePayment(entry, withStatus(status), at),
    undefined,
  )
}

beforeEach(() => {
  // Unanswered unless a test says otherwise, so nothing renders after it ends.
  vi.mocked(getMockSettings)
    .mockReset()
    .mockReturnValue(new Promise(() => {}))
  statusCommand.sent.mockReset()
  statusCommand.answer = () => Promise.resolve()
  vi.mocked(updateMockSettings)
    .mockReset()
    .mockReturnValue(new Promise(() => {}))
})

const button = (name: string) => screen.getByRole('button', { name })

async function renderOpen(
  reference: string | null = REFERENCE,
  entry = entryOf('awaiting_payment'),
) {
  const user = userEvent.setup()
  render(<DevPanel reference={reference} entry={entry} />)
  await user.click(button('DEV'))
  return user
}

test('starts collapsed', () => {
  render(<DevPanel reference={REFERENCE} entry={entryOf('awaiting_payment')} />)
  expect(button('DEV')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'underpaid' }),
  ).not.toBeInTheDocument()
})

test('sends no request while collapsed', () => {
  render(<DevPanel reference={REFERENCE} entry={entryOf('awaiting_payment')} />)
  expect(getMockSettings).not.toHaveBeenCalled()
})

test('opens to show the eight statuses', async () => {
  await renderOpen()
  for (const status of STATUSES) expect(button(status)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'DEV' })).not.toBeInTheDocument()
  expect(getMockSettings).toHaveBeenCalledTimes(1)
})

test('hide collapses it', async () => {
  const user = await renderOpen()
  await user.click(button('hide'))
  expect(button('DEV')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'underpaid' }),
  ).not.toBeInTheDocument()
})

test.each(STATUSES)('sets %s for the current payment', async (status) => {
  const user = await renderOpen()
  await user.click(button(status))
  expect(statusCommand.sent).toHaveBeenCalledExactlyOnceWith(REFERENCE, status)
})

// Vitest fails the run on an unhandled rejection, so this also proves the failure is handled.
test('a failed status command leaves the panel as it is', async () => {
  statusCommand.answer = () =>
    Promise.reject(
      new Error('POST /__mock/payments/AQH-100306-PMT/status answered 404'),
    )
  const user = await renderOpen()
  await user.click(button('paid'))
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  expect(statusCommand.sent).toHaveBeenCalledOnce()
  expect(button('awaiting_payment')).toHaveAttribute('aria-pressed', 'true')
  expect(button('paid')).toHaveAttribute('aria-pressed', 'false')
  expect(button('paid')).toBeEnabled()
})

test('marks the status the page is showing', async () => {
  await renderOpen(REFERENCE, entryOf('underpaid'))
  for (const status of STATUSES) {
    expect(button(status)).toHaveAttribute(
      'aria-pressed',
      String(status === 'underpaid'),
    )
  }
})

test('the stepper sets confirmations from the payment', async () => {
  const oneOfThree = makePayment(
    { status: 'confirming', ...STATE_FIXTURES.confirming, confirmations: 1 },
    { required_confirmations: 3 },
  )
  const user = await renderOpen(
    REFERENCE,
    mergePayment(undefined, oneOfThree, 0),
  )
  expect(screen.getByText('1 of 3')).toBeVisible()
  await user.click(button('+'))
  expect(statusCommand.sent).toHaveBeenLastCalledWith(
    REFERENCE,
    'confirming',
    2,
  )
  await user.click(button('−'))
  expect(statusCommand.sent).toHaveBeenLastCalledWith(
    REFERENCE,
    'confirming',
    0,
  )
})

test('the stepper counts from zero when the status carries no confirmations', async () => {
  const user = await renderOpen(REFERENCE, entryOf('underpaid'))
  expect(button('−')).toBeDisabled()
  await user.click(button('+'))
  expect(statusCommand.sent).toHaveBeenCalledExactlyOnceWith(
    REFERENCE,
    'confirming',
    1,
  )
})

test('the stepper does not go below zero', async () => {
  const user = await renderOpen(REFERENCE, entryOf('detected'))
  expect(screen.getByText('0 of 1')).toBeVisible()
  expect(button('−')).toBeDisabled()
  await user.click(button('−'))
  expect(statusCommand.sent).not.toHaveBeenCalled()
})

test.each<[string, Partial<MockSettings>]>([
  ['30 s', { quote_lifetime_seconds: 30 }],
  ['2 min', { quote_lifetime_seconds: 120 }],
  ['15 min', { quote_lifetime_seconds: 900 }],
  ['no delay', { delay_ms: 0 }],
  ['3 s', { delay_ms: 3_000 }],
  ['15 s', { delay_ms: 15_000 }],
  ['normal', { fault: 'none' }],
  ['HTTP 500', { fault: 'http_500' }],
  ['drop', { fault: 'drop' }],
  ['−5 min', { clock_offset_seconds: -300 }],
  ['0', { clock_offset_seconds: 0 }],
  ['+5 min', { clock_offset_seconds: 300 }],
])('the %s button updates the settings', async (label, patch) => {
  const user = await renderOpen()
  await user.click(button(label))
  expect(updateMockSettings).toHaveBeenCalledExactlyOnceWith(patch)
})

test('marks the settings the mock reports', async () => {
  vi.mocked(getMockSettings).mockResolvedValue({
    quote_lifetime_seconds: 30,
    delay_ms: 3_000,
    fault: 'drop',
    clock_offset_seconds: -300,
  })
  await renderOpen()
  const marked = ['30 s', '3 s', 'drop', '−5 min']
  await screen.findByRole('button', { name: 'drop', pressed: true })
  for (const label of [
    '30 s',
    '2 min',
    '15 min',
    'no delay',
    '3 s',
    '15 s',
    'normal',
    'HTTP 500',
    'drop',
    '−5 min',
    '0',
    '+5 min',
  ]) {
    expect(button(label)).toHaveAttribute(
      'aria-pressed',
      String(marked.includes(label)),
    )
  }
})

test('marks a setting once the mock answers a change', async () => {
  vi.mocked(getMockSettings).mockResolvedValue(SETTINGS)
  vi.mocked(updateMockSettings).mockResolvedValue({
    ...SETTINGS,
    fault: 'http_500',
  })
  const user = await renderOpen()
  await user.click(button('HTTP 500'))
  expect(button('HTTP 500')).toHaveAttribute('aria-pressed', 'true')
  expect(button('normal')).toHaveAttribute('aria-pressed', 'false')
})

test('shows the payment and the statuses the page has seen', async () => {
  await renderOpen(REFERENCE, entryOf('awaiting_payment', 'underpaid'))
  expect(screen.getByText(REFERENCE)).toBeVisible()
  expect(screen.getByText('seen: awaiting_payment → underpaid')).toBeVisible()
})

test('disables the status buttons when there is no payment', async () => {
  const user = await renderOpen(null, undefined)
  expect(screen.getByText('No payment yet.')).toBeVisible()
  for (const status of STATUSES) expect(button(status)).toBeDisabled()
  expect(button('−')).toBeDisabled()
  expect(button('+')).toBeDisabled()
  await user.click(button('+'))
  expect(statusCommand.sent).not.toHaveBeenCalled()
  // The settings do not belong to a payment.
  expect(button('drop')).toBeEnabled()
})

test('says how to test offline', async () => {
  await renderOpen()
  expect(
    screen.getByText("Offline: use the browser's own offline switch."),
  ).toBeVisible()
})
