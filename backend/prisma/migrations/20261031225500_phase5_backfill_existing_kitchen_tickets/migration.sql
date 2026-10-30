-- Bring orders already in preparation/service states into the new item-level state machine.
UPDATE "CustomerOrderItem" AS item
SET "kitchenStatus" = CASE
      WHEN orders.status IN ('READY'::"OrderStatus", 'SERVED'::"OrderStatus", 'CLOSED'::"OrderStatus") THEN 'READY'::"KitchenItemStatus"
      WHEN orders.status = 'PREPARING'::"OrderStatus" THEN 'PREPARING'::"KitchenItemStatus"
      ELSE 'PENDING'::"KitchenItemStatus"
    END,
    "preparationStartedAt" = CASE
      WHEN orders.status IN ('PREPARING'::"OrderStatus", 'READY'::"OrderStatus", 'SERVED'::"OrderStatus", 'CLOSED'::"OrderStatus") THEN orders."updatedAt"
      ELSE NULL
    END,
    "readyAt" = CASE
      WHEN orders.status IN ('READY'::"OrderStatus", 'SERVED'::"OrderStatus", 'CLOSED'::"OrderStatus") THEN orders."updatedAt"
      ELSE NULL
    END
FROM "CustomerOrder" AS orders
WHERE item."orderId" = orders.id;

INSERT INTO "KitchenItemEvent" (id, "orderItemId", "previousStatus", status, note, "createdAt")
SELECT 'kitchen_backfill_' || item.id, item.id, NULL, item."kitchenStatus",
       'Backfilled from existing order state during kitchen workflow migration',
       COALESCE(item."readyAt", item."preparationStartedAt", orders."updatedAt")
FROM "CustomerOrderItem" AS item
JOIN "CustomerOrder" AS orders ON orders.id = item."orderId"
WHERE item."kitchenStatus" <> 'PENDING'::"KitchenItemStatus";
