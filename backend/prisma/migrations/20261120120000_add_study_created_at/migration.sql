-- Adds Study.createdAt.
-- Existing studies get the date of their first session, or the migration time if they have none.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Study" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "folderPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Study_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Study" ("id", "title", "description", "folderPath", "createdAt", "userId")
SELECT
    "id",
    "title",
    "description",
    "folderPath",
    COALESCE(
        (SELECT MIN("Session"."createdAt") FROM "Session" WHERE "Session"."studyId" = "Study"."id"),
        CURRENT_TIMESTAMP
    ),
    "userId"
FROM "Study";
DROP TABLE "Study";
ALTER TABLE "new_Study" RENAME TO "Study";
CREATE UNIQUE INDEX "Study_title_key" ON "Study"("title");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
