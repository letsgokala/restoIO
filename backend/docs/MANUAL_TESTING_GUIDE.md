# Local Manual Testing Guide

This guide walks through the seeded demo restaurant and the main staff workflows. It targets local development and does not use real payment credentials. Use a second phone or browser profile for the guest QR flow.

## A. Environment setup

### Requirements

- Node.js 20 or newer and npm.
- Docker with Docker Compose.
- A modern browser. Playwright E2E also uses Chromium.

The repository root intentionally contains only `backend/` and `frontend/`. Environment files and installed packages stay inside those folders.

### Configure local environment

In a terminal from the repository root:

```bash
cd backend
cp .env.example .env
```

The example file uses the local PostgreSQL Docker service on port `55432`. Keep these values for the default setup:

```dotenv
DATABASE_URL=postgresql://restoio:restoio_dev@localhost:55432/restoio?schema=public
WEB_ORIGIN=http://localhost:3000
QR_TOKEN_ENCRYPTION_KEY=replace-with-a-random-secret-of-at-least-32-characters
SEED_ADMIN_EMAIL=admin@demo.local
SEED_ADMIN_PASSWORD=ChangeMe_OnlyForLocalDev_123!
```

Replace `QR_TOKEN_ENCRYPTION_KEY` with a stable random value of at least 32 bytes for a long-lived local database. Changing it prevents old encrypted QR credentials from being reprinted, though issued QR tokens continue to resolve. Never use these sample credentials or the predictable development QR outside local development.

In another terminal, configure the frontend:

```bash
cd frontend
cp .env.example .env.local
```

The default API address is `http://localhost:4000/api/v1`.

### Start the database and initialize data

From `backend/`:

```bash
docker compose up -d postgres
npm ci
npm run db:deploy
npm run db:seed
```

Expected results include a healthy PostgreSQL container, `All migrations have been successfully applied`, and a seed message naming Blue Nile Café, Bole Branch, demo staff accounts, and the local Table 01 QR URL.

Install frontend dependencies once from `frontend/`:

```bash
npm ci
```

### Start API and web app

Use one terminal per process.

Terminal 1:

```bash
cd backend
npm run dev
```

Expected: API listening on port `4000`.

Terminal 2:

```bash
cd frontend
npm run dev
```

Expected: Next.js ready at `http://localhost:3000`.

The backend terminal prints one JSON line for each API request. It includes the method, redacted path, HTTP status, duration, and request ID. Request bodies, cookies, and guest QR tokens are not logged. The frontend terminal shows Next.js page requests and compilation output.

Open `http://localhost:3000`. Check API readiness with:

```bash
curl -i http://localhost:4000/api/v1/health
```

Expected: HTTP 200 and a small JSON health response.

## B. Demo accounts

Every seeded account uses the value of `SEED_ADMIN_PASSWORD` in `backend/.env`. The example default is `ChangeMe_OnlyForLocalDev_123!`. Set your own local value before running the seed if you prefer. The seed never runs when `NODE_ENV=production`.

| Email | Role | Restaurant / branch | Workspace and test |
| --- | --- | --- | --- |
| `admin@demo.local` | Platform administrator | Platform-wide | `/platform`: inspect account status; `/manage`: provision a restaurant and owner. Email follows `SEED_ADMIN_EMAIL`. |
| `owner@blue-nile.demo.local` | Restaurant owner | Blue Nile Café, all branches | `/manage`: profile, branches, team, hours, tables, QR codes, and menu; `/analytics`: database-backed reports. |
| `waiter@blue-nile.demo.local` | Waiter | Blue Nile Café, Bole Branch | `/waiter`: accept/reject orders, handle assistance, and mark ready orders served. |
| `kitchen@blue-nile.demo.local` | Kitchen | Blue Nile Café, Bole Branch | `/kitchen`: start confirmed tickets and mark individual items ready. |
| `cashier@blue-nile.demo.local` | Cashier | Blue Nile Café, Bole Branch | `/cashier`: inspect consolidated bills, record offline payments, review history, and close paid sessions. |

Restaurant staff password comes from the same `SEED_ADMIN_PASSWORD` setting. These accounts are local fixtures, not production accounts.

## C. QR code testing

### Open the seeded QR without printing

Visit this demo URL in the browser:

```text
http://localhost:3000/q/demo-table-01-qr-token-for-local-development-only
```

It resolves to Blue Nile Café → Bole Branch → Table 01. The QR is deliberately predictable for local testing only.

### Generate and print a table QR

1. Sign in as the owner and open `/manage`.
2. Select **Tables & QR**.
3. Create a table if needed, selecting the intended branch.
4. Use the table action to generate a QR code.
5. Download the QR image or use **Print QR codes** to open the browser print sheet.
6. Open the generated `/q/<opaque-token>` destination in a new browser tab to verify its restaurant, branch, and table.
7. Deactivate that code or generate a replacement. The old QR should return an unavailable page; the new one should resolve.

For a phone on the same Wi-Fi, configure the computer's LAN address consistently:

```dotenv
# backend/.env
WEB_ORIGIN=http://YOUR-LAN-IP:3000
```

```dotenv
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://YOUR-LAN-IP:4000/api/v1
```

Then restart both servers, run the frontend with `npm run dev -- --hostname 0.0.0.0`, and generate the QR while browsing the management app through `http://YOUR-LAN-IP:3000`. The current Next.js development configuration allows `192.168.1.9`; if your LAN IP differs or changes, update `allowedDevOrigins` in `frontend/next.config.ts` and restart Next. Permit ports 3000 and 4000 through the local firewall and keep the phone on the same network. A physically printed QR is not required; open the URL on the phone camera or share the URL to the phone.

## D. Feature-by-feature manual checks

### Platform account management

1. Sign in as `admin@demo.local`, then open `/platform`.
2. Confirm Blue Nile Café appears with owner and branch counts.
3. Suspend it, then sign in or use an owner session to request a tenant API resource. The backend should reject tenant access while suspended.
4. Reactivate it. Owner access should work again.
5. Open `/manage` as the platform account and create a test restaurant with a unique slug, owner email, and password. The owner should be able to sign in and see only that restaurant.

### Restaurant settings, branches, and operating hours

1. Sign in as the owner and open `/manage` → **Restaurant**. Update the restaurant name, description, contact, currency, and timezone; save and confirm the values persist after refresh.
2. Open **Branches** and add a second branch. Edit its address and deactivate/reactivate it.
3. Set each day's opening and closing times. Mark a day closed and save. Refresh and verify all seven settings persist.
4. Assign a branch manager and verify that manager cannot edit another branch's hours or data.

Hours support one opening interval per day in the configured restaurant timezone. Overnight intervals and split shifts are not currently supported.

### Staff and authorization

1. Open **Team** and create a waiter, kitchen user, and cashier assigned to a branch.
2. Sign into each account in a separate private window and confirm the role-specific route opens.
3. As kitchen staff, request `/api/v1/tenant/cashier/sessions` with the restaurant and branch headers. Expected: 403.
4. As waiter, request `/api/v1/tenant/analytics`. Expected: 403.
5. Change `X-Restaurant-Id` to another tenant or `X-Branch-Id` to an unassigned branch. Expected: access denied or record not found, with no other tenant data returned.

### Menu and translations

1. In `/manage` → **Menu**, create a category and item with price, description, ingredients, allergens, and image URL.
2. Add translations using locale codes `am`, `en`, `ar`, `zh`, `tr`, `es`, or `de` and add at least one modifier group and option.
3. Open the table QR and select the language. Confirm translated item/category/modifier labels appear where supplied and base English content is used as fallback.
4. Disable item availability for the selected branch and refresh the customer menu. The item should not be orderable.
5. Change menu price or name after placing an order. The old order ticket should retain its original item-name and price snapshots.

Customer interface strings exist for all seven listed locales, but translations have not had a professional linguistic review. RTL behavior is implemented for Arabic and should be manually reviewed on a real mobile browser. Image fields accept external image URLs; this checkout has no managed upload/storage provider. Use a trusted HTTPS image host and do not place storage credentials in the frontend.

### Guest ordering and tracking

1. Open Table 01's QR in a guest browser with no staff sign-in.
2. Browse the menu, select a language, open Doro wat, choose **Extra injera**, enter a preparation instruction, add it to the cart, and submit.
3. Confirm an order reference and private tracking page are shown. A new guest browser should not be able to read that order using its reference alone.
4. Open the same QR in a second browser/device and submit another order. Confirm it receives another order reference and joins the same open table session.
5. Select **Request a waiter** and track the acknowledgement/handled status on that guest browser.
6. Use **Request bill** to create a bill assistance request. The cashier still records payment only after the restaurant receives it.

### Waiter operations

1. Sign in as the waiter and open `/waiter`.
2. Search for the two new order references, review each, and accept them.
3. Try to reject a pending test order without a reason; the API should reject it. Supply a reason to reject it.
4. Open **Assistance**, acknowledge a request, then mark it handled. Confirm guest tracking updates.
5. After the kitchen marks orders ready, mark them served. Confirm guest tracking reports service and table session remains open until cashier closeout.

### Kitchen operations

1. Sign in as kitchen staff and open `/kitchen`.
2. Confirm only waiter-accepted tickets appear. Pending customer orders must not appear in the active lanes.
3. Start preparation and confirm waiter and guest status update.
4. Mark one item ready on an order containing multiple items. The order must stay `PREPARING` until every item is ready.
5. Mark the remaining items ready. The ticket moves to **Ready for pickup** and remains in the ready queue until service advances it.
6. Kitchen staff should not have access to cashier, owner settings, or served/closed order transitions.

### Cashier and consolidated payment

1. Sign in as cashier and open `/cashier`.
2. Select the table session. Confirm all non-rejected/non-cancelled orders are included and the total, paid amount, and balance are displayed.
3. Enter an amount smaller than the balance and record it as cash. Confirm the balance drops and a payment-history row includes method, actor, time, and allocation.
4. Try to record more than the balance. The server should reject it even if a client request is manually constructed.
5. Record the remaining amount. Confirm balance is zero.
6. Try to close before all orders are served; the server should reject the close. Once all are served and the balance is zero, close the session.
7. Reuse a payment idempotency key with the same request and verify no duplicate payment is created. Reuse it with a different amount/session and expect a conflict.
8. Owner/manager can void a mistaken physical payment with a reason. Cashier cannot void a payment. The void is retained in the payment ledger and audit history.

Chapa and Telebirr online checkout are intentionally disabled until a merchant account, current credentials, and verified provider configuration are available. The cashier currently records offline payments only; do not use test data as evidence of an online settlement.

### Reports and analytics

1. Sign in as owner and open `/analytics` from management.
2. Select a date range and branch. Confirm reported values change with the filter.
3. Compare payment-received totals with payment history. Unpaid order value should not be counted as cash received.
4. Check empty date ranges. The dashboard should show explicit empty states and zero values.
5. Attempt the analytics endpoint as waiter or kitchen. Expected: 403.

### Platform administration

1. Sign in as the platform admin and open `/platform`.
2. Verify restaurant owner and account status without opening tenant customer records.
3. Suspend/reactivate a disposable test tenant, then verify tenant staff lose/regain backend access.
4. Verify a restaurant owner receives 403 from `/api/v1/platform/restaurants`.

## E. Complete demo simulation

1. As owner, confirm Table 01 exists and its QR resolves. Ensure Doro wat and Shiro are available at Bole.
2. As Guest A, submit one Doro wat with Extra injera. Its demo total should be ETB 505.00. Save the reference.
3. As Guest B on another phone/browser, submit one Shiro. Save its reference. The backend should associate both with the same active TableSession for Table 01.
4. As waiter, accept both references. They become `CONFIRMED`.
5. As kitchen, start both orders and mark their items ready. Orders transition through `PREPARING` to `READY` only when all their items are ready.
6. As waiter, mark both orders served. Guest pages should show served; orders are not yet paid just because they were served.
7. As cashier, open the Table 01 session. The consolidated total should equal the two order totals (ETB 505 + the Shiro price shown in the menu). Record a partial cash payment, confirm the remaining balance, and record the rest.
8. Close the session. Served orders become `CLOSED`; the session no longer appears in the open cashier list.
9. As owner, open `/analytics` and select the relevant date and Bole branch. Confirm payment received matches the payment ledger and the orders/menu items appear in actual report results.

Existing open demo sessions may add older orders to the bill. Use a fresh table or close old sessions first when you need the exact two-order total.

### Test real owner setup without demo seed data

1. Start with a migrated database that has no seeded restaurants. Open `/register`, create Restaurant A's owner account, then sign in and confirm the new workspace has one branch, no tables, and no menu categories.
2. Create six tables in that branch. Add a category and menu dishes, make them available at the branch, then generate and download a separate QR for each table.
3. Create waiter and kitchen staff accounts for the branch. Open each staff workspace in a separate browser profile.
4. Scan five different table QR codes using phones or browser profiles. Place at least one order from each table. Confirm each guest sees its own private tracking link and the waiter sees all five orders for Restaurant A.
5. Accept the orders as waiter. Confirm only accepted orders appear in the kitchen queue, prepare items independently, and verify each guest and waiter view updates as items/orders progress.
6. In another private browser profile, register Restaurant B with a different owner email and restaurant slug. Give it its own branch, menu, staff, tables, and QR codes; place an order there while Restaurant A orders remain active.
7. Confirm Restaurant B's owner, waiter, and kitchen see only Restaurant B's records, while Restaurant A staff continue seeing only Restaurant A's records. Try using Restaurant A's restaurant/branch IDs with Restaurant B's sessions and verify the API denies access.
8. Sign in to both owner accounts and verify each can independently add branches and staff. A fresh production database must not need the Blue Nile seed or a platform-admin account for these owner flows.

For internet deployment, phones can use cellular data or any Wi-Fi with internet access. They do not need to be connected to the network hosting the application. The QR URL must use the public HTTPS frontend domain, and that frontend must use the public HTTPS API URL.

## F. Automated verification commands

From `backend/`:

```bash
npm run typecheck
npm test -- --reporter=dot
npm run build
npx prisma migrate status --schema prisma/schema.prisma
```

From `frontend/`:

```bash
npm run typecheck
npm test -- --reporter=dot
npm run build
CHROME_BIN=/usr/bin/google-chrome npm run test:e2e
```

Playwright needs the local PostgreSQL database, the migrations, and seed data to be available. It starts the local API and frontend development servers itself unless existing servers are already listening.

## G. Production deployment and operations

This repository has local Docker Compose for PostgreSQL, not production-ready application container images or an automated deployment pipeline. Deploy the Express API and Next.js app to managed HTTPS-capable services and use a managed PostgreSQL database or a separately operated PostgreSQL service.

Set backend environment variables on the server only:

- `NODE_ENV=production`
- `DATABASE_URL` for the production PostgreSQL connection.
- `PORT` is read automatically by the API on managed hosts; set `API_PORT` only if the host requires a different fixed port.
- `WEB_ORIGIN=https://your-web-domain` (exact origin, no path).
- `SESSION_COOKIE_NAME` and `SESSION_TTL_HOURS` as required by session policy.
- `QR_TOKEN_ENCRYPTION_KEY` as a stable secret of at least 32 bytes.
- `PLATFORM_ADMIN_BOOTSTRAP_TOKEN` as a random secret of at least 32 characters during initial setup only; remove it after creating the first platform administrator.

For Vercel + AletCloud, set frontend `NEXT_PUBLIC_API_URL=/api/v1` and `BACKEND_ORIGIN=https://your-api-origin` at build time. The Next.js rewrite proxies API requests while keeping staff cookies same-origin. Keep database and QR encryption secrets on the backend only. Chapa and Telebirr credentials are not implemented/configured and must not be added to frontend environment variables.

After deploying the public frontend and API, the first platform administrator bootstraps once at `/platform/bootstrap` using the backend's `PLATFORM_ADMIN_BOOTSTRAP_TOKEN`. Remove that token from the backend environment after setup. A cafe can then submit a signup request at `/register`; it remains pending until the platform administrator approves it at `/platform`. The owner can sign in after approval and create tables, menu content, and staff from `/manage`. Do not run `npm run db:seed` in production. Registration is IP-rate-limited, but email verification, approval email, and bot protection are not configured.

Customers do not need the server's private network. Anyone with internet access can scan a QR code over cellular data or Wi-Fi after DNS and HTTPS are configured. The QR must point to the public frontend URL; the frontend must call the public API URL; only the API should connect to PostgreSQL. Do not expose the database port to the internet.

Deployment outline:

1. Provision PostgreSQL and create a least-privilege application database user.
2. Configure secrets and exact frontend origin in backend hosting settings; configure the API URL in frontend build settings.
3. Build the backend with `npm ci` and `npm run build`. The build generates and packages the Prisma client into `dist/`. The production start command runs `npm run db:deploy` before starting the API.
4. Run the backend with `npm start`; it binds to `0.0.0.0` and uses the platform's `PORT` value.
5. Build and run the frontend with `npm run build` and `npm start`.
6. Configure DNS, HTTPS certificates, health checks at `/api/v1/health`, and secure inbound network rules. The API sets staff cookies as `Secure` in production.
7. Bootstrap the first platform administrator through `/platform/bootstrap` using the backend's one-time token, then remove the token from backend environment settings.
8. Submit a restaurant application at `/register`; verify it appears as `PENDING` at `/platform` and its owner cannot sign in yet. Approve it, then verify the owner can sign in and set up tables, menu, and staff. Do not run the development seed against production.
9. Test account creation, approval, login, tenant isolation, guest checkout, automatic migrations, backups, and restore on staging before opening a pilot.

Before changing a production schema, take a database snapshot and run the exact migration on staging. Rollback procedure: stop writes, restore the pre-deployment database backup to a new/known-good database, redeploy the previous application build, point the application to the restored database, verify health and sample records, then reopen traffic. Prisma migrations are forward-only here; do not delete rows or edit `_prisma_migrations` to force a rollback.

Example logical backup/restore (store the backup outside the app folders and protect it):

```bash
pg_dump --format=custom --no-owner --file=restoio-YYYYMMDD.dump "$DATABASE_URL"
createdb restoio_restore_check
pg_restore --dbname=restoio_restore_check --no-owner restoio-YYYYMMDD.dump
```

Test restoration regularly and define retention/encryption for the hosting provider. This project does not configure managed image storage, shared rate-limit storage, centralized monitoring, external push notifications, or online payment providers. These need production service choices and credentials before a production launch.

## H. Troubleshooting

| Symptom | Checks |
| --- | --- |
| Database connection error | `docker compose ps`, `docker compose logs postgres`, confirm port `55432`, then check `DATABASE_URL` in `backend/.env`. |
| Migration says pending | Run `npm run db:deploy` from `backend/`; inspect `npx prisma migrate status --schema prisma/schema.prisma`. Do not use `migrate reset` on data you need. |
| Seed/login password mismatch | Verify `SEED_ADMIN_PASSWORD` in `backend/.env`, rerun `npm run db:seed` locally, and use that value for every seeded demo staff account. |
| Missing QR encryption key | Local seed has a dev default; set `QR_TOKEN_ENCRYPTION_KEY` in `backend/.env`. Production startup requires a configured 32-byte key. |
| Invalid QR | Check the exact token URL, restaurant/branch/table active state, and whether the QR was rotated or revoked. A rotated code invalidates the old printed destination. |
| Guest order absent from waiter/kitchen | Waiter must first accept the pending order; kitchen only receives accepted tickets. Check branch assignment and selected branch in both dashboards. |
| Dashboard not refreshing | Keep the tab visible, use its refresh control, verify both API and web servers, and check browser Network for `/api/v1/tenant/...` errors. Polling pauses/throttles in background tabs. |
| Cashier cannot close session | Balance must be zero and every non-cancelled/non-rejected order must be served or already closed. Void a mistaken payment only as owner/manager with a reason, then record the correct amount. |
| Analytics is empty | Expand the date range, confirm the correct branch, and remember that sales revenue counts completed payment records rather than order totals. |
| Chapa/Telebirr payment fails | Online provider checkout is not enabled in this build. Physical cashier payments are the locally testable method. Do not treat redirect URLs or manual references as proof of settlement. |
| Build/test fails after dependency changes | Run `npm ci` inside the affected app folder, then repeat `npm run typecheck`, tests, and build. Keep the lockfile in sync with `package.json`. |

## Current pilot assessment

Guest QR ordering, waiter operations, kitchen preparation, physical cashier payments, session closeout, branch-scoped management, basic operating hours, reporting, and platform account status have local backend/browser coverage. This is suitable for a supervised local or staging pilot with offline payments after the full test suite passes. It is not ready for an unsupervised production rollout until online payment provider access, managed image storage, production provisioning/deployment, shared rate-limit storage for scale, and external monitoring/backup operations are configured and tested.
