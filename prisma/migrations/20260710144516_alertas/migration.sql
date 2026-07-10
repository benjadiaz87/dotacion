-- AlterTable
ALTER TABLE "worker_documents" ADD COLUMN "expiresAt" DATETIME;

-- CreateTable
CREATE TABLE "alert_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "gapsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gapsSemanas" INTEGER NOT NULL DEFAULT 3,
    "salidasEnabled" BOOLEAN NOT NULL DEFAULT true,
    "salidasSemanas" INTEGER NOT NULL DEFAULT 3,
    "vencimientosEnabled" BOOLEAN NOT NULL DEFAULT true,
    "vencimientoDias" INTEGER NOT NULL DEFAULT 30,
    "curvaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "curve_change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "roleName" TEXT NOT NULL,
    "oldQty" INTEGER NOT NULL,
    "newQty" INTEGER NOT NULL,
    "changedBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "curve_change_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
