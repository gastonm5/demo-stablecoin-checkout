import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { parseCurrencies } from '../api/schemas'
import { CURRENCIES_JSON } from '../test/fixtures'
import { Picker } from './Picker'

const currencies = parseCurrencies(CURRENCIES_JSON)

type Props = ComponentProps<typeof Picker>

afterEach(() => {
  vi.useRealTimers()
})

function renderPicker(overrides: Partial<Props> = {}) {
  const props: Props = {
    orderId: 'ORD-88213',
    currencies,
    mode: 'create',
    notice: null,
    submitting: false,
    error: null,
    onSubmit: vi.fn(),
    ...overrides,
  }
  const view = render(<Picker {...props} />)
  return {
    ...view,
    props,
    rerenderWith: (more: Partial<Props>) =>
      view.rerender(<Picker {...props} {...more} />),
  }
}

const currencyMenu = () => screen.getByRole('combobox', { name: 'Currency' })
const networkMenu = () => screen.getByRole('combobox', { name: 'Network' })
const networkOptions = () =>
  within(networkMenu())
    .getAllByRole('option')
    .map((option) => option.textContent)
// A closed select shows the text of its selected option.
const selectedNetwork = () =>
  within(networkMenu()).getByRole('option', { selected: true }).textContent

async function choose(currency: string, network?: string) {
  const user = userEvent.setup()
  await user.selectOptions(currencyMenu(), currency)
  if (network) await user.selectOptions(networkMenu(), network)
  return user
}

test('opens with nothing selected and the button disabled', () => {
  renderPicker()
  expect(
    screen.getByRole('heading', { name: 'Choose how to pay' }),
  ).toBeVisible()
  expect(currencyMenu()).toHaveValue('')
  expect(networkMenu()).toHaveValue('')
  expect(screen.getByRole('option', { name: 'Choose currency' })).toBeDisabled()
  expect(screen.getByRole('option', { name: 'Choose network' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.queryByText('You are paying with')).not.toBeInTheDocument()
  expect(
    screen.getByText('The amount to send and the address are shown next.'),
  ).toBeVisible()
})

test('the network menu is disabled until a currency is chosen', async () => {
  renderPicker()
  expect(networkMenu()).toBeDisabled()
  await choose('USDT')
  expect(networkMenu()).toBeEnabled()
})

test('names the choice on the button once both are chosen', async () => {
  renderPicker()
  expect(
    screen.getByRole('option', { name: 'USDT Tether' }),
  ).toBeInTheDocument()
  await choose('USDT')
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.queryByText(/^Fee/)).not.toBeInTheDocument()
  await choose('USDT', 'tron')
  expect(
    screen.getByRole('button', { name: 'Continue with USDT on Tron' }),
  ).toBeEnabled()
  expect(
    screen.getByText('Fee ≈ $1.00 · usually 1 min · 1 confirmation'),
  ).toBeVisible()
  expect(screen.getByText('You are paying with')).toBeVisible()
  expect(screen.getByText('USDT on Tron (TRC-20)')).toBeVisible()
  expect(
    screen.getByText(
      'Your wallet or exchange must be able to send USDT on the Tron network.',
    ),
  ).toBeVisible()
})

test('submits the choice', async () => {
  const { props } = renderPicker()
  const user = await choose('USDT', 'tron')
  await user.click(
    screen.getByRole('button', { name: 'Continue with USDT on Tron' }),
  )
  expect(props.onSubmit).toHaveBeenCalledOnce()
  expect(props.onSubmit).toHaveBeenCalledWith({
    currency: 'USDT',
    network: 'tron',
  })
})

test('changing the currency clears the network', async () => {
  renderPicker()
  await choose('USDT', 'ethereum')
  await choose('USDC')
  expect(currencyMenu()).toHaveValue('USDC')
  expect(networkMenu()).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.queryByText('You are paying with')).not.toBeInTheDocument()
})

test('a currency with one network has it filled in', async () => {
  renderPicker()
  await choose('ETH')
  expect(networkMenu()).toHaveValue('ethereum')
  expect(selectedNetwork()).toBe('Ethereum')
  expect(
    screen.getByRole('button', { name: 'Continue with ETH on Ethereum' }),
  ).toBeEnabled()
})

test('shows each network with its fee and usual time', async () => {
  renderPicker()
  await choose('USDT')
  expect(networkOptions()).toEqual([
    'Choose network',
    'Tron (TRC-20) · fee ≈ $1.00 · usually 1 min',
    'Ethereum (ERC-20) · fee ≈ $4.50 · usually 3 min',
  ])
})

test('the chosen network shows its name alone and the others keep their fee and time', async () => {
  renderPicker()
  const user = await choose('USDT', 'tron')
  expect(selectedNetwork()).toBe('Tron (TRC-20)')
  expect(networkOptions()).toEqual([
    'Choose network',
    'Tron (TRC-20)',
    'Ethereum (ERC-20) · fee ≈ $4.50 · usually 3 min',
  ])
  await user.selectOptions(networkMenu(), 'ethereum')
  expect(selectedNetwork()).toBe('Ethereum (ERC-20)')
  expect(networkOptions()).toEqual([
    'Choose network',
    'Tron (TRC-20) · fee ≈ $1.00 · usually 1 min',
    'Ethereum (ERC-20)',
  ])
})

test('requote mode changes the button and offers Back', async () => {
  const onCancel = vi.fn()
  renderPicker({ mode: 'requote', onCancel })
  const user = await choose('USDT', 'tron')
  expect(
    screen.getByRole('button', { name: 'Get a new quote with USDT on Tron' }),
  ).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(onCancel).toHaveBeenCalledOnce()
})

test('offers Back only in requote mode', () => {
  renderPicker({ mode: 'create', onCancel: vi.fn() })
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
})

test('disables everything while submitting', async () => {
  const { rerenderWith } = renderPicker({ mode: 'requote', onCancel: vi.fn() })
  await choose('USDT', 'tron')
  rerenderWith({ submitting: true })
  expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
  expect(currencyMenu()).toBeDisabled()
  expect(networkMenu()).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
})

test('says it is still working after four seconds', () => {
  vi.useFakeTimers()
  renderPicker({ submitting: true })
  act(() => vi.advanceTimersByTime(3_900))
  expect(screen.queryByText('Still working…')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(100))
  expect(screen.getByText('Still working…')).toBeVisible()
})

test('shows an error and keeps the choices', async () => {
  const { rerenderWith } = renderPicker()
  await choose('USDT', 'tron')
  rerenderWith({ submitting: true })
  rerenderWith({ submitting: false, error: new Error('timeout') })
  expect(screen.getByRole('alert')).toHaveTextContent(
    "We couldn't reach the payment service. Try again.",
  )
  expect(currencyMenu()).toHaveValue('USDT')
  expect(networkMenu()).toHaveValue('tron')
  expect(
    screen.getByRole('button', { name: 'Continue with USDT on Tron' }),
  ).toBeEnabled()
})

test('shows no error without one', () => {
  renderPicker()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('shows the not-found notice', () => {
  const { rerenderWith } = renderPicker()
  const notice =
    "We couldn't find that payment. Choose how to pay to start again."
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  rerenderWith({ notice: 'payment_not_found' })
  expect(screen.getByText(notice)).toBeVisible()
  expect(
    screen
      .getByText(notice)
      .compareDocumentPosition(screen.getByRole('heading')),
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})

test('shows the order reference and no fiat amount', async () => {
  renderPicker()
  expect(screen.getByText('ORD-88213')).toBeVisible()
  expect(screen.getByText('Order')).toBeVisible()
  await choose('USDT', 'tron')
  // The order's amount and merchant come only with a payment, so none of them may appear here.
  for (const fiat of ['149.90', 'EUR', '€', '$149']) {
    expect(document.body).not.toHaveTextContent(fiat)
  }
  expect(screen.queryByText(/payment for/i)).not.toBeInTheDocument()
  expect(document.body).not.toHaveTextContent('Nordwind')
})
