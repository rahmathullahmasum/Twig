-- AlterTable
ALTER TABLE "DashboardSettings" ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;
