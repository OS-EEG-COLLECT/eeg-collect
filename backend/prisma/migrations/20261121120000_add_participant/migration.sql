-- CreateTable
CREATE TABLE "Participant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "testerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studyId" INTEGER NOT NULL,
    CONSTRAINT "Participant_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_studyId_testerId_key" ON "Participant"("studyId", "testerId");
