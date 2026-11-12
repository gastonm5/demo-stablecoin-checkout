# ADR 0001: The server decides expiry; the countdown uses the device clock

**Status:** accepted, 12 Nov 2026

## Context

A quote carries `expires_at`, a server timestamp. The page shows a countdown to it. The shopper's device clock can be wrong by seconds or by hours, and the brief scores "clock differences" and a countdown that survives a background tab.

Two separate questions are tangled together here:

1. What does the page use as "now" when it draws the countdown?
2. Who decides that a quote has expired?

The API hints at the second one. Requote returns 409 `quote-not-expired` when the server still considers the quote live, so a page that trusts its own clock can ask for a new quote and be refused.

## Options for "now"

| Option | For | Against |
|---|---|---|
| **Device clock** | No code beyond `Date.now()`. No dependency on anything the server sends | Wrong by however wrong the shopper's clock is |
| **Server `Date` header** | Corrects the device clock from every response. No API change | Only readable same-origin or with `Access-Control-Expose-Headers`. Optional on 5xx. Stale on a cached response. One-second resolution. Needs a fallback chain for each of those cases |
| **A time field in the response body** | Precise and explicit | The brief's API does not have one. I would be inventing it |
| **A monotonic timer (`performance.now()`)** | Ignores changes to the system clock | Can stall while a laptop sleeps in some browsers, which shows too much time left |

## Decision

1. **The countdown uses the device clock.** It is recomputed from `expires_at` on every tick, never decremented.
2. **The server decides expiry.** The countdown reaching zero only triggers a check:
   - The page hides the address and QR, shows "Time's up, checking", and polls at once.
   - `expired` from the server shows the expired screen.
   - If the server says the quote is still live, the address comes back, the timer is hidden, and the page says the quote is still valid.
   - If the check fails, the address stays hidden and the page says it cannot confirm.
3. Once the server reports any money (`underpaid`, `detected` or later), there is no countdown (ADR 0003).

I took the simplest clock because the countdown is information for the shopper and not authoritative data. Whatever it shows, the next poll states the truth.

## Consequences

- **Device clock ahead:** the countdown ends early. The check finds the quote live and the shopper can still pay, without a timer. This is why step 2 exists: if the page hid the address at zero and left it hidden, a shopper whose clock runs far ahead could never pay.
- **Device clock behind:** the countdown shows more time than the server allows. A shopper can send believing they have minutes left. The page corrects only at the first poll after the server expires the quote. This is the real cost of this decision. Polling on `expired` for a late payment (ADR 0003) softens it.
- **Device clock behind, and the server unreachable:** the two cases combine. During an outage the address stays visible until the device's countdown reaches zero, so that a short loss of connection does not block a valid quote. With a slow clock, the real deadline can pass in that window and the shopper can pay late. I accept this. It needs both failures at once, and the outage notice says the page may be out of date. The alternative, hiding the address after a period of silence from the server, would block shoppers with a correct clock and a brief outage far more often.
- The requote 409 should almost never happen, because "Get a new quote" appears only after the server says `expired`. If it does happen, the page re-reads the payment and shows what the server says.
- A background tab cannot make the countdown drift, because nothing is counted.
- If the backend added a time field to its responses, switching to it would be a small change in one hook. I would ask for that.
