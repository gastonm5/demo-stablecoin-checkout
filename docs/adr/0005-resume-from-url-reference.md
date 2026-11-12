# ADR 0005: A refresh resumes the payment from a reference in the URL

**Status:** accepted, 12 Nov 2026

## Context

The brief lists persistence as out of scope. Taken literally, a refresh forgets everything and the page opens on the picker.

That has a safety cost. A shopper who refreshes after sending money never sees the result on this page. The old payment still exists on the server with a live address, and the page would let them start a second one.

The API makes resuming cheap: `GET /api/payments/:reference` returns the whole payment, so a reference is enough to rebuild any screen.

## Options

| Option | For | Against |
|---|---|---|
| **Start over at the picker** | No code. Follows the brief | A refresh loses a payment in flight |
| **Keep the reference in the URL** | A refresh resumes on the right screen. About forty lines and a "payment not found" path | The sequence of statuses the page has seen restarts on reload |
| **Reference in the URL, and the status sequence in session storage** | Full resume | The most code for something the brief excludes |
| **A "leave this page?" browser prompt** while a payment is in progress | A few lines | It nags shoppers who are simply finished, and does not help after a crash |

## Decision

After a payment is created, the page puts its reference in the URL (`?payment=<reference>`). On load, a reference in the URL makes the page fetch that payment and resume. If the server does not know the reference, the page returns to the picker with a notice.

The status sequence is not persisted.

## Consequences

- This goes beyond the brief on purpose. I think a payment page that forgets a payment on refresh is a shopper-safety problem, not a missing feature.
- After a reload the page knows the current status but not what came before. Two screens depend on that history:
  - `expired` after a partial payment normally warns that earlier funds will not count toward a new quote.
  - `failed` normally says whether money was seen.
- To keep those warnings from silently disappearing, the sequence records whether it started at creation or from a reload. When it started from a reload, `expired` and `failed` use cautious wording: "if you already sent funds, they won't count toward a new quote".
- The reference is visible in the address bar and in browser history. It is not a secret in this API, since there is no auth, but a real deployment would want to check that.
- Full resume is listed as a follow-up. The better fix is on the server: if `expired` and `failed` carried `amount_received`, the page would not need to remember anything.
