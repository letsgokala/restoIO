# Architecture

## Project folders

- `frontend/`: Next.js App Router, React, strict TypeScript, Tailwind CSS, next-intl, feature-owned components/services, and browser tests.
- `backend/`: Express REST API, strict TypeScript ES modules, centralized middleware, PostgreSQL schema, migrations, development seed, and project docs.
- `backend/src/shared/`: API contracts and shared backend validation.

## Backend request path

`HTTP → router → middleware/validation → controller → service → repository → Prisma → PostgreSQL`.

Routes only connect middleware and controllers. Controllers translate HTTP to service calls. Services implement business rules. Repositories are the normal Prisma boundary. Zod validation and API error formatting are centralized. API routes start at `/api/v1`.

## Frontend request path

App Router pages compose feature components. Feature services call a shared credentialed API client. Forms use React Hook Form and Zod. UI primitives are kept separate from feature-specific presentation.

## Initial authentication flow

Staff credentials are verified with Argon2id. A cryptographically random session token is returned only as an HTTP-only cookie; only its SHA-256 digest is stored in the database. Sessions expire and can be revoked. Tenant endpoints require `X-Restaurant-Id`, then the service checks an active membership scoped to that restaurant and, if supplied, branch.

## Runtime shape

The local API listens on port 4000 and web dev server on 3000. PostgreSQL runs through Docker Compose. Database schema evolution uses Prisma Migrate. There is no Socket.IO implementation in this checkout. Customer tracking synchronizes persisted order state with a cookie-authorized polling endpoint and refreshes promptly when the browser tab becomes visible.

## Customer ordering flow

`/q/:opaqueToken → customer QR router → SHA-256 digest lookup → active QR/table/branch/restaurant check → branch-filtered menu → guest cart → idempotent transaction → private order cookie → tracking poll`.

Customer-facing menu IDs are public UUIDs generated separately from internal cuid keys. The QR token determines all tenant and table context. The browser does not submit tenant/table identifiers or prices. Checkout reloads active menu items and available modifier options, applies database prices with Prisma Decimal, locks the dining table row, reuses or creates its open `TableSession`, and writes order snapshots and the initial event atomically. Staff status changes use authenticated tenant scope and persist an event before returning the new state.

Customer UI translations are loaded through next-intl. Restaurant content comes from separately stored menu/category/modifier translations, with the English/base value used when a translation is absent. Ingredient and allergen fields are never translated by fallback logic; a restaurant must supply reviewed text for those fields.

## Waiter and kitchen service flow

`/waiter → waiter membership → selected restaurant/branch context → branch-scoped dashboard poll → audited order/assistance transitions`.

The waiter dashboard polls every five seconds while visible and less often in a background tab, and refreshes when the tab becomes active. It shows incoming orders, active tables and shared sessions, guest assistance, and recent history. Waiters can confirm/reject pending orders (rejection requires a reason) and mark ready orders served.

`/kitchen → KITCHEN membership → selected restaurant/branch context → confirmed-ticket queue poll → item readiness transactions`.

The kitchen queue includes only confirmed, preparing, and ready orders and returns only kitchen-relevant fields. Kitchen staff start confirmed tickets, then mark individual items ready; the service updates an order to `READY` only after every item is ready. Item events and order events retain status, actor, and time. Tickets over 15 minutes are highlighted. Cancelling a started ticket requires a reason and appears in the kitchen's recent-change feed for 30 minutes, while cancelled tickets leave the active lanes. Kitchen status changes are visible to waiters and guests through their existing polling APIs. Exact session totals remain in the waiter dashboard; serving and payment are separate workflows.

The shared status endpoint cannot set `PREPARING` or `READY`; those transitions use the kitchen service so order status cannot drift from item readiness. Cancellation remains a staff operation, requires a reason, and is kept in order history and the kitchen change feed. Existing orders already in preparation or later states are backfilled to matching item states by the Phase 5 migrations.

Socket.IO was evaluated and not added: the persisted API polling path already supports guest, waiter, and kitchen synchronization without introducing another server/runtime dependency.

## Restaurant management flow

`/manage → authenticated identity → accessible restaurant list → X-Restaurant-Id / optional X-Branch-Id → role middleware → management controller/service/repository → Prisma`.

The API derives scope from the signed-in user's active membership or explicit platform-admin status. Owners onboard restaurants and assign staff; owners/managers maintain the permitted operational content. A QR rotation revokes prior active tokens before issuing a new random token, so existing printouts stop resolving. QR images are produced in the browser from the currently opened web origin; for phone scanning, open the workspace through a LAN-reachable address before printing.

## Cashier and reporting flow

`/cashier → CASHIER/owner/manager membership → branch-scoped open-session list → locked payment transaction → Decimal allocations → order payment-status aggregation → payment audit`.

Payments are separate records from order lifecycle status. A physical payment locks its `TableSession`, checks outstanding balance under the lock, prevents a duplicate idempotency key, allocates oldest-first to eligible orders, and writes the cashier identity and audit row in the same serializable transaction. An audited owner/manager void reverses allocations without deleting the original ledger row. Session closure requires zero balance and all remaining active orders served/closed, then records order closure events and `closedAt` atomically. No payment provider is enabled.

`/analytics → owner/manager tenant membership → date/branch-filtered repository aggregates → report DTO`.

Reports distinguish cash actually received from order totals and use the restaurant timezone for daily revenue grouping. Platform account listing/status endpoints use platform-admin-only middleware and do not expose order/customer details. Branch operating hours are persisted as one local-time opening interval per weekday.
