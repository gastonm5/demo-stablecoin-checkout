import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { QrFrame } from './QrFrame'

test.each([
  [
    'tron',
    'Tron (TRC-20)',
    'bg-network-tron',
    'text-ink-inverse',
    'border-network-tron',
  ],
  [
    'ethereum',
    'Ethereum (ERC-20)',
    'bg-network-ethereum-fill',
    'text-ink-inverse',
    'border-network-ethereum-fill',
  ],
  [
    'polygon',
    'Polygon',
    'bg-network-polygon',
    'text-ink-inverse',
    'border-network-polygon',
  ],
  [
    'solana',
    'Solana',
    'bg-network-solana',
    'text-ink',
    'border-network-solana',
  ],
  [
    'bitcoin',
    'Bitcoin',
    'bg-network-other',
    'text-ink-inverse',
    'border-network-other',
  ],
])(
  'frames the %s code in its colour, the bar in the colour that reads on it and its chip reversed',
  (networkId, networkName, fill, text, fillBorder) => {
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
    // A border, not padding: content inside a rounded border is clipped to its inner curve, so the code's square corners cannot cut the frame away.
    expect(bar?.parentElement).toHaveClass(fillBorder, 'border-[3px]')
    expect(bar?.parentElement).not.toHaveClass('p-[3px]')
    expect(screen.getByText(networkName[0])).toHaveClass(
      text.replace('text-', 'bg-'),
      fill.replace('bg-', 'text-'),
    )
  },
)
