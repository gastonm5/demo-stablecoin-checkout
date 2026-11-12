# ADR 0003: Partial payments keep the deadline; expired quotes keep watching

**Status:** accepted, 12 Nov 2026

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

## Decision

1. **`underpaid` keeps the original deadline.** The countdown keeps running against the quote's `expires_at`. The screen shows what was received, the exact amount still to send, the same address and network, and a QR.
2. **`expired` keeps polling**, every 15 s, until the shopper gets a new quote. The address and QR are hidden, and the screen says "Already sent? Do not send again. We are still watching for your payment."
3. **The page keeps the sequence of statuses it has seen,** with the amounts that came with them, so it can tell these cases apart:
   - `expired` with no money seen: "Get a new quote", enabled after ticking "I have not sent a payment".
   - `expired` after `underpaid`: "The full amount wasn't reached." A new quote is offered with a warning that it is for the full amount and the funds already sent will not count toward it.
4. **A new quote after a partial payment is for the full amount.** The requote endpoint returns the same body as a new payment, so that is the literal reading. The page says so plainly and points the shopper to the merchant for the earlier funds.

## Consequences

- A shopper who sends part and misses the deadline ends up with money at an expired address and has to contact the merchant. That is harsh, and it is the honest result of a time-limited quote. The page says it without softening.
- The sequence lives in memory. After a reload the page does not know whether money arrived earlier, so it falls back to cautious wording on `expired` and `failed` (ADR 0005).
- `expired` is not treated as terminal for polling. Only `paid`, `overpaid` and `failed` stop it.
- The mock follows the same rule: an underpaid payment expires at its deadline.
- Whether the server really credits a late payment, and whether a requote really ignores earlier funds, are assumptions. Both are listed as open questions in the design doc.
