# ADR 0003: Any money stops the clock; expired quotes keep watching

**Status:** accepted, 12 Nov 2026. Revised twice the same day after review; see "How this decision moved".

## Context

Two things can go wrong with the money that the happy path does not cover.

- **It arrives short.** The server reports `underpaid` with the amount received, the amount outstanding and the same address. The response has no deadline field.
- **It arrives late.** The quote expires, and then the money shows up. The API has no status for this. `expired` carries only `expired_at`.

The brief says a payment that is already on its way must never expire under the shopper. A quote is also a price held for a limited time. These pull in opposite directions for a partial payment.

## Options for a partial payment

| Option | For | Against |
|---|---|---|
| **Any money stops the clock** | One rule for `detected`, `confirming` and `underpaid`. The shopper is never rushed and can always send the rest | The rate stays open for the remainder with no limit. That is harmless for USDT and USDC and a real exposure for ETH. An abandoned partial payment hangs until the server ends it |
| **The original deadline still applies** | The rate risk is bounded. It is what a quote means | A shopper who already sent money faces a deadline that a second exchange withdrawal often cannot meet. If they miss it, their money sits at an expired address |

## Options for an expired quote

| Option | For | Against |
|---|---|---|
| **Stop polling at `expired`** | Simple, and close to the brief's "stop polling on terminal states" | A shopper who sent in the last seconds is told "expired" and invited to pay again while the first payment is in flight |
| **Keep polling until a new quote** | If the server later reports the payment, the page moves on by itself | The page polls for as long as it is open on that screen |

## Options if the server reports `expired` after a partial payment

The page does not cause this, but a server can report it, and the dev panel can force it.

| Option | For | Against |
|---|---|---|
| **Offer a new quote for the full amount, with a warning that the earlier funds will not count** | The shopper can still complete the order on this page | The API does not say what happens to funds already sent. "Will not count" is a guess, told as fact to someone with money at stake. It also invites paying the full amount on top of the part already sent |
| **Offer a new quote and say only that the page cannot tell what happens to the earlier funds** | Claims nothing the API does not state | Still puts a full-amount pay screen in front of a shopper whose earlier money is unaccounted for |
| **Offer no new quote** | The page cannot lead anyone into paying twice. It says nothing it does not know | The shopper cannot finish the order here and has to contact the merchant |

## Decision

1. **Any money stops the clock.** The countdown exists only on `awaiting_payment`. On `underpaid`, as on `detected` and `confirming`, there is none. The underpaid screen shows what was received, the exact amount still to send, the same address and network, and a QR. The mock never expires a payment that has received money.
2. **`expired` keeps polling**, every 15 s, until the shopper gets a new quote. The address and QR are hidden, and the screen says "Already sent? Do not send again. We are still watching for your payment."
3. **The page keeps the sequence of statuses it has seen,** with the amounts that came with them, so it can tell an expired quote that received nothing from one that received part.
4. **If the server reports `expired` after a partial payment, the page offers no new quote.** The screen says the full amount was not reached, shows what was received and what was missing, and sends the shopper to the merchant with the payment reference. It keeps polling in case the rest is already on its way.

## How this decision moved

This is the decision I changed my mind on most, so the path is worth recording.

1. **In the design session** the agent recommended that any money stop the clock. I chose the opposite: the original deadline still applies to `underpaid`, because a quote is a price held for a limited time. For a quote that then expired, I chose to offer a new quote for the full amount with a warning that the earlier funds would not count.
2. **A review of the draft** pointed out that the warning stated something the API never says. I removed the new quote, which made that screen a dead end (decision 4).
3. **That changed the cost of the deadline.** With no new quote, a shopper who paid part and missed the deadline could do nothing more on this page. And in this design the page never expires anything by itself; it was our own mock that would expire the partial payment. The same review read the brief's line, that a payment on its way must never expire under the shopper, as covering a partial payment. I agreed, and reversed the first decision (decision 1).

The brief's sentence is written about `detected`, so applying it to `underpaid` is an interpretation. I think it is the right one. Money has arrived, and from the shopper's side a partial payment is a payment on its way.

## Consequences

- The rate stays open for the remainder of a partial payment, with no limit. For USDT and USDC that costs nothing. For ETH it is a real exposure, and a real backend would want its own rule for ending a stale partial payment. That rule belongs on the server. The page already has a screen for it: `expired` after `underpaid`, or `failed`.
- `expired` has two faces. With no money seen it is a fixable problem with one action, a new quote. After a partial payment it is a dead end, like `failed`.
- The sequence lives in memory. After a reload the page does not know whether money arrived earlier, so it uses cautious wording on `expired` and `failed` (ADR 0005). The tick box "I have not sent a payment" still guards the new-quote button there.
- `expired` is not treated as terminal for polling. Only `paid`, `overpaid` and `failed` stop it.
- The mock's requote endpoint still accepts any expired payment, as the brief describes it. The page simply does not call it after a partial payment.
- Whether the server really credits a late payment is an assumption, listed as an open question in the design doc. So is everything about partial settlement. If the backend defined it, a new quote for the remainder would be the follow-up.
