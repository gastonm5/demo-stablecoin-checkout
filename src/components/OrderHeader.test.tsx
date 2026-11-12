import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ASSUMED_ORDER } from '../hooks/url'
import { OrderHeader } from './OrderHeader'

const LOGO = 'https://cdn.example/nordwind.png'

test('shows the merchant, the order and its amount, with the letter for a logo', () => {
  const { container } = render(<OrderHeader order={ASSUMED_ORDER} />)
  expect(screen.getByText('Nordwind Audio')).toBeInTheDocument()
  expect(screen.getByText('Order ORD-88213')).toBeInTheDocument()
  expect(screen.getByText('€149.90')).toBeInTheDocument()
  expect(screen.getByText('N')).toBeInTheDocument()
  expect(container.querySelector('img')).toBeNull()
})

test('shows the logo, and the letter once it fails to load', () => {
  const order = {
    ...ASSUMED_ORDER,
    merchant: { ...ASSUMED_ORDER.merchant, logo_url: LOGO },
  }
  const { container, rerender } = render(<OrderHeader order={order} />)
  const img = container.querySelector('img')
  expect(img).toHaveAttribute('src', LOGO)
  expect(img).toHaveAttribute('alt', '')
  expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(screen.queryByText('N')).not.toBeInTheDocument()

  fireEvent.error(img!)
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByText('N')).toBeInTheDocument()

  // A different logo is tried afresh.
  const other = 'https://cdn.example/nordwind-2.png'
  rerender(
    <OrderHeader
      order={{ ...order, merchant: { ...order.merchant, logo_url: other } }}
    />,
  )
  expect(container.querySelector('img')).toHaveAttribute('src', other)
})
