-- CreateTable
CREATE TABLE "feature_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL,
    "problema" TEXT NOT NULL,
    "comportamiento" TEXT NOT NULL,
    "criterios" TEXT NOT NULL,
    "pantalla" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NUEVA',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
