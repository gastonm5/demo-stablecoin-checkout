import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { parseCurrencies } from '../api/schemas'
import { networkColours } from '../components/networkColours'
import { ASSUMED_ORDER } from '../config/checkout'
import { CURRENCIES_JSON } from '../test/fixtures'
import { PickerScreen } from './PickerScreen'

const currencies = parseCurrencies(CURRENCIES_JSON)

type Props = ComponentProps<typeof PickerScreen>
type Section = 'Currency' | 'Network'

afterEach(() => {
  vi.useRealTimers()
})

function renderPicker(overrides: Partial<Props> = {}) {
  const props: Props = {
    order: ASSUMED_ORDER,
    currencies,
    mode: 'create',
    notice: null,
    submitting: false,
    error: null,
    onSubmit: vi.fn(),
    ...overrides,
  }
  const view = render(<PickerScreen {...props} />)
  return {
    ...view,
    props,
    rerenderWith: (more: Partial<Props>) =>
      view.rerender(<PickerScreen {...props} {...more} />),
  }
}

const group = (section: Section) => screen.getByRole('group', { name: section })

// Found by role, so a radio in a closed form is not found; told apart by value, as the browser checks do.
function radio(section: Section, value: string) {
  const found = within(group(section))
    .getAllByRole<HTMLInputElement>('radio')
    .find((r) => r.value === value)
  if (!found) throw new Error(`No ${value} radio is showing in ${section}`)
  return found
}

const changeButton = (section: Section) =>
  screen.getByRole('button', { name: `Change ${section.toLowerCase()}` })

// Which form of each section is showing to the shopper.
function forms() {
  return (['Currency', 'Network'] as const).map((section) => {
    const fieldset = screen.queryByRole('group', { name: section })
    if (!fieldset) return 'none'
    const open = within(fieldset).queryAllByRole('radio').length > 0
    const closed =
      within(fieldset).queryByRole('button', {
        name: `Change ${section.toLowerCase()}`,
      }) !== null
    return open === closed ? 'both or neither' : open ? 'open' : 'closed'
  })
}

// getByText also finds the copy in a hidden form, so this skips those.
const HIDDEN = '[aria-hidden="true"] *, script, style'
const shownText = (text: string, section?: Section) =>
  (section ? within(group(section)) : screen).queryByText(text, {
    ignore: HIDDEN,
  })
const feeLine = () => screen.queryByText(/ · \d+ confirmations?$/)

async function choose(currency: string, network?: string) {
  const user = userEvent.setup()
  await user.click(radio('Currency', currency))
  if (network) await user.click(radio('Network', network))
  return user
}

test('opens with nothing chosen, nothing focused and the button disabled', () => {
  renderPicker()
  expect(
    screen.getByRole('heading', { name: 'Choose how to pay' }),
  ).toBeVisible()
  expect(forms()).toEqual(['open', 'none'])
  expect(
    screen.queryAllByRole('radio', { hidden: true, checked: true }),
  ).toEqual([])
  expect(document.body).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(screen.queryByText('You are paying with')).not.toBeInTheDocument()
  expect(
    screen.queryByText('The amount to send and the address are shown next.'),
  ).not.toBeInTheDocument()
})

test('the network section is not shown until a currency is chosen', async () => {
  renderPicker()
  expect(
    screen.queryByRole('group', { name: 'Network' }),
  ).not.toBeInTheDocument()
  await choose('USDT')
  for (const network of within(group('Network')).getAllByRole('radio')) {
    expect(network).toBeEnabled()
  }
})

test('names the choice on the button once both are chosen', async () => {
  renderPicker()
  expect(screen.getByRole('radio', { name: 'USDT Tether' })).toBeInTheDocument()
  const user = await choose('USDT')
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(feeLine()).not.toBeInTheDocument()
  await user.click(radio('Network', 'tron'))
  expect(
    screen.getByRole('button', { name: 'Continue with USDT on Tron' }),
  ).toBeEnabled()
  expect(
    screen.getByText('Fee ≈ $1.00 · usually 1 min · 1 confirmation'),
  ).toBeVisible()
  expect(shownText('Tron (TRC-20)')).toBeVisible()
  expect(screen.queryByText('You are paying with')).not.toBeInTheDocument()
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

test('opens and closes each section with the choice and with Change', async () => {
  renderPicker()
  const user = userEvent.setup()
  expect(forms()).toEqual(['open', 'none'])
  await user.click(radio('Currency', 'USDT'))
  expect(forms()).toEqual(['closed', 'open'])
  await user.click(radio('Network', 'tron'))
  expect(forms()).toEqual(['closed', 'closed'])

  await user.click(changeButton('Currency'))
  expect(forms()).toEqual(['open', 'closed'])
  // A radio fires no change for the one already chosen; choosing it again still closes the section.
  await user.click(radio('Currency', 'USDT'))
  expect(forms()).toEqual(['closed', 'closed'])
  expect(
    screen.getByRole('button', { name: 'Continue with USDT on Tron' }),
  ).toBeEnabled()

  await user.click(changeButton('Network'))
  expect(forms()).toEqual(['closed', 'open'])
  await user.click(radio('Network', 'tron'))
  expect(forms()).toEqual(['closed', 'closed'])
})

test('a reopened currency section stays open until a currency is chosen', async () => {
  renderPicker()
  const user = await choose('USDT')
  await user.click(changeButton('Currency'))
  expect(forms()).toEqual(['open', 'open'])
  await user.click(radio('Network', 'tron'))
  expect(forms()).toEqual(['open', 'closed'])
  await user.click(radio('Currency', 'USDT'))
  expect(forms()).toEqual(['closed', 'closed'])
})

test('changing the currency clears the network and reopens its section', async () => {
  renderPicker()
  const user = await choose('USDT', 'ethereum')
  await user.click(changeButton('Currency'))
  await user.click(radio('Currency', 'USDC'))
  expect(
    screen.getByRole('radio', { name: 'USDC USD Coin', hidden: true }),
  ).toBeChecked()
  expect(forms()).toEqual(['closed', 'open'])
  expect(
    within(group('Network')).queryAllByRole('radio', { checked: true }),
  ).toEqual([])
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(feeLine()).not.toBeInTheDocument()
  expect(screen.queryByText('You are paying with')).not.toBeInTheDocument()
})

test('a currency with one network has it filled in, its section closed', async () => {
  renderPicker()
  await choose('ETH')
  expect(forms()).toEqual(['closed', 'closed'])
  expect(
    screen.getByRole('radio', { name: /^Ethereum Fee/, hidden: true }),
  ).toBeChecked()
  expect(shownText('Ethereum', 'Network')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Continue with ETH on Ethereum' }),
  ).toBeEnabled()
})

test('a form that is not showing is inert and cannot be found by role', async () => {
  renderPicker()
  const network = screen.getByRole('group', { name: 'Network', hidden: true })
  expect(network.closest('[inert]')).toHaveAttribute('aria-hidden', 'true')

  const user = await choose('USDT')
  expect(within(group('Currency')).queryAllByRole('radio')).toEqual([])
  const closedOption = screen.getByRole('radio', {
    name: 'USDT Tether',
    hidden: true,
  })
  expect(closedOption.closest('[inert]')).toHaveAttribute('aria-hidden', 'true')
  // With no network chosen there is no closed row to change.
  expect(
    screen.queryByRole('button', { name: 'Change network', hidden: true }),
  ).not.toBeInTheDocument()

  await user.click(radio('Network', 'tron'))
  expect(within(group('Network')).queryAllByRole('radio')).toEqual([])
  const closedNetwork = screen.getByRole('radio', {
    name: /^Tron/,
    hidden: true,
  })
  expect(closedNetwork.closest('[inert]')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await user.click(changeButton('Network'))
  const closedRow = screen.getByRole('button', {
    name: 'Change network',
    hidden: true,
  })
  expect(closedRow.closest('[inert]')).toHaveAttribute('aria-hidden', 'true')
})

test('each open network option shows its own fee and usual time', async () => {
  renderPicker()
  await choose('USDT')
  const networks = within(group('Network')).getAllByRole('radio')
  expect(networks).toHaveLength(2)
  expect(networks[0]).toHaveAccessibleName(
    'Tron (TRC-20) Fee ≈ $1.00 · usually 1 min',
  )
  expect(networks[1]).toHaveAccessibleName(
    'Ethereum (ERC-20) Fee ≈ $4.50 · usually 3 min',
  )
})

test('the chosen network shows its name alone, and Change brings back every fee and time', async () => {
  renderPicker()
  const user = await choose('USDT', 'tron')
  expect(shownText('Tron (TRC-20)')).toBeVisible()
  expect(shownText('Fee ≈ $1.00 · usually 1 min')).not.toBeInTheDocument()
  expect(shownText('Fee ≈ $4.50 · usually 3 min')).not.toBeInTheDocument()
  await user.click(changeButton('Network'))
  expect(shownText('Fee ≈ $1.00 · usually 1 min')).toBeVisible()
  expect(shownText('Fee ≈ $4.50 · usually 3 min')).toBeVisible()
  await user.click(radio('Network', 'ethereum'))
  expect(shownText('Ethereum (ERC-20)')).toBeVisible()
  expect(shownText('Fee ≈ $1.00 · usually 1 min')).not.toBeInTheDocument()
})

test('the fee line shows only while the network section is closed on a network', async () => {
  renderPicker()
  const user = await choose('USDC')
  expect(feeLine()).not.toBeInTheDocument()
  await user.click(radio('Network', 'polygon'))
  expect(
    screen.getByText('Fee ≈ $0.10 · usually 30 s · 6 confirmations'),
  ).toBeVisible()
  await user.click(changeButton('Network'))
  expect(feeLine()).not.toBeInTheDocument()
  expect(radio('Network', 'solana')).toHaveAccessibleName(
    'Solana Fee ≈ $0.01 · usually 15 s',
  )
  await user.click(radio('Network', 'solana'))
  expect(
    screen.getByText('Fee ≈ $0.01 · usually 15 s · 1 confirmation'),
  ).toBeVisible()
})

test('the wallet sentence appears once both are chosen and names them', async () => {
  renderPicker()
  const user = await choose('USDC')
  expect(screen.queryByText(/^Your wallet or exchange/)).not.toBeInTheDocument()
  await user.click(radio('Network', 'polygon'))
  expect(
    screen.getByText(
      'Your wallet or exchange must be able to send USDC on the Polygon network.',
    ),
  ).toBeVisible()
})

test("the button takes the chosen chain's fill once both are chosen", async () => {
  renderPicker()
  const button = () => screen.getByRole('button', { name: /^Continue/ })
  const tron = networkColours('tron')
  const solana = networkColours('solana')
  expect(button()).not.toHaveClass(tron.fill)
  const user = await choose('USDT', 'tron')
  expect(button()).toHaveClass(tron.fill, tron.onFill)
  await user.click(changeButton('Currency'))
  await user.click(radio('Currency', 'USDC'))
  expect(button()).toHaveAccessibleName('Continue')
  expect(button()).not.toHaveClass(tron.fill)
  await user.click(radio('Network', 'solana'))
  expect(button()).toHaveAccessibleName('Continue with USDC on Solana')
  expect(button()).toHaveClass(solana.fill, solana.onFill)
})

test('focus follows each choice and each Change', async () => {
  renderPicker()
  const user = await choose('USDT')
  expect(radio('Network', 'tron')).toHaveFocus()
  await user.click(radio('Network', 'ethereum'))
  expect(
    screen.getByRole('button', { name: 'Continue with USDT on Ethereum' }),
  ).toHaveFocus()
  await user.click(changeButton('Currency'))
  expect(radio('Currency', 'USDT')).toHaveFocus()
  await user.click(radio('Currency', 'ETH'))
  expect(
    screen.getByRole('button', { name: 'Continue with ETH on Ethereum' }),
  ).toHaveFocus()
  await user.click(changeButton('Network'))
  expect(radio('Network', 'ethereum')).toHaveFocus()
})

test('a currency with no networks sends focus to its Change button', async () => {
  const noNetworks = parseCurrencies({
    currencies: [{ code: 'DAI', name: 'Dai', decimals: 18, networks: [] }],
  })
  renderPicker({ currencies: [...currencies, ...noNetworks] })
  await choose('DAI')
  expect(changeButton('Currency')).toHaveFocus()
  expect(document.activeElement?.closest('[inert]')).toBeNull()
})

test('the keyboard reaches every option: Space for the first, arrows for the rest', async () => {
  renderPicker()
  const user = userEvent.setup()
  await user.tab()
  expect(radio('Currency', 'USDT')).toHaveFocus()
  await user.keyboard(' ')
  expect(radio('Network', 'tron')).toHaveFocus()
  await user.keyboard('{ArrowDown}')
  expect(
    screen.getByRole('button', { name: 'Continue with USDT on Ethereum' }),
  ).toHaveFocus()

  await user.click(changeButton('Network'))
  await user.keyboard('{ArrowUp}')
  expect(
    screen.getByRole('button', { name: 'Continue with USDT on Tron' }),
  ).toHaveFocus()

  await user.click(changeButton('Currency'))
  await user.keyboard(' ')
  expect(forms()).toEqual(['closed', 'closed'])
  expect(
    screen.getByRole('button', { name: 'Continue with USDT on Tron' }),
  ).toHaveFocus()
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
  expect(changeButton('Currency')).toBeDisabled()
  expect(changeButton('Network')).toBeDisabled()
  for (const option of screen.getAllByRole('radio', { hidden: true })) {
    expect(option).toBeDisabled()
  }
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
  expect(
    screen.getByRole('radio', { name: 'USDT Tether', hidden: true }),
  ).toBeChecked()
  expect(
    screen.getByRole('radio', { name: /^Tron \(TRC-20\)/, hidden: true }),
  ).toBeChecked()
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

test('shows the order summary it is given', () => {
  renderPicker({ order: { ...ASSUMED_ORDER, order_id: 'ORD-1' } })
  expect(screen.getByText('Nordwind Audio')).toBeVisible()
  expect(screen.getByText('Order ORD-1')).toBeVisible()
  expect(screen.getByText('€149.90')).toBeVisible()
})
