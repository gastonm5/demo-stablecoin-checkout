import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CheckoutCard } from './CheckoutCard'

// jsdom has no layout, so this can only check the class that sets the height, not the height itself.
test('the two columns are at least 460 px tall from md up, with no minimum below it', () => {
  render(<CheckoutCard left="Left" right="Right" />)
  const grid = screen.getByText('Left').parentElement
  expect(grid).toHaveClass('md:min-h-[460px]')
  expect(grid?.className).not.toMatch(/(^|\s)min-h-/)
})
