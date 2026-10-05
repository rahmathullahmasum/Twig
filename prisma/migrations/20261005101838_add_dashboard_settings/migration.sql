-- CreateTable
CREATE TABLE "DashboardSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardSettings_pkey" PRIMARY KEY ("id")
);
