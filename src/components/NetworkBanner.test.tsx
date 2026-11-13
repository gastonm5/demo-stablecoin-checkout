import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { NetworkBanner } from './NetworkBanner'

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
  'fills the %s banner with its colour, its words in the colour that reads on it and its chip reversed',
  (networkId, networkName, fill, text) => {
    render(
      <NetworkBanner
        currency="USDC"
        networkId={networkId}
        networkName={networkName}
      />,
    )
    const heading = screen.getByText(`${networkName} network`)
    const warning = screen.getByText(/Any other network loses your funds\.$/)
    expect(heading.parentElement?.parentElement).toHaveClass(fill, text)
    // Both lines inherit the banner's colour: the muted inverse grey fails on the chain colours.
    for (const line of [heading, warning])
      expect(line.className).not.toMatch(/(^|\s)text-ink/)
    expect(screen.getByText(networkName[0])).toHaveClass(
      text.replace('text-', 'bg-'),
      fill.replace('bg-', 'text-'),
    )
  },
)
