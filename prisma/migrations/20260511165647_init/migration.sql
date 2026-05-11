-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mrn" TEXT NOT NULL,
    "title" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "dateOfBirth" DATETIME NOT NULL,
    "sex" TEXT NOT NULL,
    "genderIdentity" TEXT,
    "pronouns" TEXT,
    "photoUrl" TEXT,
    "contactJson" TEXT NOT NULL,
    "emergencyContactsJson" TEXT NOT NULL DEFAULT '[]',
    "bloodType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "heightCm" REAL,
    "weightKg" REAL,
    "allergiesJson" TEXT NOT NULL DEFAULT '[]',
    "chronicConditionsJson" TEXT NOT NULL DEFAULT '[]',
    "currentMedicationsJson" TEXT NOT NULL DEFAULT '[]',
    "pastSurgeriesJson" TEXT NOT NULL DEFAULT '[]',
    "familyHistoryJson" TEXT NOT NULL DEFAULT '[]',
    "immunizationLogJson" TEXT NOT NULL DEFAULT '[]',
    "insurancePoliciesJson" TEXT NOT NULL DEFAULT '[]',
    "documentsJson" TEXT NOT NULL DEFAULT '[]',
    "alertsJson" TEXT NOT NULL DEFAULT '[]',
    "consentJson" TEXT NOT NULL,
    "maritalStatus" TEXT,
    "occupation" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'English',
    "ethnicity" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");

-- CreateIndex
CREATE INDEX "Patient_lastName_idx" ON "Patient"("lastName");

-- CreateIndex
CREATE INDEX "Patient_isArchived_idx" ON "Patient"("isArchived");
