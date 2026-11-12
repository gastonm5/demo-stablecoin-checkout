import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from './api/client'
import { getCurrencies } from './api/endpoints'
import { parseCurrencies } from './api/schemas'
import App from './App'
import { CURRENCIES_JSON } from './test/fixtures'

vi.mock('./api/endpoints', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/endpoints')>()),
  getCurrencies: vi.fn(),
}))

const currencies = parseCurrencies(CURRENCIES_JSON)

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.mocked(getCurrencies).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
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
