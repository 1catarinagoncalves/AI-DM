-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "spells" JSONB NOT NULL DEFAULT '[]';
