import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import type { Connection } from '../domain/screen'
import { connectionNotice, STRIP_TEXT } from './NoticeStrip'

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

// Only an element that mounts plays its entrance, so a notice must not reuse the strip text's element, and a changed notice must reuse its own.
test.each([
  ['alone in the strip', (slot: ReactNode) => <div>{slot}</div>],
  [
    'before a link',
    (slot: ReactNode) => (
      <div>
        {slot}
        <a href="#back">Back</a>
      </div>
    ),
  ],
])(
  'a notice %s gets new elements, and keeps them when it changes',
  (_, strip) => {
    const shown = (connection: Connection) =>
      strip(
        connectionNotice(connection, vi.fn()) ?? (
          <span className={STRIP_TEXT}>This page updates by itself.</span>
        ),
      )
    const { rerender } = render(shown('ok'))
    const text = screen.getByText('This page updates by itself.')
    rerender(shown('offline'))
    expect(text).not.toBeInTheDocument()
    const notice = screen.getByText('You appear to be offline.').parentElement
    rerender(shown('unreachable'))
    expect(
      screen.getByText("We can't reach the payment service.").parentElement,
    ).toBe(notice)
  },
)

test('never says the payment is safe or unaffected', () => {
  for (const connection of ['offline', 'unreachable'] as const) {
    const { container } = renderNotice(connection)
    expect(container.textContent).not.toBe('')
    expect(container.textContent).not.toMatch(/unaffected|safe|refund/i)
  }
})
