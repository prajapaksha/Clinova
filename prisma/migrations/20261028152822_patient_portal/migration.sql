-- CreateTable
CREATE TABLE "PatientAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "inviteCodeHash" TEXT,
    "inviteExpiresAt" DATETIME,
    "invitedBy" TEXT,
    "resetTokenHash" TEXT,
    "resetExpiresAt" DATETIME,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "activatedAt" DATETIME,
    "notificationPrefsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientAccount_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientLastReadAt" DATETIME,
    "staffLastReadAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ThreadMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefillRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "pharmacy" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "respondedBy" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProfileChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "changesJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SavedPaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "cardholderName" TEXT NOT NULL,
    "gatewayToken" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppointmentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#1976D2',
    "defaultServiceCode" TEXT,
    "isPatientBookable" BOOLEAN NOT NULL DEFAULT false,
    "patientDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppointmentType" ("bufferAfterMinutes", "color", "createdAt", "defaultDurationMinutes", "defaultServiceCode", "id", "isActive", "name", "updatedAt") SELECT "bufferAfterMinutes", "color", "createdAt", "defaultDurationMinutes", "defaultServiceCode", "id", "isActive", "name", "updatedAt" FROM "AppointmentType";
DROP TABLE "AppointmentType";
ALTER TABLE "new_AppointmentType" RENAME TO "AppointmentType";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PatientAccount_patientId_key" ON "PatientAccount"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientAccount_email_key" ON "PatientAccount"("email");

-- CreateIndex
CREATE INDEX "MessageThread_patientId_lastMessageAt_idx" ON "MessageThread"("patientId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "MessageThread_status_lastMessageAt_idx" ON "MessageThread"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ThreadMessage_threadId_createdAt_idx" ON "ThreadMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "RefillRequest_patientId_idx" ON "RefillRequest"("patientId");

-- CreateIndex
CREATE INDEX "RefillRequest_status_createdAt_idx" ON "RefillRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_patientId_idx" ON "ProfileChangeRequest"("patientId");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_status_createdAt_idx" ON "ProfileChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SavedPaymentMethod_patientId_idx" ON "SavedPaymentMethod"("patientId");
