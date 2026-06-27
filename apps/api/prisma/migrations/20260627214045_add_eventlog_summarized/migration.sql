-- AlterTable
ALTER TABLE "EventLog" ADD COLUMN     "summarized" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "EventLog_adventureId_characterId_type_summarized_idx" ON "EventLog"("adventureId", "characterId", "type", "summarized");
