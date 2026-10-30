-- Guest assistance requests get an independent, cookie-protected tracking reference.
ALTER TABLE "AssistanceRequest"
ADD COLUMN "guestTokenExpiresAt" TIMESTAMPTZ(3),
ADD COLUMN "guestTokenHash" TEXT,
ADD COLUMN "reference" TEXT;

CREATE UNIQUE INDEX "AssistanceRequest_reference_key" ON "AssistanceRequest"("reference");
