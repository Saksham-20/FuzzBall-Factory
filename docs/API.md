# API conventions (`api/`)

Read this before adding a module. Setup and commands: [`api/README.md`](../api/README.md).
Stack: NestJS 12 (Express, ESM) + Prisma 7 + PostgreSQL. The endpoint list is `docs/IMPLEMENTATION_PLAN.md` §3.4;
the web mock layer in `web/src/lib/api/*.ts` defines the response shapes the real endpoints must return.

## Module layout

```
api/
  prisma/            schema.prisma (whole app), migrations/, seed.ts, seed-data/
  prisma.config.ts   datasource URL, migrations path, seed command
  src/
    main.ts          bootstrap (calls configureApp)
    app.setup.ts     helmet, cookies, CORS, ValidationPipe: shared with e2e tests
    app.module.ts    imports every domain module
    config/env.ts    zod-validated env; inject ConfigService<Env, true>
    prisma/          PrismaModule (global) + PrismaService (adapter-pg)
    common/          global infrastructure, see below
    auth/            signup/login/refresh/logout/me/forgot/reset (done)
    users/           user.mapper.ts (UserDto), later: account profile/addresses
    notifications/   NotificationsService + email provider + template registry
    health/          GET /health
    <domain>/        one folder per domain (below)
  test/              *.e2e-spec.ts (supertest, real DB)
```

Domains still to build, one Nest module each: `catalog` (categories, products, reviews), `cart`,
`wishlist`, `coupons`, `checkout` (quote), `orders`, `payments` (Razorpay + webhook), `custom`
(work orders, quotes, messages), `uploads`, `account`, `shipping`, `admin` (thin controllers that call
the domain services; every route `@Roles('admin')` and writes an `AuditLog` row).

Inside a domain folder:

```
orders/
  orders.module.ts
  orders.controller.ts        thin: parse DTO, call service, return
  orders.service.ts           all logic and Prisma access
  order-state.service.ts      the state machine (see below)
  order.mapper.ts             Prisma row -> web `Order` shape
  dto/*.dto.ts                class-validator classes
  *.spec.ts                   unit tests next to the code
```

## Rules

1. **Module per domain.** Register it in `AppModule.imports`. Prisma, config, hashing, numbering,
   idempotency and notifications are global: just inject them.
2. **Controllers are thin.** No Prisma calls and no business rules in controllers. Services own logic.
3. **DTOs use class-validator.** The global pipe uses `whitelist` + `forbidNonWhitelisted` + `transform`,
   so unknown properties are a 400 (this is what stops `role: 'admin'` on signup). Use the helpers in
   `common/dto/decorators.ts` (`NormalizedEmail`, `TrimmedString`, `PhoneField`, `BooleanField`) and
   `PaginationQueryDto`. Convert query numbers with `@Type(() => Number)` (implicit conversion is off).
4. **ESM: relative imports end in `.js`** (`import { X } from './x.js'`), even though the file is `.ts`.
   Prisma client: `import { PrismaClient, type Prisma } from '../generated/prisma/client.js'`, enums from
   `../generated/prisma/enums.js`. Never edit `src/generated`.
5. **Money is whole rupees as `Int`** (same as `web/src/lib/types.ts`). Convert to paise (`* 100`) only
   when talking to Razorpay, and back when reading. Never use floats for money. Prices are always
   recomputed server-side; never trust client totals.
6. **Response shapes match the web types.** Write a `*.mapper.ts` per entity that turns Prisma rows into
   the web type (dates as ISO strings, optional fields omitted rather than `null`, category as slug,
   `Product.rating` from `ratingAverage/ratingCount`). Never return Prisma rows directly (they contain
   internals such as `passwordHash`, `tokenVersion`).
7. **One state service per state machine** (`OrderStateService`, `CustomStateService`), each with an
   explicit transition table, e.g. `const TRANSITIONS: Record<OrderStatus, OrderStatus[]>`. All status
   changes go through `transition(id, to, { actorId, note, photo })`, which in one Prisma transaction
   (a) checks the table (else `invalidTransition()`, 409), (b) updates the row, (c) writes the
   `OrderEvent`/`CustomEvent`, and after commit (d) calls `notifications.send(...)`. Controllers and other
   services never set `status` directly. Unit-test the table (every allowed and a sample of forbidden edges).
8. **Transactions and numbers.** Create orders/work orders inside `prisma.$transaction` and pass the tx
   client to `numbering.nextOrderNumber(tx)` / `nextWorkOrderNumber(tx)` so the counter rolls back with
   them. Decrement stock in the same transaction with a conditional update (`updateMany` where
   `stock >= qty`, check `count`).
9. **Idempotency.** Money-moving POSTs (`/orders`, payment verify, quote accept, refunds) take the
   `Idempotency-Key` header: `@IdempotencyKeyHeader() key`, then
   `idempotency.run({ scope: 'POST /orders', key, userId, payload: dto }, () => service.place(dto))`.
   Webhooks dedupe on `WebhookEvent.eventId` (unique).
10. **Auth is on by default.** The global `JwtAuthGuard` protects everything. Opt out per route with
    `@Public()`; for guest-friendly routes (cart, checkout, order read/track) use `@OptionalAuth()` and
    take `@CurrentUser() user: RequestUser | undefined`. Restrict with `@Roles('admin')` (class-level for
    admin controllers). Under `/admin`, a route with no `@Roles` is refused by `RolesGuard` (fail-closed).
    Always scope customer queries by `user.userId` (an order or work order must never be readable by
    another customer: answer 404, not 403, for other people's records).
11. **Rate limits.** Default 100/min/IP. Tighten expensive or abusable routes with
    `@Throttle({ default: { limit, ttl: 60_000 } })` (e.g. quote counters, review submission, track).
12. **Notifications after commit, never inside a transaction.** `notifications.send(event, payload)`
    never throws. To add an event: extend `NotificationEventMap` in `notifications/events.ts`, add its
    template in `notifications/templates/registry.ts` (compile error until you do), then call `send`.
13. **Admin writes are audited.** Insert an `AuditLog` row (`actorId`, `action`, `entity`, `entityId`,
    `meta`) for every admin mutation.
14. **Tests.** Unit tests (`*.spec.ts`, no DB, Vitest) for state tables, pricing, signatures, mappers.
    E2E (`test/*.e2e-spec.ts`) for flows via `configureApp(app)`; clean up rows you create.

## Error format

Every error response is `{ code, message, fields? }` with the real HTTP status. It matches the web
`ApiError(status, message, fields)`. `fields` maps a (dotted) input path to a message and is present for
validation and field-level conflicts.

```json
{ "code": "VALIDATION_FAILED", "message": "Some details need another look.", "fields": { "email": "Enter a valid email address" } }
{ "code": "EMAIL_TAKEN", "message": "An account with this email already exists. Try logging in.", "fields": { "email": "Already registered" } }
{ "code": "UNAUTHENTICATED", "message": "Please log in to continue." }
```

Throw from services with the helpers in `common/errors.ts`: `badRequest`, `validationFailed`,
`unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`, `invalidTransition`, or
`new AppException(status, code, message, fields?)`. `message` is shown to shoppers: write it in the
store's friendly voice. Unknown errors become a generic 500 (no stack, no internals); Prisma `P2002` maps
to 409 and `P2025` to 404. Add new machine codes to `ErrorCode`.

Void endpoints (logout, forgot, reset) return **204 No Content**.

## Data model notes (`prisma/schema.prisma`)

- Enums mirror `web/src/lib/types.ts` exactly. `Role` values are lowercase (`customer`, `admin`).
- `Order.number` (`FB-1001`) and `CustomRequest.number` (`WO-001`) are the public ids; `Product.slug` for
  products. Internal ids are cuids. `Product.batch` is the unique autoincrement "Batch #".
- Snapshots: `Order.contact` / `Order.address` are Json; `contactEmail` / `contactPhone` are denormalised
  copies for guest tracking. `OrderItem` copies name, image, colour, size, unit price.
- Carts belong to a `userId` or a guest `sessionId` (cookie); merge into the user's cart on login.
- `Setting` rows are key/value Json; keys mirror `StoreSettings` (seeded from the web mock defaults).
- `CustomRequest.category` is a category slug; `baseProductId` relates to `Product` (web exposes
  `baseProductSlug`). `CustomEvent` is the work-order timeline (incl. progress photos); `Quote` holds the
  counter (`counterAmount/Note/At`).
- `Payment.purpose` is `ORDER | DEPOSIT | BALANCE`; amounts in rupees.
- `AuditLog`, `WebhookEvent`, `IdempotencyKey`, `PasswordResetToken`, `RefreshToken`, `Counter` are
  infrastructure tables.

## Auth summary

Access JWT (15 min) and rotating refresh JWT (30 days, stored hashed, per-session family) in httpOnly
`SameSite=Lax` cookies (`fbf_at` path `/`, `fbf_rt` path `/auth`; `Secure` in production); Bearer header
also accepted. `User.tokenVersion` is checked on every request (bump = sign out everywhere; done on
password reset: do the same on password change via `TokenService.revokeAllForUser`). Reuse of a rotated
refresh token revokes its whole family. Role is read from the DB, never from the token.

---

# Custom work orders and admin (`api/src/custom`, `api/src/admin`)

Response bodies equal the web types (`web/src/lib/types.ts`, plus `Dashboard`/`NeedsYou`/`CustomerRow` from
`web/src/lib/api/admin.ts`). Rupees are `Int`, dates are ISO strings, optional fields are omitted. Every admin route is
`@Roles('admin')` (guest 401, customer 403) and every admin write inserts an `AuditLog` row in the same transaction.

## Work-order flow

```
REQUESTED → UNDER_REVIEW → QUOTED ⇄ COUNTERED (max 2) → ACCEPTED → DEPOSIT_PENDING → IN_PROGRESS
  → AWAITING_APPROVAL ⇄ IN_PROGRESS (change request) → BALANCE_PENDING → READY_TO_SHIP → SHIPPED → DELIVERED → CLOSED
exits: DECLINED (maker), CANCELLED (customer declines the quote), EXPIRED (quote validity; maker can re-quote)
```

- One table (`custom/custom-transitions.ts`), one writer (`CustomStateService`): optimistic `updateMany … where status = from`,
  a `CustomEvent` per hop, emails after commit. Illegal hop = 409 `INVALID_TRANSITION`.
- Customer accept/counter/decline/approve/change/pay answer **400 "That isn't possible at this stage of the work order."**
  when the work order is in the wrong state (same text as the mock); an expired quote is **410** "This quote has expired. Message us to reopen it."
- Accept = `QUOTED → ACCEPTED → DEPOSIT_PENDING` in one transaction (two timeline events). Payment is a **separate call**:
  `POST /custom/:wo/pay-deposit` returns a `CheckoutPayment` (open Razorpay, or in dev POST `/payments/mock/:paymentId/confirm`).
  The paid handlers move the work order: DEPOSIT → `IN_PROGRESS` ("Deposit received. We're starting your piece."), BALANCE → `READY_TO_SHIP`.
- `depositPct` and `quoteValidityDays` come from `Setting` at quote-send time; the % is snapshotted on the quote. Quote price is
  always the sum of the breakdown lines; deposit = `round(price * pct / 100)`, balance = `price - deposit`.
- Counters: at most 2 (counted from timeline events `COUNTERED`), amount must be a whole rupee number lower than the quote.
- Revisions: `request-change` records a `CHANGE_REQUESTED` event; `extraCharge` is true once the count reaches the quote's `revisions`.
- Expiry is lazy (any read/act on a work order, admin list, dashboard, customer list); `@nestjs/schedule` is not installed so there is no cron.
- Ownership: a customer only ever sees their own work orders (404 otherwise). `GET /custom/:wo` also allows an admin.

## Customer endpoints (login required)

| Web function (`lib/api/custom.ts`) | Method + path | Body → response |
|---|---|---|
| `createRequest(input)` | `POST /custom` (201, `Idempotency-Key` optional) | `CreateCustomInput` (+ optional `termsAccepted`) → `CustomRequest` |
| `listMine()` | `GET /custom` | → `CustomRequest[]` (newest first) |
| `getMine(number)` | `GET /custom/:wo` | → `CustomRequest` |
| `addMessage(number, body, attachments?)` | `POST /custom/:wo/messages` | `{ body, attachments? }` → `CustomRequest` |
| `acceptQuote(number, quoteId)` | `POST /custom/:wo/quotes/:id/accept` (`Idempotency-Key`) | → `CustomRequest` (status `DEPOSIT_PENDING`) |
| `counterQuote(number, quoteId, amount, note)` | `POST /custom/:wo/quotes/:id/counter` | `{ amount, note? }` → `CustomRequest` |
| `declineQuote(number, quoteId, reason?)` | `POST /custom/:wo/quotes/:id/decline` | `{ reason? }` → `CustomRequest` (status `CANCELLED`) |
| `approveFinal(number)` | `POST /custom/:wo/approve` | → `CustomRequest` (`BALANCE_PENDING`) |
| `requestChange(number, note)` | `POST /custom/:wo/request-change` | `{ note }` → `CustomRequest & { extraCharge: boolean }` |
| `payDeposit(number)` | `POST /custom/:wo/pay-deposit` (`Idempotency-Key`) | → `CheckoutPayment` (only in `DEPOSIT_PENDING`) |
| `payBalance(number)` | `POST /custom/:wo/pay-balance` (`Idempotency-Key`) | → `CheckoutPayment` (only in `BALANCE_PENDING`) |

`references` (create) and `attachments` are image URLs from the uploads endpoint (absolute `https://…` or a same-site `/uploads/…` path).
Multipart on `POST /custom` is not implemented: upload first, then send JSON. Extra fields on `CustomRequest`: `courier`, `awb` once shipped.
`payDeposit`/`payBalance` in the mock return the updated request; the real ones return a `CheckoutPayment`. After the checkout succeeds, refetch `GET /custom/:wo`.
Counters, messages, change requests, new requests and payments are throttled to 10/min per IP.

## Admin endpoints (`/admin/*`, `@Roles('admin')`)

| Web function (`lib/api/admin.ts`) | Method + path | Body / query → response |
|---|---|---|
| `dashboard()` | `GET /admin/dashboard` | → `Dashboard` |
| `listAdminProducts(q?)` | `GET /admin/products?q&status` | → `Product[]` |
| `getAdminProduct(id)` | `GET /admin/products/:id` | → `Product` |
| `saveProduct(input)` create | `POST /admin/products` (201) | `ProductInput` → `Product` |
| `saveProduct(input)` update | `PUT /admin/products/:id` | `ProductInput` → `Product` (full replace of images + variants) |
| `setProductStatus(ids, status)` | `POST /admin/products/status` | `{ ids, status }` → `{ updated }` |
| (archive) | `DELETE /admin/products/:id` | → `Product` with `status: ARCHIVED` |
| `saveCategory(c)` | `PUT /admin/categories/:slug` (upsert) or `POST /admin/categories` | `Category` → `Category` |
| `deleteCategory(slug)` | `DELETE /admin/categories/:slug` (204; 409 if it has products) | |
| (list) | `GET /admin/categories` | → `Category[]` |
| `listAdminOrders({status,q})` | `GET /admin/orders?status&q` (`status` also `TO_CONFIRM`/`TO_MAKE`/`TO_PACK`) | → `Order[]` (+ `notes`, `hidePrices`) |
| `getAdminOrder(number)` | `GET /admin/orders/:number` | → `Order` (+ `notes`, `hidePrices`) |
| `updateOrderStatus(number, status, {note,courier,awb})` | `POST /admin/orders/:number/status` | `{ status, note?, courier?, awb? }` → `Order`. Delegates to `OrderStateService`; SHIPPED needs courier + awb (400 `fields.awb`), illegal move 409 |
| (notes) | `PATCH /admin/orders/:number/notes` | `{ notes }` → `Order` |
| (packing slip) | `GET /admin/orders/:number/packing-slip` | → slip data (prices omitted when the customer chose to hide them) |
| `listAdminCustom(status?)` | `GET /admin/custom?status` | → `CustomRequest[]` |
| `getAdminCustom(number)` | `GET /admin/custom/:wo` | → `CustomRequest` |
| `sendQuote(number, input)` | `POST /admin/custom/:wo/quote` | `{ breakdown[{label,amount}], timelineDays, revisions, scope, validDays? }` → `CustomRequest` |
| `declineCustom(number, reason)` | `POST /admin/custom/:wo/decline` | `{ reason }` → `CustomRequest` |
| `acceptCounter(number)` | `POST /admin/custom/:wo/accept-counter` | → `CustomRequest` (`DEPOSIT_PENDING`, price = counter) |
| `markUnderReview(number)` | `POST /admin/custom/:wo/under-review` | → `CustomRequest` |
| `adminMessage(number, body, attachments?)` | `POST /admin/custom/:wo/messages` | `{ body, attachments? }` → `CustomRequest` |
| `addProgress(number, note, photo?)` | `POST /admin/custom/:wo/progress` | `{ note, photo? }` → `CustomRequest` (only `IN_QUEUE`/`IN_PROGRESS`) |
| `requestApproval(number, note?, photo?)` | `POST /admin/custom/:wo/request-approval` | `{ note?, photo? }` → `CustomRequest` |
| `markCustomShipped(number, courier, awb)` | `POST /admin/custom/:wo/ship` | `{ courier, awb }` → `CustomRequest` (needs `READY_TO_SHIP`) |
| `markCustomDelivered(number)` | `POST /admin/custom/:wo/deliver` | → `CustomRequest` |
| `listCustomers(q?)` | `GET /admin/customers?q` | → `CustomerRow[]` (`spent` = paid orders only) |
| `getCustomer(id)` | `GET /admin/customers/:id` | → `{ user, orders, custom }` |
| `listAdminReviews(status?)` | `GET /admin/reviews?status` | → `Review[]` |
| `moderateReview(id, status, disputeReason?)` | `PATCH /admin/reviews/:id` | `{ status, disputeReason? }` → `Review` (product rating recomputed). `status` also accepts `DISPUTED`; `disputeReason` is then required (400 `fields.disputeReason` when missing), kept on the row for the record even if later published/hidden again |
| `setReviewReply(id, reply)` | `PUT /admin/reviews/:id/reply` | `{ reply }` → `Review` (sets `reply` + `repliedAt`) |
| `clearReviewReply(id)` | `DELETE /admin/reviews/:id/reply` | → `Review` (clears `reply` + `repliedAt`) |
| `listCoupons()` | `GET /admin/coupons` | → `Coupon[]` |
| `saveCoupon(c)` | `PUT /admin/coupons/:code` (upsert) or `POST /admin/coupons` | `Coupon` → `Coupon` (`uses` is never overwritten) |
| `deleteCoupon(code)` | `DELETE /admin/coupons/:code` (204) | |
| `listMaterials()` | `GET /admin/materials` | → `Material[]` (non-archived only) |
| `saveMaterial(input)` create | `POST /admin/materials` (201) | `MaterialInput` → `Material` |
| `saveMaterial(input)` update | `PUT /admin/materials/:id` | `MaterialInput` → `Material` |
| `archiveMaterial(id)` | `DELETE /admin/materials/:id` (204) | Soft delete (`archived: true`); excluded from the default list from then on |
| `adjustMaterialStock(id, delta, reason?)` | `POST /admin/materials/:id/adjust-stock` | `{ delta, reason? }` → `Material` (`qtyOnHand` changed by `delta`; negative to record usage) |
| (read settings) | `GET /admin/settings` | → `StoreSettings` |
| `updateSettings(s)` | `PUT /admin/settings` | full `StoreSettings` → `StoreSettings` |

Notes for the http layer:
- `saveProduct`: create when there is no `id` (`POST`), otherwise `PUT /admin/products/:id`. The body may echo `id`, `batch`, `createdAt`, `rating`, `sample` (ignored); other unknown keys are a 400.
  `slug` is optional (derived from the name on create, unchanged on update when omitted). New variants: send them without an `id` (or with an unknown one);
  known variant ids are updated in place. Publishing needs at least one image and one variant. A one-of-a-kind product can have at most 1 in stock.
- `updateOrderStatus` used `ApiError(400)` for illegal moves in the mock; the API answers 409 (`INVALID_TRANSITION`).
- Dashboard: "today" is midnight IST; `revenue` and `revenueByDay` come from the same 30 buckets and count paid orders (COD counts once delivered);
  `ordersToday` excludes `PENDING_PAYMENT` attempts.
- Lists are capped at 500 rows (no pagination yet).

## Notifications added

`workorder.received` (customer, on create), `quoted`, `countered` (sent to the store email, with an admin link), `accepted` (deposit amount),
`deposit_paid`, `progress`, `awaiting_approval`, `balance_due`, `shipped`, and the new `workorder.declined`. Nothing is sent for change requests, ready-to-ship or delivered.


## Commerce endpoints (catalogue, checkout, orders, payments, account, reviews, uploads)

Function -> route mapping for the web `lib/api/*` layer. Bodies are JSON. Money is whole rupees; dates are ISO strings; optional
fields are omitted rather than `null`. Errors use the shape above. "Guest ok" = `@OptionalAuth()` (works without login).

| Web function | Route | Request | Response |
|---|---|---|---|
| `catalog.listCategories()` | `GET /categories` | | `Category[]` (display order) |
| `catalog.listProducts(query)` | `GET /products?category&q&sort&min&max&availability&colour&occasion&page&pageSize` | same names/values as `ProductQuery` (`sort`: `newest`\|`price-asc`\|`price-desc`\|`ready-first`; `availability`: `ready`\|`mto`; `pageSize` 1-100, default 12) | `{ items: Product[], total, page, pageSize }`, PUBLISHED only, sold-out pieces always last |
| `catalog.getProduct(slug)` | `GET /products/:slug` | | `Product`, or 404 "We couldn't find that piece." (draft/archived count as missing) |
| `catalog.relatedProducts(slug, limit)` | `GET /products/:slug/related?limit=4` | limit 1-12 | `Product[]` (same category first) |
| `checkout-extra.getProductsByIds(ids)` | `GET /products/by-ids?ids=a,b,c` | max 50 ids | `Product[]`: published **and archived** (a basket line whose piece was archived can still render); never drafts |
| `settings.getSettings()` | `GET /settings` | | `StoreSettings` (exactly those 11 keys; nothing else in the `Setting` table is exposed) |
| `shipping.checkShipping(input)` | `GET /shipping/check?country&postalCode&leadTimeDays&ready` | `country` ISO-2 or `OTHER`; `ready=true\|false` | `ShippingCheck`. India: 6-digit pincode format, ETA = lead time + 5 business days. Elsewhere: zone table from settings. Adapter seam for Shiprocket: `shipping/shipping.provider.ts` |
| `orders.quote(lines, opts)` | `POST /checkout/quote` | `{ lines: CartLine[], country, giftWrap?, coupon?, paymentMethod? }` (flat: `opts` merged into the body) | `CheckoutQuote`. Guest ok. Coupon problems are reported in `couponError`, not as an HTTP error |
| (coupon check) | `POST /coupons/validate` | `{ code, lines }` | `{ valid, code?, kind?, value?, discount?, error? }` |
| `orders.placeOrder(input)` | `POST /orders` (+ optional `Idempotency-Key` header) | `PlaceOrderInput` (`lines`, `contact`, `address`, `giftWrap?`, `giftNote?`, `hidePrices?`, `coupon?`, `paymentMethod`, `saveAddress?`). Guest ok. **No prices are accepted** | 201 `Order` plus, for `RAZORPAY`, `payment: CheckoutPayment` (see below). COD returns no `payment`. Guests also get the `fbf_go` cookie |
| `orders.confirmPayment(number, ok)` | dev: `POST /payments/mock/:paymentId/confirm` `{ ok }`; live: `POST /payments/razorpay/verify` | see "Payments" | `PaymentResult` (then read the order with `GET /orders/:number`). `ok:false` -> 402 |
| (retry payment) | `POST /orders/:number/pay` | | `CheckoutPayment` for a new attempt on an unpaid online order. Guest ok (same browser) |
| `orders.listMyOrders()` | `GET /orders` | login required | `Order[]`, newest first |
| `orders.getOrder(number)` | `GET /orders/:number` | | `Order`. Owner or admin; a guest order only from the browser that placed it (`fbf_go` cookie). Everything else is **404** (never 403) |
| `orders.trackOrder(number, contact)` | `POST /orders/track` | `{ number, contact }` (contact = phone or email used at checkout) | `Order`; wrong pair and unknown number give the identical 404. Phones match on the last 10 digits (fewer than 10 never match). 10/min/IP |
| `orders.cancelOrder(number, reason?)` | `POST /orders/:number/cancel` | `{ reason? }`. Guest ok (same browser) | `Order`. Allowed from `PENDING_PAYMENT`/`PLACED`/`CONFIRMED`, else 409. Restocks, releases the coupon use, refunds a paid online order |
| `orders.requestReturn(number, reason)` | `POST /orders/:number/return` | `{ reason }` | `Order` (`RETURN_REQUESTED`). Delivered, ready-to-ship, un-personalised, within 7 days of delivery |
| `reviews.listReviews(productId)` | `GET /products/:id/reviews` | | `Review[]` (PUBLISHED only; `DISPUTED` is never returned here, same as `HIDDEN`). Each row carries `reply`/`repliedAt` when the maker has replied |
| `reviews.canReview(productId)` | `GET /products/:id/can-review` | guest ok | `{ canReview: boolean }` (unwrap in the http layer). False for guests, non-buyers and people who already reviewed |
| `reviews.createReview(input)` | `POST /reviews` | `{ productId, rating 1-5, body }` | 201 `Review` (`status: PENDING`, `verified: true`). 403 unless the customer has a DELIVERED order with the piece; 409 if already reviewed. 5/min |
| `account.updateProfile(input)` | `PATCH /account/profile` | `{ name?, email?, phone? }` (`phone: ""` removes it) | `User`. 409 `EMAIL_TAKEN` / `PHONE_TAKEN` |
| (read profile) | `GET /account/profile` | | `User` |
| `account.changePassword(current, next)` | `POST /account/password` | `{ current, next }` | 204. Wrong current -> 400 `fields.current`. Signs out **other** devices (tokenVersion bump); this device gets fresh cookies |
| `account.listAddresses()` | `GET /account/addresses` | | `Address[]` (default first) |
| `account.saveAddress(a)` (no id) | `POST /account/addresses` | `Omit<Address,"id">` (do not send `id`: unknown keys are a 400) | 201 `Address` |
| `account.saveAddress(a)` (with id) | `PUT /account/addresses/:id` | `Omit<Address,"id">` | `Address`. Setting `isDefault` clears the others |
| `account.deleteAddress(id)` | `DELETE /account/addresses/:id` | | 204 (idempotent; other people's ids are a silent no-op) |
| `account.requestAccountDeletion()` | `POST /account/delete-request` | | 204. Sets `User.deletionRequestedAt` and writes an `AuditLog` row `account.delete_request` |
| (upload) | `POST /uploads` | `multipart/form-data`, field `file` (JPG/PNG/WebP/GIF/AVIF, max 8 MB). Login required, 20/min | `{ url }` (WebP, max 2000px, EXIF stripped). 400 `INVALID_IMAGE`, 413 `PAYLOAD_TOO_LARGE` |
| (local files) | `GET /uploads/:folder/:file` | | The image (local driver only). `Cross-Origin-Resource-Policy: cross-origin`, immutable cache |
| (Razorpay) | `POST /payments/razorpay/verify`, `POST /payments/razorpay/webhook` | see "Payments" | |

### Placing an order (what the checkout page must know)

- Lines are `{ productId, variantId, qty, personalization? }` with the ids from the API (`Product.id`, `ProductVariant.id`). Prices, totals, shipping, COD fee,
  gift wrap and discount are recomputed on the server from the catalogue (`pricing/pricing.engine.ts`, a port of `web/src/lib/pricing.ts`, covered by a parity test matrix).
  The order returns the totals the customer will be charged; they equal what `POST /checkout/quote` returned for the same input.
- Send `Idempotency-Key: <uuid>` (8-128 chars) generated once per checkout attempt: a retried request replays the stored response instead of creating a second order.
  Same key + different body is 422 `IDEMPOTENCY_KEY_REUSED`.
- Stock is taken in the same transaction (conditional decrement). Errors: 409 `OUT_OF_STOCK` ("<name> just sold out or has fewer left than you asked for."),
  404 (a piece is gone or unpublished), 400 `COD_NOT_AVAILABLE` (message = the reason from the quote), 400 `COUPON_INVALID` (`fields.coupon`; unlike the mock, an invalid code is refused
  instead of silently ignored, so the customer is never charged more than they saw), 400 `VALIDATION_FAILED` with `address.postalCode` / `address.state` for Indian addresses.
- Online orders start `PENDING_PAYMENT` with the pieces reserved. An unpaid one is cancelled (stock released) after 30 minutes by a background sweep, and
  the customer can retry with `POST /orders/:number/pay` until then. COD orders start `PLACED` / `COD_DUE`.
- **Guest access**: placing an order as a guest sets `fbf_go` (httpOnly, `SameSite=Lax`, path `/orders`, 7 days, signed, lists up to 20 order numbers). The confirmation page (`GET /orders/:number`),
  cancel, return and retry-payment work for that browser only; anyone else uses `POST /orders/track`. The web app must call the API with `credentials: "include"`.
- Emails: COD -> `order.placed` immediately; online -> `order.confirmed` when payment lands; `order.shipped`, `order.delivered`, `order.cancelled` on those transitions.
  Guest emails link to `/track?order=FB-1001`; signed-in customers get `/order/FB-1001`.

### Payments

`PaymentsService` (implements `PaymentsPort`, exported from `PaymentsModule` as the class and under `PAYMENTS_PORT`) creates Razorpay orders (`amount` converted to paise only inside the SDK wrapper `razorpay.gateway.ts`),
and is the single place a payment becomes PAID (`markPaid`): one transaction flips the `Payment` row and runs the registered domain handlers, so verify, webhook and mock-confirm can all arrive in any order and the handler runs exactly once.

`CheckoutPayment` (in the `POST /orders` and `POST /orders/:number/pay` responses): `{ paymentId, razorpayOrderId, keyId, amountPaise, currency: "INR", mock }`.

| Mode | When | Behaviour |
|---|---|---|
| live | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` set | Real Razorpay Orders API. `mock` is `false`. `POST /payments/mock/*` answers 404 |
| mock | no keys and `NODE_ENV !== 'production'` | `mock: true`, `razorpayOrderId` is `order_mock_...`, `keyId` is `rzp_test_mock`. Confirm with `POST /payments/mock/:paymentId/confirm { ok }` |
| disabled | no keys in production | Online orders/payments are refused with 503 `PAYMENT_FAILED` (the order is cancelled and stock released). COD still works. Mock is impossible |

- `POST /payments/razorpay/verify` `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` (the three values Checkout hands to `handler`): HMAC-SHA256 check, then mark PAID. 200 `PaymentResult`
  `{ paymentId, status, purpose, orderNumber?, customRequestNumber?, alreadyProcessed }`; bad signature 400 `PAYMENT_FAILED` (never marks the payment failed). Accepts `Idempotency-Key`.
- `POST /payments/mock/:paymentId/confirm` `{ ok }`: same handler path as verify. `ok:true` -> 200 `PaymentResult`; `ok:false` -> **402** `PAYMENT_FAILED` "The payment didn't go through. You haven't been charged. Please try again."
  and the order stays `PENDING_PAYMENT` with `paymentStatus: FAILED` (retry via `POST /orders/:number/pay`). The web `confirmPayment(number, ok)` becomes: confirm with the `paymentId` from `placeOrder`, then `GET /orders/:number`.
- `POST /payments/razorpay/webhook`: HMAC of the **raw** body with `RAZORPAY_WEBHOOK_SECRET` (`X-Razorpay-Signature`), deduped on `X-Razorpay-Event-Id` in `WebhookEvent.eventId` (falls back to a body hash), idempotent.
  Handles `payment.captured` / `order.paid` (amount + currency verified), `payment.failed`, `refund.created` / `refund.processed` (mirrors dashboard refunds), `refund.failed` (logged). Answers 200 for anything else, 400 for a bad signature,
  500 when processing failed (Razorpay retries; the event stays unprocessed and is retried). Stored payloads have customer identifiers redacted. Configure the dashboard webhook with auto-capture on.
- Refunds: cancelling (or refunding) a paid online order refunds through `PaymentsService.refundOrder` (real Razorpay refund when live, DB-only in mock). A refund that fails does not block the cancellation:
  the timeline note says it needs a manual refund and `paymentStatus` stays `PAID`. A payment that arrives after its order was cancelled, or a duplicate payment for a paid order, is refunded automatically.
- For other modules: `registerPaidHandler(purpose, (event, tx) => ...)` (inside the payment transaction; must be idempotent), `registerPaidListener(purpose, async (event) => ...)` (after commit: send emails here),
  `createPayment({ purpose: 'DEPOSIT' | 'BALANCE', amount, customRequestId, userId?, receipt })`, `refundPayment(paymentId, { amount?, reason })`. `Payment.quoteId` is not part of `CreatePaymentInput`: set it on the row yourself if you need it.

### Order state machine

`orders/order-state.service.ts` + `orders/order-transitions.ts` (`ORDER_NEXT`, identical to the table in `web/src/lib/api/admin.ts`, enforced by a unit test that parses that file).
`OrderStateService.transition(number, to, actor, { note?, courier?, awb?, photo?, silent? })` returns the updated `OrderDto`; `actor` is `{ userId, role }` (a `RequestUser` works) or `SYSTEM_ACTOR`.
In one transaction it checks the table (409 `INVALID_TRANSITION`), requires courier + AWB for `SHIPPED` (400 `fields.courier/awb`), does a compare-and-set on the current status, writes the `OrderEvent` (with `actorId`),
and applies the atomic side effects (cancel: restock + coupon release + `paymentStatus`; COD delivered: `PAID`). After commit: refund (cancelled/refunded online orders) and the customer email.
The only edge outside the table is `PENDING_PAYMENT -> CONFIRMED`, taken by a captured payment (`applyPayment`, the registered ORDER paid handler). Exported from `OrdersModule`: `OrdersService`, `OrderStateService`, `OrderNotifier`;
from files: `toOrderDto`, `ORDER_INCLUDE`, `ORDER_NEXT`, `allowedNextStatuses`.

### Other exports for sibling modules

`UploadsService.uploadImage({ buffer }, { folder? })` -> `{ url }` (Cloudinary when `CLOUDINARY_URL` is set, local disk otherwise). `ReviewsService.recomputeRating(productId, tx?)` refreshes `Product.ratingAverage/Count`.
`SettingsService.getStoreSettings(tx?)`, `PricingService`, `pricing.engine.ts` (`quoteCheckout`, `validateCoupon`), `pricing/business-days.ts` (`addBusinessDays`, Sunday off, IST).

### Environment added

`API_PUBLIC_URL` (base URL for locally stored uploads, default `http://localhost:$PORT`) and `UPLOADS_DIR` (default `./uploads`, git-ignored). Razorpay and Cloudinary variables were already in `.env.example`.


## Running the web app against this API (config-only switch)

`web/src/lib/api/*.ts` keeps its function names and signatures; each function dispatches on `SITE.useMock` (`NEXT_PUBLIC_USE_MOCK !== "false"`):
mock code stays in the module, the REST implementation lives in `web/src/lib/api/real/*.ts` on top of `web/src/lib/api/http.ts`
(base URL `NEXT_PUBLIC_API_URL`, `credentials: "include"`, `ApiError(status, message, fields, code)`, one silent `POST /auth/refresh` on 401,
`newIdempotencyKey()`, `settlePayment()` = the Razorpay seam). Both modes are documented in `web/.env.example`.

```bash
# api (terminal 1): needs Postgres, `npm run prisma:deploy && npm run seed`, WEB_ORIGIN including the web origin
cd api && npm run start:dev                      # http://localhost:4000
# web (terminal 2)
cd web && NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev
```

- Web and API must be the same *site* (cookies are `SameSite=Lax`); `localhost:3000` and `localhost:4000` are.
- `fbf_role` (client-set, readable) is only a hint for `proxy.ts` and to skip `/auth/me` for visitors who never logged in; the API enforces every role.
- Payments in dev (no Razorpay keys): the "Test payment" modals call `POST /payments/mock/:paymentId/confirm { ok }` and then re-read the order / work order.
  With live keys, `settlePayment` in `http.ts` throws until Razorpay Checkout is wired (TODO seam: `keyId`, `razorpayOrderId`, `amountPaise`).
- Uploads: `ImageUploader` calls `uploadImage()` (`lib/api/uploads.ts`): data URL in mock, `POST /uploads` otherwise. `next.config.ts` allows images from the API origin (set `NEXT_PUBLIC_API_URL` at build time).
- The admin settings form reads `GET /admin/settings` (the public `GET /settings` is `Cache-Control: max-age=30`, which would show stale values right after a save).
- Login is throttled to 5/min per IP: scripted logins should reuse sessions.
