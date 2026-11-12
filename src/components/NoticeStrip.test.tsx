import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Connection } from '../domain/screen'
import { connectionNotice } from './NoticeStrip'

function renderNotice(connection: Connection, onTryNow = vi.fn()) {
  const { container } = render(
    <div>{connectionNotice(connection, onTryNow)}</div>,
  )
  return { container, onTryNow }
}

test('says nothing when the connection is fine', () => {
  expect(connectionNotice('ok', vi.fn())).toBeNull()
})

test('offline', () => {
  const { container } = renderNotice('offline')
  expect(screen.getByText('You appear to be offline.')).toBeInTheDocument()
  expect(container).toHaveTextContent(
    "You appear to be offline. We'll pick up as soon as your connection returns.",
  )
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('unreachable offers Try now', async () => {
  const { container, onTryNow } = renderNotice('unreachable')
  expect(
    screen.getByText("We can't reach the payment service."),
  ).toBeInTheDocument()
  expect(container).toHaveTextContent(
    "We can't reach the payment service. This page may be out of date until we reconnect. Retrying.",
  )
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try now' }))
  expect(onTryNow).toHaveBeenCalledOnce()
})

test('never says the payment is safe or unaffected', () => {
  for (const connection of ['offline', 'unreachable'] as const) {
    const { container } = renderNotice(connection)
    expect(container.textContent).not.toBe('')
    expect(container.textContent).not.toMatch(/unaffected|safe|refund/i)
  }
})
