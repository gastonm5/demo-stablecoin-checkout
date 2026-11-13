import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { expect, test, vi } from 'vitest'
import { Button } from './Button'

test.each(['primary', 'secondary', 'link'] as const)(
  '%s renders a plain button, passing its props through',
  (variant) => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Button variant={variant} id="opener" ref={ref}>
        Go
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('id', 'opener')
    expect(ref.current).toBe(button)
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy')
  },
)

test('busy disables the button and says it is busy', () => {
  render(
    <Button variant="primary" busy>
      Working…
    </Button>,
  )
  const button = screen.getByRole('button', { name: 'Working…' })
  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')
})

test('a click reaches the handler, and not when disabled', async () => {
  const onClick = vi.fn()
  const { rerender } = render(
    <Button variant="secondary" onClick={onClick}>
      Go
    </Button>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
  rerender(
    <Button variant="secondary" onClick={onClick} disabled>
      Go
    </Button>,
  )
  await user.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalledOnce()
})
