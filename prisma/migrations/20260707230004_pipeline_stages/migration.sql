-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "stage_doc_requirements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stageId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "roleId" TEXT,
    CONSTRAINT "stage_doc_requirements_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stage_doc_requirements_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stage_doc_requirements_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "worker_doc_exceptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "justification" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'admin',
    "workerId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    CONSTRAINT "worker_doc_exceptions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "worker_doc_exceptions_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "worker_doc_exceptions_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "currentStageOrder" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_workers" ("createdAt", "email", "fullName", "id", "phone", "rut") SELECT "createdAt", "email", "fullName", "id", "phone", "rut" FROM "workers";
DROP TABLE "workers";
ALTER TABLE "new_workers" RENAME TO "workers";
CREATE UNIQUE INDEX "workers_rut_key" ON "workers"("rut");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "stages_order_key" ON "stages"("order");

-- CreateIndex
CREATE UNIQUE INDEX "stages_name_key" ON "stages"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stage_doc_requirements_stageId_documentTypeId_roleId_key" ON "stage_doc_requirements"("stageId", "documentTypeId", "roleId");
