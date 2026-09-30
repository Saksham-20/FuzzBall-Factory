# Personal data: what we keep, for how long, and how it goes

This is the engineering side of the privacy policy (`web/src/components/content/policies/privacy.tsx`, which still carries
placeholder wording, see `docs/PLACEHOLDERS.md`). Every rule below is enforced by code, not by hand.

## Where the rules live

| Data | Kept for | Then | Job (schedule, UTC) |
|---|---|---|---|
| Account, addresses, wishlist, reviews | until the customer asks | erased 30 days after the request (see below) | `account.erase-due` (04:10) |
| Orders, payments, quotes, refunds | 8 years (tax and disputes) | not automated yet; name, address, phone and email are removed at erasure, amounts and dates stay | n/a |
| Refresh-token rows (login sessions) | until expiry + 7 days | deleted; the IP address and browser string are dropped after 30 days | `auth.purge-tokens` (03:30), `auth.scrub-token-meta` (03:58) |
| Password-reset and email-confirmation tokens | until expiry + 7 days | deleted | `auth.purge-tokens` |
| Login and order-lookup guess counters | 1 day | deleted | `auth.purge-throttle` (03:35) |
| Email outbox | 30 days once sent, 90 days if it gave up | deleted; the message body is emptied the moment it is sent | `email.purge` (03:50) |
| Audit log | indefinitely (accountability) | the IP address is dropped after 90 days | `audit.scrub-ips` (03:55) |
| Razorpay webhook payloads | 90 days if processed cleanly | deleted; failed or unprocessed ones stay until someone looks | `webhooks.purge` (03:45) |
| Idempotency keys | 24 hours | deleted | `idempotency.purge` (03:15) |
| Uploaded photos nobody used | 7 days | file and record deleted | `uploads.purge-orphans` (04:20) |
| Cash-on-delivery orders never confirmed | 72 hours | cancelled, stock released | `orders.expire-cod` (hourly) |

## Erasure (DPDP Act)

`POST /account/delete-request` starts a 30-day clock (`User.deletionRequestedAt`); `POST /account/delete-request/cancel`
withdraws it; the profile page shows the state. When the clock runs out `ErasureService` anonymises the account:

* **Deleted:** saved addresses, wishlist, reviews (product ratings are recomputed), work-order conversations and reference
  photos, every file the customer uploaded, refresh/reset/confirmation tokens, idempotency keys, guess counters, queued
  emails to the old address, IP addresses on audit rows.
* **Scrubbed, kept:** orders and work orders keep amounts, items, dates and status; name, phone, email, street address,
  postal code, gift note, admin notes, tracking link and timeline notes are removed. Payments, quotes and refunds are untouched.
* **The `User` row stays** as a shell (`Deleted customer`, `erased-<id>@erased.invalid`, no usable password) so foreign keys
  hold. `erasedAt` records when.
* **Deferred, not skipped:** an open order, an open work order or an unfinished refund postpones the erasure to the next
  night; so does a stored file that cannot be deleted. Nothing is changed until everything can be.
* **Never erased:** staff accounts.
* The person gets one last email (`auth.account_erased`) at the old address.

## Access (DPDP Act)

`GET /account/export` returns one JSON file: profile, addresses, orders, work orders with conversations, payments, reviews,
wishlist and uploads. Passwords and internal columns are not included. 3 requests a minute.

## Cookies

Only essential cookies exist: the sign-in session (`fbf_at`, `fbf_rt`), a hint cookie (`fbf_role`) and the guest order
access cookie (`fbf_go`). No analytics or advertising cookies, so there is no consent banner. If analytics is ever added,
it needs a consent choice first and this file needs a new row.

## Adding a new kind of personal data

1. Decide how long it is needed and write the row in the table above.
2. Add its purge/scrub to `RetentionService` and a `@Cron` in `ScheduledJobs`, with a test in `retention.e2e-spec.ts`.
3. Make `ErasureService` delete or scrub it, with an assertion in `erasure.e2e-spec.ts`, and include it in `AccountExportService`.
