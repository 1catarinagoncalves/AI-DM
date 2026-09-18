-- US-256: a jogadora entra no chat antes do resto da aventura gerar. OPENING_READY = abertura
-- (introdução + cena) já persistida, resto ainda gerando; `authoredSlice` guarda a fatia
-- inicial liberada (+ `challenge`) pro "tentar de novo" da 1B e pro dyno reiniciado.
-- AlterEnum
ALTER TYPE "AdventureStatus" ADD VALUE 'OPENING_READY';

-- AlterTable
ALTER TABLE "Adventure" ADD COLUMN     "authoredSlice" JSONB;
