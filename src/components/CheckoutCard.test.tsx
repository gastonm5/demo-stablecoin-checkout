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

test('without a right column the card is one column, with no divider and no minimum height', () => {
  const { container } = render(<CheckoutCard left="Left" />)
  const card = container.firstElementChild
  expect(screen.getByText('Left').parentElement).toBe(card)
  // The divider is the second column's border, so one child means no divider.
  expect(card?.children).toHaveLength(1)
  expect(card?.outerHTML).not.toMatch(/min-h-/)
})

test('the card sets no width of its own, so the page can move it', () => {
  for (const right of [undefined, 'Right']) {
    const { container, unmount } = render(
      <CheckoutCard left="Left" right={right} />,
    )
    expect(container.firstElementChild?.className).not.toMatch(/max-w-|mx-auto/)
    unmount()
  }
})
