-- CreateEnum
CREATE TYPE "AppEventType" AS ENUM ('INSTALLED', 'UNINSTALLED', 'REACTIVATED', 'DEACTIVATED');

-- CreateTable
CREATE TABLE "TrackedApp" (
    "id" TEXT NOT NULL,
    "partnerGid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopInstallation" (
    "id" TEXT NOT NULL,
    "trackedAppId" TEXT NOT NULL,
    "shopGid" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "uninstalledAt" TIMESTAMP(3),
    "reason" TEXT,
    "reasonCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppEventLog" (
    "id" TEXT NOT NULL,
    "trackedAppId" TEXT NOT NULL,
    "shopGid" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "type" "AppEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL,
    "trackedAppId" TEXT NOT NULL,
    "lastOccurredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppMetricsDaily" (
    "id" TEXT NOT NULL,
    "trackedAppId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "activeInstalls" INTEGER NOT NULL,
    "newInstalls" INTEGER NOT NULL,
    "uninstalls" INTEGER NOT NULL,
    "reinstalls" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppMetricsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedApp_partnerGid_key" ON "TrackedApp"("partnerGid");

-- CreateIndex
CREATE INDEX "ShopInstallation_trackedAppId_isActive_idx" ON "ShopInstallation"("trackedAppId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShopInstallation_trackedAppId_shopGid_key" ON "ShopInstallation"("trackedAppId", "shopGid");

-- CreateIndex
CREATE INDEX "AppEventLog_trackedAppId_occurredAt_idx" ON "AppEventLog"("trackedAppId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppEventLog_trackedAppId_shopGid_type_occurredAt_key" ON "AppEventLog"("trackedAppId", "shopGid", "type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_trackedAppId_key" ON "SyncCursor"("trackedAppId");

-- CreateIndex
CREATE INDEX "AppMetricsDaily_trackedAppId_date_idx" ON "AppMetricsDaily"("trackedAppId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AppMetricsDaily_trackedAppId_date_key" ON "AppMetricsDaily"("trackedAppId", "date");

-- AddForeignKey
ALTER TABLE "ShopInstallation" ADD CONSTRAINT "ShopInstallation_trackedAppId_fkey" FOREIGN KEY ("trackedAppId") REFERENCES "TrackedApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppEventLog" ADD CONSTRAINT "AppEventLog_trackedAppId_fkey" FOREIGN KEY ("trackedAppId") REFERENCES "TrackedApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_trackedAppId_fkey" FOREIGN KEY ("trackedAppId") REFERENCES "TrackedApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppMetricsDaily" ADD CONSTRAINT "AppMetricsDaily_trackedAppId_fkey" FOREIGN KEY ("trackedAppId") REFERENCES "TrackedApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
