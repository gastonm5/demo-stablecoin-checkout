import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { CopyButton } from './CopyButton'

const FAILED = 'Copy failed. Select the text and copy it.'

// fireEvent, not userEvent: Testing Library's async wrapper waits on a real timer, so userEvent hangs under Vitest's fake timers.
const writeText = vi.fn<(value: string) => Promise<void>>()

function setClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
  })
}

afterEach(() => {
  vi.useRealTimers()
  writeText.mockReset()
  setClipboard(undefined)
})

async function clickCopy() {
  render(<CopyButton value="163.69" label="Copy amount" />)
  const button = screen.getByRole('button', { name: 'Copy amount' })
  await act(async () => fireEvent.click(button))
}

test('says Copied, then goes back to its label', async () => {
  vi.useFakeTimers()
  setClipboard({ writeText: writeText.mockResolvedValue(undefined) })
  await clickCopy()
  expect(writeText).toHaveBeenCalledExactlyOnceWith('163.69')
  expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  expect(screen.getByText('Copied')).toHaveAttribute('aria-live', 'polite')
  act(() => vi.advanceTimersByTime(2_000))
  expect(screen.getByRole('button', { name: 'Copy amount' })).toBeVisible()
  expect(screen.queryByText('Copied')).not.toBeInTheDocument()
})

test('says copying failed when the clipboard rejects', async () => {
  setClipboard({
    writeText: writeText.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError'),
    ),
  })
  await clickCopy()
  expect(screen.getByText(FAILED)).toHaveAttribute('aria-live', 'polite')
})

test('says copying failed when there is no clipboard', async () => {
  setClipboard(undefined)
  await clickCopy()
  expect(screen.getByText(FAILED)).toHaveAttribute('aria-live', 'polite')
})
