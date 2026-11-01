# RestoIO

Multi-tenant restaurant ordering and operations platform. The repository contains only two top-level project folders: `backend/` and `frontend/`. Database schema, migrations, development seed, Docker Compose configuration, and project documentation are inside `backend/`.

## Requirements

- Node.js 20.9 or newer and npm 10+
- Docker Engine with Docker Compose

## Local setup

In a terminal:

```bash
cd backend
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>. The guest ordering demonstration is at <http://localhost:3000/q/demo-table-01-qr-token-for-local-development-only> (Blue Nile Café, Bole Branch, Table 01). The API is available at <http://localhost:4000/api/v1/health>; staff sign-in is at <http://localhost:3000/login>.

While running locally, the backend terminal prints one JSON access line per API request with method, redacted path, status, duration, and request ID. It does not log request bodies, cookies, or guest tokens. Next.js development server output appears in the frontend terminal.

PostgreSQL runs on host port `55432` to avoid common local PostgreSQL port conflicts. Adjust `DATABASE_URL` in `backend/.env` and the host mapping in `backend/docker-compose.yml` if that port is unavailable.

The seed creates a fictional Blue Nile Café at its Bole branch, five tables, three sample menu items, a local-only QR for Table 01, demo owner, waiter, kitchen, and cashier accounts, and one development platform administrator. Doro wat includes a sample optional extra-injera modifier for checkout and kitchen ticket previews. Menu image fields accept external URLs. Configure local staff credentials with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `backend/.env`; seeded restaurant staff use the same development password. Example credentials and the predictable demo QR are development-only. Seeding refuses to run when `NODE_ENV=production`.

### Try restaurant management

1. Sign in at <http://localhost:3000/login> using `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `backend/.env` (defaults: `admin@demo.local` / `ChangeMe_OnlyForLocalDev_123!`).
2. Open <http://localhost:3000/manage>, choose **Create restaurant**, and provide the owner name, email, and a temporary password. The platform administrator account creates the tenant and its first branch.
3. Sign out and sign in with the new owner email/password. In `/manage`, add branches and staff, then create a table under a branch and choose **Generate QR**.
4. Add a menu category and dish. Enter reviewed translations, ingredients/allergens, modifiers, and the branches where the dish is available. Download the table QR or print the QR sheet.
5. Open the guest link or scan the QR with a phone. The phone must be able to reach the web and API servers. For LAN testing, use the computer's LAN IP consistently: set `WEB_ORIGIN=http://<LAN-IP>:3000` in `backend/.env`, set `NEXT_PUBLIC_API_URL=http://<LAN-IP>:4000/api/v1` in `frontend/.env.local`, restart both servers, and start Next with `npm run dev -- --hostname 0.0.0.0`. The current development IP `192.168.1.9` is allowed in `frontend/next.config.ts`; if your LAN IP changes, update `allowedDevOrigins` there too and restart Next. Open `/manage` through `http://<LAN-IP>:3000` before generating/printing QR codes so the code contains a phone-reachable host. Keep the phone on the same Wi-Fi and allow ports 3000 and 4000 through the computer firewall.

The demo owner is `owner@blue-nile.demo.local` and uses the same development seed password. The seed's Table 01 QR is a local fixture; newly issued management QR tokens are random and old tokens stop working when rotated.

### Try the waiter dashboard

1. Seed the local data with `cd backend && npm run db:seed`.
2. Sign in at <http://localhost:3000/login> with `waiter@blue-nile.demo.local` and the `SEED_ADMIN_PASSWORD` value (default: `ChangeMe_OnlyForLocalDev_123!`). Waiter accounts open `/waiter` after sign-in.
3. Open the demo Table 01 QR link above in another browser or on a phone and submit an order. It appears in the waiter's order desk, which refreshes every five seconds while visible.
4. Review and accept it as the waiter. Kitchen staff prepare it in `/kitchen`; the waiter can then mark it served. Table sessions stay open across orders.

### Try the kitchen display

1. Seed the local data with `cd backend && npm run db:seed`.
2. Sign in at <http://localhost:3000/login> as `kitchen@blue-nile.demo.local`, using the same development seed password. Kitchen accounts open `/kitchen`.
3. Submit a guest order through the demo Table 01 QR and accept it in `/waiter`. Only then does it enter the kitchen's **New tickets** lane.
4. Start preparation, mark individual items ready, or mark remaining items ready. The order stays in preparation until every item is ready, then moves to **Ready for pickup**. The waiter can mark it served; kitchen staff cannot.

### Try cashier, payments, and reports

1. Sign in as `cashier@blue-nile.demo.local` with the development seed password and open `/cashier`.
2. Review a consolidated table session, record physical payments only after money is received, and close when the balance is zero and all active orders are served.
3. Restaurant owners/managers can void a mistaken entry with a reason; cashiers cannot void payments.
4. Sign in as owner and open `/analytics` for date and branch filtered database-backed reports.

Platform administrators land at `/platform` to view and suspend/reactivate restaurant accounts. Restaurant provisioning remains available from `/manage`.

### Production onboarding without demo seed data

Production restaurants do not depend on `npm run db:seed`. Apply the Prisma migrations, deploy the API and web app, then visit `/register` to create a real restaurant owner account, the restaurant workspace, and its first branch. The owner is signed in and sent to `/manage`, where they can add branches, staff, menu categories and dishes, tables, and QR codes. Empty workspaces show setup guidance, and a customer QR menu with no published dishes explains that the restaurant has not published its menu yet. `db:seed` is for local development only and refuses to run in production.

Public registration is limited to five attempts per IP per hour and requires a 12-character password. Email verification and bot protection are not configured yet; add those controls before broadly advertising public signup.

For internet access, host the frontend and API at public HTTPS addresses, set `NEXT_PUBLIC_API_URL` to the public API `/api/v1` address, and set backend `WEB_ORIGIN` to the exact public frontend origin. Use frontend and API subdomains under the same site so the strict session cookie works in staff browsers. Configure the QR generator to use that public frontend origin so printed codes work outside your office or restaurant Wi-Fi. Customers can scan over mobile data or any Wi-Fi with internet access; they do not need to join the server's private network. Keep PostgreSQL private and expose only the web and API services.

Chapa and Telebirr provider interfaces are scaffolded but online checkout is disabled pending merchant credentials and tested provider adapters. Managed image storage is not configured; use HTTPS image URLs. See [`docs/MANUAL_TESTING_GUIDE.md`](docs/MANUAL_TESTING_GUIDE.md) for the full walkthrough and deployment/backup steps.

## Commands

Run backend commands from `backend/`:

```bash
npm install
npm run dev
npm run db:generate
npm run db:migrate -- --name describe_your_change
npm run db:deploy
npm run db:seed
npm test
npm run typecheck
npm run build
```

`npm run build`, `npm run typecheck`, and `npm test` generate the Prisma client automatically. The production build also copies it into `dist/`; run the API with `npm start` after the build. Managed hosts should run `npm run db:deploy` as their pre-deploy migration command, and must build with the Prisma CLI available.

Run frontend commands from `frontend/`:

```bash
npm install
npm run dev
npm test
npx playwright install chromium
npm run test:e2e
npm run typecheck
npm run build
```

For disposable local data only, `docker compose down -v` removes the database volume and all its data.

## API

- `GET /api/v1/health`: API readiness response; `/health` redirects here.
- `POST /api/v1/auth/login`: validates credentials and sets an HTTP-only session cookie.
- `POST /api/v1/auth/register-restaurant`: rate-limited public onboarding that creates a restaurant owner account, first restaurant, and first branch atomically; it does not create demo data.
- `GET /api/v1/auth/me`: returns the signed-in staff profile.
- `POST /api/v1/auth/logout`: revokes the session and clears its cookie.
- `GET /api/v1/tenant/context`: requires a session and `X-Restaurant-Id`, with optional `X-Branch-Id`.
- `GET /api/v1/tenant/management-context`: demonstrates owner/manager role authorization.
- `GET /api/v1/management/restaurants`: lists restaurant workspaces available to the signed-in user.
- `POST /api/v1/platform/restaurants`: platform-admin onboarding; creates a restaurant, first branch, owner account, and owner membership atomically.
- `POST /api/v1/management/restaurants`: lets an active restaurant owner create an additional workspace for their account.
- `/api/v1/tenant/restaurant`: `GET` and `PATCH` restaurant details/settings and branding URLs (owner/manager).
- `/api/v1/tenant/branches`: `GET`, owner-only `POST`; `/branches/:branchId` supports owner-only `PATCH` and safe `DELETE`.
- `/api/v1/tenant/branches/:branchId/hours`: `GET` and `PUT` weekly opening intervals; tenant and branch scoped.
- `/api/v1/tenant/staff`: `GET`, owner-only `POST`; `/staff/:membershipId` supports owner-only role/branch/status `PATCH`.
- `/api/v1/tenant/tables`: `GET`, `POST`, `PATCH`, and safe `DELETE`; owner/manager.
- `/api/v1/tenant/tables/:tableId/qr`: `POST` generates or rotates a QR. `DELETE /qr/:qrId` revokes an active QR. Owner/manager.
- `/api/v1/tenant/menu`: `GET` categories and content; `/menu/categories` and `/menu/items` support create/edit/archive operations. Owner/manager.
- `GET /api/v1/customer/qr/:token`: validates the QR and returns public restaurant, branch, and table context.
- `GET /api/v1/customer/qr/:token/menu?locale=en`: lists branch-available menu items with requested translations or base-language fallback.
- `POST /api/v1/customer/qr/:token/orders`: validates items/modifiers, recalculates prices, reuses the open table session, and creates an idempotent guest order.
- `GET /api/v1/customer/orders/:reference`: reads an order only with its scoped HTTP-only guest cookie.
- `POST /api/v1/customer/qr/:token/assistance`: requests a waiter, bill, or general help and sets a private status cookie.
- `GET /api/v1/customer/assistance/:reference`: reads only that request's status using its scoped HTTP-only guest cookie.
- `GET /api/v1/tenant/waiter/dashboard`: waiter-only order queue, active tables/open sessions, and assistance requests, scoped to the selected restaurant and branch. Optional `status`, `tableId`, `date`, and `search` query filters are supported.
- `PATCH /api/v1/tenant/waiter/assistance/:requestId`: waiter acknowledges or resolves a request; actor and timestamps are recorded.
- `PATCH /api/v1/tenant/orders/:reference/status`: authenticated, tenant-scoped waiter/cashier transition. Waiters confirm/reject with a reason or mark ready orders served; cashiers close paid orders. Preparation states are advanced only through the kitchen workflow below.
- `GET /api/v1/tenant/kitchen/queue`: kitchen-only queue, filtered to the selected restaurant and branch; includes only confirmed, preparing, and ready tickets and omits customer financial data.
- `PATCH /api/v1/tenant/kitchen/orders/:reference/start`: begins a confirmed ticket and records order/item preparation events.
- `PATCH /api/v1/tenant/kitchen/orders/:reference/items/:itemId/ready`: marks one item ready and updates its event history; the order becomes ready only when all items are ready.
- `PATCH /api/v1/tenant/kitchen/orders/:reference/ready-remaining`: marks all unfinished items ready and completes the order.
- `GET /api/v1/tenant/cashier/sessions` and `GET /sessions/:sessionId`: cashier/owner/manager consolidated open-table bills.
- `POST /api/v1/tenant/cashier/sessions/:sessionId/payments`: records an idempotent offline payment, allocated to oldest outstanding orders using Decimal arithmetic.
- `POST /api/v1/tenant/cashier/sessions/:sessionId/close`: closes a fully paid session after its active orders are served.
- `POST /api/v1/tenant/cashier/payments/:paymentId/void`: owner/manager audited reversal with a reason.
- `GET /api/v1/tenant/analytics?from=<ISO>&to=<ISO>&branchId=<id>`: owner/manager date-range and permitted-branch reports.
- `GET /api/v1/platform/restaurants` and `PATCH /api/v1/platform/restaurants/:restaurantId/status`: platform-admin restaurant account list and activate/suspend.

API routes are versioned under `/api/v1`; error responses include stable codes and request IDs.

## Project structure

```text
backend/
  src/          Express API and layered modules
  prisma/       PostgreSQL schema, migrations, and seed
  docs/         Product, architecture, data, security, and roadmap docs
  docker-compose.yml
  package.json
frontend/
  src/          Next.js App Router and feature-based UI
  e2e/          Playwright browser checks
  package.json
```

Core restaurant management, guest ordering, waiter service, kitchen preparation, offline cashier payments, session closeout, platform account status, branch hours, and initial analytics are implemented and locally verified. Guest tracking and staff dashboards use polling; Socket.IO is not used. Online Chapa/Telebirr adapters, managed image storage, production deployment automation, centralized monitoring, and shared rate-limit storage remain incomplete. See `backend/docs/MANUAL_TESTING_GUIDE.md` for test steps and `backend/docs/ROADMAP.md` for limits.
