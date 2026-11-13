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

// The text people see and hear: the unseen copies that hold the widths are left out.
const seen = { ignore: '[aria-hidden="true"], [aria-hidden="true"] *' }

test('says Copied, then goes back to its label', async () => {
  vi.useFakeTimers()
  setClipboard({ writeText: writeText.mockResolvedValue(undefined) })
  await clickCopy()
  expect(writeText).toHaveBeenCalledExactlyOnceWith('163.69')
  expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  expect(screen.getByText('Copied', seen)).toHaveAttribute(
    'aria-live',
    'polite',
  )
  // The unseen labels that hold the widths are not read out.
  for (const copy of screen.getAllByText('Copy amount'))
    expect(copy).toHaveAttribute('aria-hidden', 'true')
  act(() => vi.advanceTimersByTime(2_000))
  expect(screen.getByRole('button', { name: 'Copy amount' })).toBeVisible()
  expect(screen.queryByText('Copied', seen)).not.toBeInTheDocument()
})

test('its unseen copies are hidden from assistive technology and take no focus', () => {
  const { container } = render(
    <CopyButton value="163.69" label="Copy amount" />,
  )
  const button = screen.getByRole('button', { name: 'Copy amount' })
  expect(screen.getByText('Copy amount', seen)).toHaveAttribute(
    'aria-live',
    'polite',
  )
  // One in the button, which it narrows from; one outside, which holds the button's space in the row.
  const copies = screen
    .getAllByText('Copy amount')
    .filter((copy) => copy.getAttribute('aria-hidden') === 'true')
  expect(copies).toHaveLength(2)
  expect(copies.filter((copy) => button.contains(copy))).toHaveLength(1)
  // The width it narrows to.
  expect(within(button).getByText('Copied')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  expect(container.querySelectorAll('button, [tabindex]')).toHaveLength(1)
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
