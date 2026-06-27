/*
  Warnings:

  - Added the required column `gender` to the `Character` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'FREE';

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "gender" TEXT NOT NULL;
