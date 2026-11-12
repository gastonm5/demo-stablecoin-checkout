import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from './api/client'
import { createPayment, getCurrencies, getPayment } from './api/endpoints'
import { parseCurrencies } from './api/schemas'
import App from './App'
import { getMockSettings } from './dev/mockControl'
import { CURRENCIES_JSON, makePayment } from './test/fixtures'

vi.mock('./api/endpoints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/endpoints')>()),
  createPayment: vi.fn(),
  getCurrencies: vi.fn(),
  getPayment: vi.fn(),
}))

vi.mock('./dev/mockControl', () => ({
  getMockSettings: vi.fn(),
  setMockStatus: vi.fn(),
  updateMockSettings: vi.fn(),
}))

const currencies = parseCurrencies(CURRENCIES_JSON)

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.mocked(createPayment).mockReset()
  vi.mocked(getCurrencies).mockReset()
  vi.mocked(getPayment).mockReset()
  vi.mocked(getMockSettings)
    .mockReset()
    .mockReturnValue(new Promise(() => {}))
})

test('mounts the dev panel collapsed, outside the main landmark, without reading the mock', async () => {
  vi.mocked(getCurrencies).mockResolvedValue(currencies)
  render(<App />)
  const tab = screen.getByRole('button', { name: 'DEV' })
  expect(screen.getByRole('main')).not.toContainElement(tab)
  await screen.findByRole('heading', { name: 'Choose how to pay' })
  expect(getMockSettings).not.toHaveBeenCalled()
})

test('gives the dev panel the payment the page is showing', async () => {
  window.history.replaceState(null, '', '/?payment=AQH-100306-PMT')
  vi.mocked(getCurrencies).mockResolvedValue(currencies)
  vi.mocked(getPayment).mockResolvedValue(makePayment())
  render(<App />)
  await screen.findByText('Send exactly')
  fireEvent.click(screen.getByRole('button', { name: 'DEV' }))
  const panel = screen.getByRole('complementary', { name: 'Mock controls' })
  expect(panel).toHaveTextContent('referenceAQH-100306-PMT')
  expect(panel).toHaveTextContent('seen: awaiting_payment')
  expect(
    screen.getByRole('button', { name: 'awaiting_payment' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

afterEach(() => {
  vi.useRealTimers()
})

// The fixture's deadline is long past on this device, as with a server clock behind it.
test('a payment created past its deadline sends no check to the query it replaces', async () => {
  const error = vi.spyOn(console, 'error')
  vi.mocked(getCurrencies).mockResolvedValue(currencies)
  vi.mocked(createPayment).mockResolvedValue(makePayment())
  vi.mocked(getPayment).mockResolvedValue(makePayment())
  render(<App />)
  const user = userEvent.setup()
  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'Currency' }),
    'USDT',
  )
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Network' }),
    'tron',
  )
  await user.click(
    screen.getByRole('button', { name: 'Continue with USDT on Tron' }),
  )
  expect(await screen.findByText(/This quote is still valid/)).toBeVisible()
  expect(error).not.toHaveBeenCalled()
})

test('opens on the picker', async () => {
  vi.mocked(getCurrencies).mockResolvedValue(currencies)
  render(<App />)
  const main = screen.getByRole('main')
  expect(main).toHaveTextContent('Loading payment options…')
  expect(
    await screen.findByRole('heading', { name: 'Choose how to pay' }),
  ).toBeInTheDocument()
  expect(main).toContainElement(screen.getByRole('heading'))
  expect(screen.queryByText('Loading payment options…')).not.toBeInTheDocument()
})

test('offers Try again when the options cannot be loaded', async () => {
  vi.useFakeTimers()
  vi.mocked(getCurrencies).mockRejectedValue(
    new ApiError('http', 'GET answered 500', { status: 500 }),
  )
  render(<App />)
  // The catalogue retries twice before it gives up.
  await act(() => vi.advanceTimersByTimeAsync(5_000))
  expect(getCurrencies).toHaveBeenCalledTimes(3)
  expect(
    screen.getByText("We couldn't load the payment options."),
  ).toBeInTheDocument()
  vi.mocked(getCurrencies).mockResolvedValue(currencies)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(
    screen.getByRole('heading', { name: 'Choose how to pay' }),
  ).toBeInTheDocument()
})
