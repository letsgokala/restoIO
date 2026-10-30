CREATE TYPE "KitchenItemStatus" AS ENUM ('PENDING', 'PREPARING', 'READY');

ALTER TABLE "CustomerOrderItem"
ADD COLUMN "kitchenStatus" "KitchenItemStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "preparationStartedAt" TIMESTAMPTZ(3),
ADD COLUMN "readyAt" TIMESTAMPTZ(3);

CREATE TABLE "KitchenItemEvent" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "previousStatus" "KitchenItemStatus",
    "status" "KitchenItemStatus" NOT NULL,
    "staffUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KitchenItemEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KitchenItemEvent_orderItemId_createdAt_idx" ON "KitchenItemEvent"("orderItemId", "createdAt");
CREATE INDEX "KitchenItemEvent_staffUserId_createdAt_idx" ON "KitchenItemEvent"("staffUserId", "createdAt");

ALTER TABLE "KitchenItemEvent" ADD CONSTRAINT "KitchenItemEvent_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "CustomerOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenItemEvent" ADD CONSTRAINT "KitchenItemEvent_staffUserId_fkey"
FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
