import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ASSUMED_ORDER } from '../hooks/url'
import { OrderHeader } from './OrderHeader'

test('shows the merchant, the order and its amount, with the letter for a logo', () => {
  const { container } = render(<OrderHeader order={ASSUMED_ORDER} />)
  expect(screen.getByText('Nordwind Audio')).toBeInTheDocument()
  expect(screen.getByText('Order ORD-88213')).toBeInTheDocument()
  expect(screen.getByText('€149.90')).toBeInTheDocument()
  expect(screen.getByText('N')).toBeInTheDocument()
  expect(container.querySelector('img')).toBeNull()
})
