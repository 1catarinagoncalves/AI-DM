/*
  Warnings:

  - Added the required column `systemId` to the `Character` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "System" ADD COLUMN     "config" JSONB;

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "systemId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
