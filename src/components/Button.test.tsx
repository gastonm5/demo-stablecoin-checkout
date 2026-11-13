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

test('a primary button given colours takes that fill, and keeps the disabled look', () => {
  const colours = { fill: 'bg-network-solana', onFill: 'text-ink' }
  const { rerender } = render(
    <Button variant="primary" colours={colours}>
      Go
    </Button>,
  )
  const button = screen.getByRole('button', { name: 'Go' })
  expect(button).toHaveClass(
    'bg-network-solana',
    'text-ink',
    'hover:brightness-95',
    'active:brightness-90',
    'disabled:bg-action-disabled',
    'disabled:text-ink-muted',
    'disabled:brightness-100',
  )
  expect(button).not.toHaveClass('bg-action')
  expect(button).not.toHaveClass('text-ink-inverse')
  rerender(
    <Button variant="secondary" colours={colours}>
      Go
    </Button>,
  )
  expect(button).not.toHaveClass('bg-network-solana')
})
