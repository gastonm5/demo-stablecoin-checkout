import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useFocusOnChange } from './useFocusOnChange'

function Headline({ name }: { name: string }) {
  const ref = useFocusOnChange<HTMLHeadingElement>(name)
  // Keyed, so a new name is a new element, as a new screen is.
  return (
    <h1 key={name} ref={ref} tabIndex={-1}>
      {name}
    </h1>
  )
}

test('does not take focus on first mount', () => {
  render(<Headline name="waiting" />)
  expect(document.body).toHaveFocus()
})

test('focuses the element when the key changes', () => {
  const view = render(<Headline name="waiting" />)
  view.rerender(<Headline name="complete" />)
  expect(screen.getByRole('heading', { name: 'complete' })).toHaveFocus()
  // The same key again is not a change.
  screen.getByRole('heading').blur()
  view.rerender(<Headline name="complete" />)
  expect(document.body).toHaveFocus()
})
