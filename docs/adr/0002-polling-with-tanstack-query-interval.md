# ADR 0002: Polling uses TanStack Query's interval, proven by tests

**Status:** accepted, 12 Nov 2026

## Context

The page polls `GET /api/payments/:reference` until a final status. The brief is specific about what can go wrong: stop on terminal states, no leaked intervals, no overlapping requests, good behaviour when the server returns 500.

TanStack Query is already in the project for every other request.

## Options

| Option | For | Against |
|---|---|---|
| **TanStack Query's `refetchInterval`** | About ten lines. One mechanism for all server data. Cancellation, pausing while offline, and refetch when the tab returns come with it | The no-overlap guarantee is inherited from the library, not visible in my code. I have to know its internals to explain it |
| **A hand-written loop** that waits for each response before scheduling the next | "Never overlaps" is true by construction and easy to point at | Roughly forty lines that duplicate what the library does. Server data would live in two mechanisms |

## Decision

Use TanStack Query's interval on one query per payment reference, and prove every guarantee with a test.

- The interval is a function of the last result: 3 s while active, 15 s on `expired`, off on `paid`, `overpaid` and `failed`, doubling up to 30 s after consecutive failures.
- The library's built-in retries are off for this query. The next poll is the retry.
- Polling pauses while the tab is hidden, and one poll fires when it returns.
- There is one query per payment reference. The interval, the tab returning, the check at zero and "Try now" all go through it, and a trigger that fires during a request joins that request.
- Starting a requote waits for the poll in flight to be cancelled before it sends. The requote's response replaces the cached payment.
- Every request bypasses the HTTP cache.
- Every request carries the query's abort signal and a 10 s timeout.

## Consequences

- The guarantee rests on this behaviour of the library: a query has at most one request in flight, and an interval tick that lands during a request joins it instead of starting another. That is my understanding of it, so the test suite fires every trigger against a response slower than the interval and asserts that only one request is ever in flight.
- The other tests: no poll after a final status, nothing after unmount, the backoff sequence, the requote race, and the pause while hidden.
- If a test shows the library does not behave this way, the fallback is the hand-written loop. The rest of the design does not change, because everything downstream reads the cached payment.
- The interval is fixed-rate, not fixed-delay. Against a slow server, the next request can start soon after the previous one ends. The backoff covers failures; a consistently slow but successful server gets no relief. I accept that for a mock.
- An abandoned tab on the `expired` screen polls every 15 s for as long as it is visible. A hidden tab does not poll.
