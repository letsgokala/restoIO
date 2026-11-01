# Phase 3 guest ordering verification

Audit date: 2026-10-31. This audit checks the running database-backed guest QR flow, its enforcement and persistence, and the Phase 2/4 handoffs. It does not treat a visible UI control as evidence of backend enforcement.

## Requirement findings

| Requirement | Finding | Evidence and test coverage |
|---|---|---|
| QR resolves a restaurant, branch, and table; anonymous guests need no account | **Implemented and tested** | `customer.service.ts` resolves QR digests and returns public context without internal IDs. `GET /api/v1/customer/qr/:token`. Customer service tests cover valid, unknown, expired, and deactivated tokens; Playwright opens the seeded QR without signing in. |
| Restaurant menu comes from database content and respects branch availability | **Implemented and tested** | `CustomerRepository.findMenu` loads active categories, items, translations, modifiers, and branch availability. Unavailable items are labeled and disabled in the guest menu; checkout independently rejects items not available at the scanned branch. `GET /api/v1/customer/qr/:token/menu`. Service tests check available and unavailable branch results; owner management integration creates an available menu item before QR checkout. |
| Menu search/category filtering and image display | **Implemented, not fully tested** | `CustomerMenuPage` filters by text and category and renders database `imageUrl`, with a clearly labeled sample-image fallback. Browser tests exercise menu browsing but do not yet verify category/search behavior or a remote image URL. There is no image upload/storage feature; restaurants supply image URLs. |
| English, Amharic, Arabic, Chinese, Turkish, Spanish, and German UI; Arabic RTL | **Implemented and tested for locale selection/direction; translation coverage is partial** | Locale dictionaries are in `frontend/messages/`; `frontend/src/app/layout.tsx` sets `lang` and Arabic `dir="rtl"`; `frontend/src/i18n/request.ts` falls back to English UI messages. Playwright selects all seven locales and checks document language/direction; it checks Amharic table/cart labels. Backend tests verify translated menu content and base-language fallback. Not every translated string or menu field has a language-by-language assertion. |
| Item details, required/optional modifiers, special instructions, quantities, cart context | **Implemented and tested** | `CustomerMenuPage` holds a cart per QR token in `sessionStorage`, uses database item/modifier data, and collects item instructions and a checkout note. UI enforces modifier bounds; `customer.controller.ts` Zod-validates quantities and note lengths. Browser coverage selects an add-on and submits both notes. Backend coverage rejects invalid modifiers and HTTP quantities. |
| Server-authoritative prices, duplicate protection, snapshots, pending/unpaid orders | **Implemented and tested** | `CustomerService.placeOrder` recomputes prices with Prisma Decimal; repository transaction locks the table, revalidates QR/item/branch/modifier availability, and writes item snapshots plus a pending event. Unique idempotency keys handle retries. Tests check tampered price is ignored, modifier totals/snapshots, retry/conflict, pending status, and `UNPAID`. `POST /api/v1/customer/qr/:token/orders`. |
| Multiple guests share one open table session while creating separate orders | **Implemented and tested** | `CustomerRepository.createOrder` locks the table and reuses the open session. Service tests assert multiple orders share one session; Playwright creates orders from separate guest contexts on the same QR and confirms both appear in the waiter’s table session. |
| Private order tracking and backend status synchronization | **Implemented and tested** | Checkout returns a scoped HTTP-only guest cookie; `GET /api/v1/customer/orders/:reference` requires it and omits staff/internal identity. Browser coverage sees a served status after staff changes persist. Backend tests cover invalid tokens and rejection reasons. |
| Waiter, bill, and general assistance; customer status tracking | **Implemented and tested** | `POST /api/v1/customer/qr/:token/assistance` rate-limits per table/kind, associates the request with its table session, and issues a separate scoped HTTP-only status cookie. `GET /api/v1/customer/assistance/:reference` requires that cookie. Waiter ACK/RESOLVED transitions are audited. Integration and Playwright tests cover unauthorized tracking, status updates, and excessive-request limits. |
| Guest/tenant security and request validation | **Implemented and tested** | Public routes expose no tenant selectors; QR tokens are opaque 256-bit values except the local-only demo fixture. Order and assistance tokens are random, hashed in the database, expiring, and cookie-protected. Integration tests check tenant/branch isolation, no anonymous status mutation, private tracking, invalid quantities/modifiers, price tampering, and missing/expired guest credentials. |

## Files and API paths

- Guest UI: `frontend/src/features/customer/components/customer-menu-page.tsx`, `order-tracking-page.tsx`, `language-selector.tsx`.
- Guest API/domain: `backend/src/modules/customer/controllers/customer.controller.ts`, `customer.service.ts`, `repositories/customer.repository.ts`, and `customer.routes.ts`.
- Schema changes for private assistance tracking: `backend/prisma/schema.prisma` and migration `20261031215000_phase3_guest_assistance_tracking`.
- Tests: `backend/src/modules/customer/__tests__/customer.service.test.ts`, `backend/src/modules/management/__tests__/management.integration.test.ts`, `frontend/e2e/customer-ordering.spec.ts`, and `frontend/e2e/waiter-workflow.spec.ts`.
- Customer endpoints: `GET /api/v1/customer/qr/:token`, `GET /api/v1/customer/qr/:token/menu?locale=en`, `POST /api/v1/customer/qr/:token/orders`, `GET /api/v1/customer/orders/:reference`, `POST /api/v1/customer/qr/:token/assistance`, and `GET /api/v1/customer/assistance/:reference`.

## Remaining limitations

- Menu photographs are displayed from a configured URL; uploads and managed image storage are not implemented.
- Menu text uses a saved translation when present, then falls back to the base field. Translation quality and every text field have not been reviewed/tested for every language.
- Customer and waiter updates use polling. Socket.IO and push notifications are not used.
- Payment remains `UNPAID` until a future authorized payment workflow records it; no online payment flow is part of Phase 3.
- Customer status views are private to the browser session holding the scoped cookie. A reference alone cannot recover access on another device.

Phase 3 remains implemented; the items above are scoped limitations and coverage gaps, not substitutes for server-side checks. Phase 5 is not part of this audit.
