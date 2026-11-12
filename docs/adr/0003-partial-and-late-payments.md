# ADR 0003: Partial payments keep the deadline; expired quotes keep watching

**Status:** accepted, 12 Nov 2026. Revised the same day after review: decision 4 changed from "offer a new quote for the full amount" to "offer no new quote".

## Context

Two things can go wrong with the money that the happy path does not cover.

- **It arrives short.** The server reports `underpaid` with the amount received, the amount outstanding and the same address. The response has no deadline field.
- **It arrives late.** The quote expires, and then the money shows up. The API has no status for this. `expired` carries only `expired_at`.

The brief says a payment that is already on its way must never expire under the shopper. A quote is also a price held for a limited time. These pull in opposite directions for a partial payment.

## Options for a partial payment

| Option | For | Against |
|---|---|---|
| **Any money stops the clock** | One rule for `detected`, `confirming` and `underpaid`. The shopper is never rushed | The rate stays open for the remainder with no limit. That is harmless for USDT and USDC and a real exposure for ETH. An abandoned partial payment hangs until the server ends it |
| **The original deadline still applies** | The rate risk is bounded. It is what a quote means | A shopper who already sent money faces a deadline that a second exchange withdrawal often cannot meet |

## Options for an expired quote

| Option | For | Against |
|---|---|---|
| **Stop polling at `expired`** | Simple, and close to the brief's "stop polling on terminal states" | A shopper who sent in the last seconds is told "expired" and invited to pay again while the first payment is in flight |
| **Keep polling until a new quote** | If the server later reports the payment, the page moves on by itself | The page polls for as long as it is open on that screen |

## Options once a partial payment has expired

The shopper sent part of the amount and the deadline passed. The page could offer a new quote, and the API allows it: requote works on any expired payment.

| Option | For | Against |
|---|---|---|
| **Offer a new quote for the full amount, with a warning that the earlier funds will not count** | The shopper can still complete the order on this page | The API does not say what happens to funds already sent. "Will not count" is a guess, told as fact to someone with money at stake. It also invites paying the full amount on top of the part already sent |
| **Offer a new quote and say only that the page cannot tell what happens to the earlier funds** | Claims nothing the API does not state | Still puts a full-amount pay screen in front of a shopper whose earlier money is unaccounted for |
| **Offer no new quote** | The page cannot lead anyone into paying twice. It says nothing it does not know | The shopper cannot finish the order here and has to contact the merchant |

## Decision

1. **`underpaid` keeps the original deadline.** The countdown keeps running against the quote's `expires_at`. The screen shows what was received, the exact amount still to send, the same address and network, and a QR.
2. **`expired` keeps polling**, every 15 s, until the shopper gets a new quote. The address and QR are hidden, and the screen says "Already sent? Do not send again. We are still watching for your payment."
3. **The page keeps the sequence of statuses it has seen,** with the amounts that came with them, so it can tell an expired quote that received nothing from one that received part.
4. **After a partial payment has expired, the page offers no new quote.** The screen says the full amount was not reached, shows what was received and what was missing, and sends the shopper to the merchant with the payment reference. It keeps polling in case the rest is already on its way.

## Why decision 4 changed

My first decision was the first option in the last table: a new quote for the full amount, behind a warning that the earlier funds would not count. A review of the draft pointed out that this contradicts a rule the design sets for itself, to say only what the API says.

The API is silent on three things at once here: whether a partly paid payment really expires, what happens to the part that was received, and whether a requote takes it into account. A new quote on top of that silence would have the page narrating a refund policy it made up. The honest position is that this page does not know, and the party who does know is the merchant.

It also fits the rest of the design. Screens where the shopper can fix something carry one action. Screens where they cannot carry none. Once the deadline has passed on a partial payment, nothing the shopper can do on this page is known to be safe, so it belongs with the second kind.

## Consequences

- A shopper who sends part and misses the deadline cannot recover on this page. That is harsh. It is the honest result of a time-limited quote and an API that does not define partial settlement.
- `expired` now has two faces. With no money seen it is a fixable problem with one action, a new quote. After a partial payment it is a dead end, like `failed`.
- The sequence lives in memory. After a reload the page does not know whether money arrived earlier, so it uses cautious wording on `expired` and `failed` (ADR 0005). The tick box "I have not sent a payment" still guards the new-quote button there.
- `expired` is not treated as terminal for polling. Only `paid`, `overpaid` and `failed` stop it.
- The mock follows the same rule for the deadline: an underpaid payment expires when it passes. The mock's requote endpoint still accepts any expired payment, as the brief describes it; the page simply does not call it in this case.
- Whether the server really credits a late payment is an assumption, listed as an open question in the design doc. So is everything about partial settlement. If the backend defined it, for example with a status that says how received funds are handled, a new quote for the remainder would be the follow-up.
