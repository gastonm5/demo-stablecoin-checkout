import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
  const { container } = render(
    <CopyButton value="163.69" label="Copy amount" />,
  )
  // Taken before the click, to show the sentence lands in a region that was already there.
  const regions = [...container.querySelectorAll('[aria-live="polite"]')]
  const button = screen.getByRole('button', { name: 'Copy amount' })
  await act(async () => fireEvent.click(button))
  return { button, regions }
}

// The sentence is on a line under the button, which keeps its label.
function expectFailedUnder({ button, regions }: Clicked) {
  // The sentence mounts inside the region, so it can fade in while the region stays put.
  const sentence = screen.getByText(FAILED)
  const region = sentence.closest('[aria-live]')
  expect(region).toHaveAttribute('aria-live', 'polite')
  expect(regions).toContain(region)
  expect(button).not.toContainElement(sentence)
  expect(button).toHaveAccessibleName('Copy amount')
}

type Clicked = Awaited<ReturnType<typeof clickCopy>>

// The text people see and hear: the twin that holds the button's space is left out.
const seen = { ignore: '[aria-hidden="true"], [aria-hidden="true"] *' }

test('says Copied, then goes back to its label', async () => {
  vi.useFakeTimers()
  setClipboard({ writeText: writeText.mockResolvedValue(undefined) })
  const { button } = await clickCopy()
  expect(writeText).toHaveBeenCalledExactlyOnceWith('163.69')
  expect(screen.getByRole('button', { name: 'Copied' })).toBe(button)
  expect(screen.getByText('Copied', seen)).toHaveAttribute(
    'aria-live',
    'polite',
  )
  // The normal label is now only in the twin, so it is not read out.
  expect(screen.queryByText('Copy amount', seen)).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(2_000))
  expect(screen.getByRole('button', { name: 'Copy amount' })).toBeVisible()
  expect(screen.queryByText('Copied', seen)).not.toBeInTheDocument()
})

test('the twin that holds its space is hidden from assistive technology and takes no focus', () => {
  const { container } = render(
    <CopyButton value="163.69" label="Copy amount" />,
  )
  const button = screen.getByRole('button', { name: 'Copy amount' })
  expect(screen.getAllByRole('button')).toEqual([button])
  expect(within(button).getByText('Copy amount')).toHaveAttribute(
    'aria-live',
    'polite',
  )
  const twin = container.querySelector('button[aria-hidden="true"]')
  expect(twin).not.toBe(button)
  expect(twin).toHaveTextContent('Copy amount')
  // jsdom does not implement inert, so the attributes that keep focus out stand in for a focus check.
  expect(twin).toHaveAttribute('inert')
  expect(twin).toHaveAttribute('tabindex', '-1')
  expect(twin).not.toHaveAttribute('aria-live')
  expect(twin?.querySelector('[aria-live]')).toBeNull()
})

test('narrows towards its start, or towards its end when asked', () => {
  const { rerender } = render(<CopyButton value="163.69" label="Copy amount" />)
  expect(screen.getByRole('button')).toHaveClass('justify-self-start')
  rerender(<CopyButton value="163.69" label="Copy amount" align="end" />)
  expect(screen.getByRole('button')).toHaveClass('justify-self-end')
  expect(screen.getByRole('button')).not.toHaveClass('justify-self-start')
})

test('says copying failed when the clipboard rejects', async () => {
  setClipboard({
    writeText: writeText.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError'),
    ),
  })
  expectFailedUnder(await clickCopy())
})

test('says copying failed when there is no clipboard', async () => {
  setClipboard(undefined)
  expectFailedUnder(await clickCopy())
})
