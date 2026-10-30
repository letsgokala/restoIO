-- Add optional QR expiry without changing existing unexpired QR records.
ALTER TABLE "QRToken" ADD COLUMN "expiresAt" TIMESTAMPTZ(3);

-- Backfill the tenant key before requiring it on branch availability records.
ALTER TABLE "MenuItemBranchAvailability" ADD COLUMN "restaurantId" TEXT;
UPDATE "MenuItemBranchAvailability" AS availability
SET "restaurantId" = item."restaurantId"
FROM "MenuItem" AS item
WHERE availability."itemId" = item."id";
ALTER TABLE "MenuItemBranchAvailability" ALTER COLUMN "restaurantId" SET NOT NULL;

ALTER TABLE "MenuItemBranchAvailability" DROP CONSTRAINT "MenuItemBranchAvailability_itemId_fkey";
ALTER TABLE "MenuItemBranchAvailability" DROP CONSTRAINT "MenuItemBranchAvailability_branchId_fkey";
ALTER TABLE "MenuItemBranchAvailability" ADD CONSTRAINT "MenuItemBranchAvailability_itemId_restaurantId_fkey"
  FOREIGN KEY ("itemId", "restaurantId") REFERENCES "MenuItem"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemBranchAvailability" ADD CONSTRAINT "MenuItemBranchAvailability_branchId_restaurantId_fkey"
  FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TableSession_id_restaurantId_branchId_key" ON "TableSession"("id", "restaurantId", "branchId");
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_branchId_fkey";
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_tableId_fkey";
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_branchId_restaurantId_fkey"
  FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_restaurantId_branchId_fkey"
  FOREIGN KEY ("tableId", "restaurantId", "branchId") REFERENCES "DiningTable"("id", "restaurantId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerOrder" DROP CONSTRAINT "CustomerOrder_branchId_fkey";
ALTER TABLE "CustomerOrder" DROP CONSTRAINT "CustomerOrder_tableId_fkey";
ALTER TABLE "CustomerOrder" DROP CONSTRAINT "CustomerOrder_tableSessionId_fkey";
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_branchId_restaurantId_fkey"
  FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_tableId_restaurantId_branchId_fkey"
  FOREIGN KEY ("tableId", "restaurantId", "branchId") REFERENCES "DiningTable"("id", "restaurantId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_tableSessionId_restaurantId_branchId_fkey"
  FOREIGN KEY ("tableSessionId", "restaurantId", "branchId") REFERENCES "TableSession"("id", "restaurantId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssistanceRequest" DROP CONSTRAINT "AssistanceRequest_branchId_fkey";
ALTER TABLE "AssistanceRequest" DROP CONSTRAINT "AssistanceRequest_tableId_fkey";
ALTER TABLE "AssistanceRequest" DROP CONSTRAINT "AssistanceRequest_tableSessionId_fkey";
ALTER TABLE "AssistanceRequest" ADD CONSTRAINT "AssistanceRequest_branchId_restaurantId_fkey"
  FOREIGN KEY ("branchId", "restaurantId") REFERENCES "Branch"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistanceRequest" ADD CONSTRAINT "AssistanceRequest_tableId_restaurantId_branchId_fkey"
  FOREIGN KEY ("tableId", "restaurantId", "branchId") REFERENCES "DiningTable"("id", "restaurantId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistanceRequest" ADD CONSTRAINT "AssistanceRequest_tableSessionId_restaurantId_branchId_fkey"
  FOREIGN KEY ("tableSessionId", "restaurantId", "branchId") REFERENCES "TableSession"("id", "restaurantId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;
