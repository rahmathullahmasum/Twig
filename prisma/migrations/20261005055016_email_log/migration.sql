-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "trackedAppId" TEXT NOT NULL,
    "shopGid" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_trackedAppId_shopGid_idx" ON "EmailLog"("trackedAppId", "shopGid");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_trackedAppId_fkey" FOREIGN KEY ("trackedAppId") REFERENCES "TrackedApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
