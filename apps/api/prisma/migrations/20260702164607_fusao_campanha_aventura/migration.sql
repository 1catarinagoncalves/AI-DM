/*
  Warnings:

  - You are about to drop the column `campaignId` on the `Adventure` table. All the data in the column will be lost.
  - You are about to drop the `Campaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CharacterSlot` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `creatorId` to the `Adventure` table without a default value. This is not possible if the table is not empty.
  - Added the required column `systemId` to the `Adventure` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Adventure" DROP CONSTRAINT "Adventure_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_systemId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterSlot" DROP CONSTRAINT "CharacterSlot_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterSlot" DROP CONSTRAINT "CharacterSlot_characterId_fkey";

-- AlterTable
ALTER TABLE "Adventure" DROP COLUMN "campaignId",
ADD COLUMN     "creatorId" TEXT NOT NULL,
ADD COLUMN     "systemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Campaign";

-- DropTable
DROP TABLE "CharacterSlot";

-- CreateTable
CREATE TABLE "AdventureParticipant" (
    "id" TEXT NOT NULL,
    "adventureId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdventureParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdventureParticipant_adventureId_characterId_key" ON "AdventureParticipant"("adventureId", "characterId");

-- AddForeignKey
ALTER TABLE "Adventure" ADD CONSTRAINT "Adventure_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adventure" ADD CONSTRAINT "Adventure_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureParticipant" ADD CONSTRAINT "AdventureParticipant_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureParticipant" ADD CONSTRAINT "AdventureParticipant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
