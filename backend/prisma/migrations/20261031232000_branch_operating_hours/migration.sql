-- CreateTable
CREATE TABLE "BranchOperatingHour" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensAt" VARCHAR(5) NOT NULL,
    "closesAt" VARCHAR(5) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BranchOperatingHour_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BranchOperatingHour"
ADD CONSTRAINT "BranchOperatingHour_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
ADD CONSTRAINT "BranchOperatingHour_time_format_check" CHECK ("opensAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "closesAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
ADD CONSTRAINT "BranchOperatingHour_time_order_check" CHECK ("isClosed" OR "opensAt" < "closesAt");

-- CreateIndex
CREATE INDEX "BranchOperatingHour_branchId_idx" ON "BranchOperatingHour"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchOperatingHour_branchId_dayOfWeek_key" ON "BranchOperatingHour"("branchId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "BranchOperatingHour" ADD CONSTRAINT "BranchOperatingHour_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
