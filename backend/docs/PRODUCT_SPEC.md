# Product specification

## Product

RestoIO is a multi-tenant restaurant ordering and operations SaaS for Ethiopian restaurants and cafés. Restaurants manage their own profile, branches, staff, tables, QR entry points and operational data. Guests open a table menu without creating an account. Staff use role-specific tools to manage service.

## Phase 1 scope

The foundation established the repository, tenant and staff identity model, secure staff sign-in, API conventions, local PostgreSQL environment, seed fixture and starter web pages. Platform administrators can provision restaurants; public cafe signup requests remain pending until a platform administrator approves them. The `/manage` workspace lets restaurant owners manage their restaurant profile and settings.

## Phase 2 restaurant management

Owners manage branches, staff roles and branch assignments, tables, QR issuance, restaurant branding/settings, menu categories/items, reviewed translations, modifiers, and branch availability. Managers can maintain tables and QR codes within their assigned branch. Restaurant-wide managers can also maintain restaurant settings and menu content. Staff permissions and branch scope are enforced by the API. Operational records with history are deactivated or archived rather than deleted. QR tokens are random, stored as a digest for lookup and encrypted for authorized reprinting. See `docs/SECURITY.md` for QR key handling.

## Phase 3 customer ordering

Guests scan an opaque QR link and enter a menu for the exact restaurant, branch, and table. Accounts are not required. Restaurants can issue and manage table QR links and the menu content they resolve to. The development seed also supplies a local demo restaurant, QR, and sample dishes.

Guests can search and filter restaurant menu categories, see branch availability, choose modifiers and special instructions, preserve a per-QR cart, select one of seven UI languages, submit a checkout note, and track an order. Checkout is pay-at-restaurant (`UNPAID`). Guest order tracking polls with a scoped HTTP-only cookie. Guests can also track their own waiter/bill/help requests with a separate scoped HTTP-only cookie. Socket.IO is not present; customer and waiter status updates use polling.

## Phase 5 kitchen operations

Branch-assigned kitchen staff use `/kitchen` to work only accepted tickets. Starting a ticket marks its items as preparing. Items can become ready independently; the order status moves to ready only when every item is ready. Each item transition records an actor and timestamp. Waiter and guest workspaces see persisted order changes through polling. Kitchen staff cannot serve, close, or access payment fields. Cancelling a started order requires a reason and leaves a visible recent-change notice for kitchen staff.

## Core completion: offline payments, reporting, and platform operations

Cashiers use `/cashier` to record received cash, pay-at-counter, pay-waiter, or other offline payments against consolidated table sessions. Payments are persistent Decimal ledger records, can be partial, are idempotent, allocated across orders, and remain separate from READY/SERVED order status. A table session closes only when its balance is zero and its active orders have been served. Owner/manager voids require reasons and preserve the audit trail.

Restaurant owners/managers can view date- and branch-filtered sales, payment, order, menu-item and operational metrics at `/analytics`. Platform administrators use `/platform` to create restaurant-owner accounts, review signup requests, activate or suspend restaurants, and inspect platform-wide usage totals plus restaurant-level account, branch, order, and guest-session counts. Platform administrators do not enter restaurant workspaces or manage their tables, menus, staff, payments, or operations. Branch weekly hours are configurable as one local-time interval per weekday.

Chapa/Telebirr provider contracts are scaffolded but online payment processing is disabled. Managed image upload/storage is also not configured; menu images use external URLs. See `docs/MANUAL_TESTING_GUIDE.md` for the tested local flows and explicit production limitations.

## Users and access

The initial role vocabulary is `PLATFORM_ADMIN`, `RESTAURANT_OWNER`, `MANAGER`, `WAITER`, `KITCHEN` and `CASHIER`. Restaurant access is granted through explicit active memberships. Memberships may apply to one branch or the whole restaurant. Platform administrators have platform-wide account and usage visibility, but tenant APIs require a restaurant membership and never grant access through the platform-admin role. Restaurant owners can access only their own restaurant memberships; other staff roles use their waiter, kitchen, or cashier workspace. Customer accounts are not part of the product direction.

## Market defaults

The default currency is ETB and the default display timezone is `Africa/Addis_Ababa`. The customer interface ships Amharic, English, Arabic, Chinese, Turkish, Spanish, and German strings. Restaurant menu translations are a separate data model; English/base content is the fallback, while ingredients and allergens are not guessed or machine-translated.

## Product principles

- Tenant authorization is checked by the API for every tenant operation.
- Existing financial and order history will be retained as the product expands.
- Menu edits must not alter historical order snapshots.
- Guest ordering must be lightweight and must not require app installation.
- Cash and pay-at-counter are the first payment workflows; online payments come later.
