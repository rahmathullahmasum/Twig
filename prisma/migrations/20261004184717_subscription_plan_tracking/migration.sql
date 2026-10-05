-- AlterTable
ALTER TABLE "ShopInstallation" ADD COLUMN     "billingPeriod" TEXT,
ADD COLUMN     "planAmount" DOUBLE PRECISION,
ADD COLUMN     "planCurrencyCode" TEXT,
ADD COLUMN     "planHandle" TEXT,
ADD COLUMN     "subscriptionSyncedAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
