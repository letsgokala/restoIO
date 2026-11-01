# Data model

The Prisma schema contains the identity and tenant foundation, restaurant management, guest ordering, and kitchen preparation domains. All timestamps use PostgreSQL `timestamptz`; the display timezone is a restaurant setting.

- `Restaurant`: tenant root, unique public slug, pending/active/suspended state, description, branding/contact fields, ETB currency default, timezone. Public signup creates pending records until platform approval.
- `Branch`: belongs to a restaurant; branch slug is unique within the restaurant.
- `User`: unique normalized email, Argon2id hash, active flag and explicit platform-admin flag.
- `Membership`: user-to-restaurant role grant, optionally branch-scoped. Composite branch foreign key ensures the branch belongs to the same restaurant.
- `DiningTable`: belongs to restaurant and branch, label unique within branch.
- `QRToken`: opaque secret digest associated to a table and tenant, with active/revocation state. The encrypted token copy is used only by authorized management screens for QR reprinting; production uses the stable `QR_TOKEN_ENCRYPTION_KEY`.
- `StaffSession`: hashed bearer secret, expiry/revocation, and user plus optional tenant association.
- `MenuCategory`, `MenuItem`, `ModifierGroup`, and `ModifierOption`: tenant-owned menu content with stable public UUIDs and server-authoritative Decimal prices.
- `MenuCategoryTranslation`, `MenuItemTranslation`, `ModifierGroupTranslation`, and `ModifierOptionTranslation`: separately stored locale variants. Menu text falls back to its base English field; missing ingredient/allergen text stays missing rather than being guessed.
- `MenuItemBranchAvailability`: only active items explicitly available at the scanned branch are returned or accepted at checkout.
- `TableSession`: one open service session can be shared by separate orders at the same physical table. Order creation locks the table row before reusing or creating the open session. A session closes only after its balance is zero and all active orders are served or closed.
- `CustomerOrder`, `CustomerOrderItem`, and `OrderEvent`: tenant-scoped order state, separate payment status, exact monetary snapshots, customizations, and persisted status history. Events include previous/current status, optional staff actor, note/rejection/cancellation reason, and timestamp. Payment allocations update payment status without conflating `READY`/`SERVED` with payment.
- `Payment`, `PaymentAllocation`, and `PaymentAudit`: persistent offline-payment history with Decimal amounts, method, currency, tenant/branch/session, idempotency key, cashier attribution, per-order allocations, and audited manager voids. Financial rows are not deleted. Provider methods are reserved but rejected by the cashier API until adapters are implemented and verified.
- `BranchOperatingHour`: one opening interval per weekday, stored as local `HH:mm` values and interpreted in the restaurant timezone.
- `KitchenItemStatus` and `KitchenItemEvent`: per-order-item PENDING/PREPARING/READY state, preparation/ready timestamps, and actor-attributed history. The order becomes READY only after every item has reached READY; older active and completed tickets are backfilled by the kitchen migration.
- `AssistanceRequest` and `AssistanceRequestEvent`: waiter, bill, and help requests tied to the resolved branch/table, with OPEN → ACKNOWLEDGED → RESOLVED history, optional handling actor, and handled timestamp. A public UUID reference and hashed, expiring guest token authorize private customer status polling; old requests without these optional fields remain staff-visible only.

Restaurant and branch foreign keys use restrictive deletes to protect operational data; translations and order items cascade with their owning records. Tenant and lookup indexes are included. Online payment provider execution is disabled; local cashier workflows handle physical payments only. Serving orders and handling assistance do not close table sessions.
