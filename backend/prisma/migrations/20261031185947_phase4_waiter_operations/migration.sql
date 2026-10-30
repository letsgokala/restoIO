/*
  Warnings:

  - Added the required column `updatedAt` to the `AssistanceRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "AssistanceRequest" ADD COLUMN     "handledAt" TIMESTAMPTZ(3),
ADD COLUMN     "handledByUserId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "OrderEvent" ADD COLUMN     "previousStatus" "OrderStatus",
ADD COLUMN     "staffUserId" TEXT;

-- CreateTable
CREATE TABLE "AssistanceRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "previousStatus" "AssistanceStatus",
    "status" "AssistanceStatus" NOT NULL,
    "staffUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistanceRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistanceRequestEvent_requestId_createdAt_idx" ON "AssistanceRequestEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistanceRequestEvent_staffUserId_createdAt_idx" ON "AssistanceRequestEvent"("staffUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_staffUserId_createdAt_idx" ON "OrderEvent"("staffUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistanceRequest" ADD CONSTRAINT "AssistanceRequest_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistanceRequestEvent" ADD CONSTRAINT "AssistanceRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AssistanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistanceRequestEvent" ADD CONSTRAINT "AssistanceRequestEvent_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
