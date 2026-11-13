import type { Currency, Payment } from '../api/schemas'
import { amountsToSend, fitsDecimals } from './money'

export function detailsMatch(
  payment: Payment,
  currencies: Currency[],
): boolean {
  const { quote } = payment
  const currency = currencies.find((c) => c.code === quote.crypto_currency)
  const network = currency?.networks.find((n) => n.id === quote.network)
  return (
    currency !== undefined &&
    network?.name === quote.network_name &&
    amountsToSend(payment).every((amount) =>
      fitsDecimals(amount, currency.decimals),
    )
  )
}
