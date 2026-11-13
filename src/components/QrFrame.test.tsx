import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { QrFrame } from './QrFrame'

test.each([
  ['tron', 'Tron (TRC-20)', 'bg-network-tron', 'text-ink-inverse'],
  [
    'ethereum',
    'Ethereum (ERC-20)',
    'bg-network-ethereum-fill',
    'text-ink-inverse',
  ],
  ['polygon', 'Polygon', 'bg-network-polygon', 'text-ink-inverse'],
  ['solana', 'Solana', 'bg-network-solana', 'text-ink'],
  ['bitcoin', 'Bitcoin', 'bg-network-other', 'text-ink-inverse'],
])(
  'frames the %s code in its colour, the bar in the colour that reads on it and its chip reversed',
  (networkId, networkName, fill, text) => {
    render(
      <QrFrame
        address="TQ4xGx7b2mD1Rv5sYbF8yZc3kJpLwNhE9a"
        networkId={networkId}
        networkName={networkName}
        note="The code holds the address only. Enter the amount yourself."
      />,
    )
    const bar = screen.getByText(
      `${networkName.toUpperCase()} ONLY`,
    ).parentElement
    expect(bar).toHaveClass(fill, text)
    // The frame is the bar's own fill, not a border colour that could drift from it.
    expect(bar?.parentElement).toHaveClass(fill)
    expect(bar?.parentElement?.className).not.toMatch(/(^|\s)border/)
    expect(screen.getByText(networkName[0])).toHaveClass(
      text.replace('text-', 'bg-'),
      fill.replace('bg-', 'text-'),
    )
  },
)
