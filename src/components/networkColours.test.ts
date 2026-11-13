import { expect, test } from 'vitest'
import css from '../index.css?raw'
import { networkColours } from './networkColours'

test.each(['tron', 'ethereum', 'polygon', 'solana', 'bitcoin'])(
  'gives %s a class for each of the eight slots',
  (networkId) => {
    const colours = networkColours(networkId)
    expect(Object.keys(colours).sort()).toEqual(
      [
        'accent',
        'border',
        'chip',
        'chipOnFill',
        'fill',
        'fillBorder',
        'onFill',
        'tint',
      ].sort(),
    )
    for (const value of Object.values(colours)) expect(value).not.toBe('')
  },
)

test.each(['tron', 'ethereum', 'polygon', 'solana', 'bitcoin'])(
  'reverses the fill for a %s chip on it: the text colour behind, the fill colour for the letter',
  (networkId) => {
    const { chipOnFill, fill, onFill } = networkColours(networkId)
    expect(chipOnFill).toBe(
      `${onFill.replace('text-', 'bg-')} ${fill.replace('bg-', 'text-')}`,
    )
  },
)

test.each(['tron', 'ethereum', 'polygon', 'solana', 'bitcoin'])(
  'draws a %s border in its fill colour, so a frame and the label on it match',
  (networkId) => {
    const { fill, fillBorder } = networkColours(networkId)
    expect(fillBorder).toBe(fill.replace('bg-', 'border-'))
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

// Tailwind emits nothing, and no error, for a class whose colour token is missing.
test('names only colours that index.css defines, for every network', () => {
  // The check below needs the stylesheet's source, not CSS a plugin has processed.
  expect(css).toContain('--color-network-solana-line:')
  const classes = ['tron', 'ethereum', 'polygon', 'solana', 'bitcoin'].flatMap(
    (networkId) =>
      Object.values(networkColours(networkId)).flatMap((slot) =>
        slot.split(' '),
      ),
  )
  const prefix = /^(?:bg|text|border|accent)-/
  expect(classes.filter((name) => !prefix.test(name))).toEqual([])
  expect(
    classes.filter((name) => {
      const token = name.replace(prefix, '').replace(/\/\d+$/, '')
      return !css.includes(`--color-${token}:`)
    }),
  ).toEqual([])
})
