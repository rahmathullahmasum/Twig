-- AlterTable
ALTER TABLE "ShopInstallation" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "SyncCursor" ADD COLUMN     "lastTransactionAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppTransaction" (
    "id" TEXT NOT NULL,
    "trackedAppId" TEXT NOT NULL,
    "partnerTransactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shopGid" TEXT,
    "shopDomain" TEXT,
    "grossAmount" DOUBLE PRECISION,
    "netAmount" DOUBLE PRECISION,
    "currencyCode" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppTransaction_partnerTransactionId_key" ON "AppTransaction"("partnerTransactionId");

-- CreateIndex
CREATE INDEX "AppTransaction_trackedAppId_occurredAt_idx" ON "AppTransaction"("trackedAppId", "occurredAt");

-- AddForeignKey
ALTER TABLE "AppTransaction" ADD CONSTRAINT "AppTransaction_trackedAppId_fkey" FOREIGN KEY ("trackedAppId") REFERENCES "TrackedApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
