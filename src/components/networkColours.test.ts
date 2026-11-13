import { expect, test } from 'vitest'
import { networkColours } from './networkColours'

test.each(['tron', 'ethereum', 'polygon', 'solana', 'bitcoin'])(
  'gives %s a class for each of the six slots',
  (networkId) => {
    const colours = networkColours(networkId)
    expect(Object.keys(colours).sort()).toEqual(
      ['accent', 'border', 'chip', 'fill', 'onFill', 'tint'].sort(),
    )
    for (const value of Object.values(colours)) expect(value).not.toBe('')
  },
)

test('fills an Ethereum control with a darker blue than its chip, so white text stays readable', () => {
  const { chip, fill } = networkColours('ethereum')
  expect(fill).not.toBe(chip)
})

test('puts dark text on Solana and draws its border in a darker green than its chip', () => {
  const { chip, border, onFill } = networkColours('solana')
  expect(onFill).toBe('text-ink')
  expect(border).not.toBe(chip.replace('bg-', 'border-'))
})

test('gives an id it does not know the neutral colours, even one that names a built-in property', () => {
  const other = networkColours('bitcoin')
  expect(other.chip).toBe('bg-network-other')
  expect(networkColours('constructor')).toEqual(other)
  expect(networkColours('__proto__')).toEqual(other)
})
