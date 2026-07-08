-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_workers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rut" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStageOrder" INTEGER NOT NULL DEFAULT 1,
    "roleId" TEXT,
    CONSTRAINT "workers_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_workers" ("createdAt", "currentStageOrder", "email", "fullName", "id", "phone", "rut") SELECT "createdAt", "currentStageOrder", "email", "fullName", "id", "phone", "rut" FROM "workers";
DROP TABLE "workers";
ALTER TABLE "new_workers" RENAME TO "workers";
CREATE UNIQUE INDEX "workers_rut_key" ON "workers"("rut");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
