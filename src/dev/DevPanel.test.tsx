import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { mergePayment } from '../hooks/paymentCache'
import type { PaymentEntry } from '../hooks/paymentCache'
import { makePayment, STATE_FIXTURES } from '../test/fixtures'
import { DevPanel } from './DevPanel'
import { getMockSettings, updateMockSettings } from './mockControl'
import type { MockSettings } from './mockControl'
import { openPicker, reloadPage } from './navigation'

const statusCommand = vi.hoisted(() => ({
  sent: vi.fn(),
  answer: (): Promise<void> => Promise.resolve(),
}))
const restartCommand = vi.hoisted(() => ({
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
  restartMockPayment: (...args: unknown[]) => {
    restartCommand.sent(...args)
    return restartCommand.answer()
  },
  updateMockSettings: vi.fn(),
}))

vi.mock('./navigation', () => ({ reloadPage: vi.fn(), openPicker: vi.fn() }))

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
  restartCommand.sent.mockReset()
  restartCommand.answer = () => Promise.resolve()
  vi.mocked(updateMockSettings)
    .mockReset()
    .mockReturnValue(new Promise(() => {}))
  vi.mocked(reloadPage).mockReset()
  vi.mocked(openPicker).mockReset()
  // The panel remembers being open here, and it outlives a test.
  sessionStorage.clear()
})

const renderPanel = () =>
  render(<DevPanel reference={REFERENCE} entry={entryOf('awaiting_payment')} />)

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

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

// Guards a layout fact jsdom cannot measure: under the tab's vertical writing mode inset-y sets left and right, so the tab fell below the window.
test('the tab is pinned top and bottom with physical offsets', () => {
  renderPanel()
  expect(button('DEV')).toHaveClass('top-0', 'bottom-0')
  expect(button('DEV')).not.toHaveClass('inset-y-0')
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

test('restart this payment sends the reference, then reloads once the mock answers', async () => {
  let reply = () => {}
  restartCommand.answer = () =>
    new Promise<void>((resolve) => {
      reply = () => resolve()
    })
  const user = await renderOpen(REFERENCE, entryOf('awaiting_payment', 'paid'))
  await user.click(button('restart this payment'))
  expect(restartCommand.sent).toHaveBeenCalledExactlyOnceWith(REFERENCE)
  await settle()
  expect(reloadPage).not.toHaveBeenCalled()
  reply()
  await settle()
  expect(reloadPage).toHaveBeenCalledOnce()
})

// Vitest fails the run on an unhandled rejection, so this also proves the failure is handled.
test('a failed restart does not reload', async () => {
  restartCommand.answer = () =>
    Promise.reject(
      new Error('POST /__mock/payments/AQH-100306-PMT/restart answered 404'),
    )
  const user = await renderOpen()
  await user.click(button('restart this payment'))
  await settle()
  expect(restartCommand.sent).toHaveBeenCalledOnce()
  expect(reloadPage).not.toHaveBeenCalled()
})

test('new payment goes back to the picker and sends nothing to the mock', async () => {
  const user = await renderOpen()
  await user.click(button('new payment'))
  expect(openPicker).toHaveBeenCalledOnce()
  expect(restartCommand.sent).not.toHaveBeenCalled()
  expect(statusCommand.sent).not.toHaveBeenCalled()
  expect(updateMockSettings).not.toHaveBeenCalled()
})

test('disables Start over when there is no payment', async () => {
  const user = await renderOpen(null, undefined)
  for (const name of ['restart this payment', 'new payment']) {
    expect(button(name)).toBeDisabled()
    await user.click(button(name))
  }
  expect(restartCommand.sent).not.toHaveBeenCalled()
  expect(reloadPage).not.toHaveBeenCalled()
  expect(openPicker).not.toHaveBeenCalled()
})

test('Start over sits directly under the current payment, above Set status', async () => {
  await renderOpen()
  const headings = screen
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent)
  expect(headings.slice(0, 3)).toEqual([
    'Current payment',
    'Start over',
    'Set status',
  ])
})

test('a panel left open is open again after a remount, and takes no focus', async () => {
  await renderOpen()
  cleanup()
  renderPanel()
  expect(button('hide')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'DEV' })).not.toBeInTheDocument()
  expect(document.body).toHaveFocus()
})

test('a panel that was closed is collapsed after a remount', async () => {
  const user = await renderOpen()
  await user.click(button('hide'))
  cleanup()
  renderPanel()
  expect(button('DEV')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'underpaid' }),
  ).not.toBeInTheDocument()
})

test('a browser that refuses storage gets a panel that starts collapsed and still opens', async () => {
  const refuse = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse)
  await renderOpen()
  expect(button('hide')).toBeVisible()
})

test('takes no focus when the page loads collapsed', () => {
  renderPanel()
  expect(document.body).toHaveFocus()
})

test('focus moves to hide on opening and back to the tab on closing', async () => {
  const user = await renderOpen()
  expect(button('hide')).toHaveFocus()
  await user.click(button('hide'))
  expect(button('DEV')).toHaveFocus()
})

test('whichever part is not showing is inert', async () => {
  const user = userEvent.setup()
  renderPanel()
  const panel = screen.getByRole('complementary', { hidden: true })
  const tab = screen.getByRole('button', { name: 'DEV', hidden: true })
  expect(panel).toHaveAttribute('inert')
  expect(tab).not.toHaveAttribute('inert')
  await user.click(tab)
  expect(panel).not.toHaveAttribute('inert')
  expect(tab).toHaveAttribute('inert')
})

test('says how to test offline', async () => {
  await renderOpen()
  expect(
    screen.getByText("Offline: use the browser's own offline switch."),
  ).toBeVisible()
})
