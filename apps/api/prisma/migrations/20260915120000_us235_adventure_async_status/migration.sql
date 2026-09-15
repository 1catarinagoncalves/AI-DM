-- US-235: gatilho assíncrono da criação de aventura. GENERATING é o estado inicial da
-- linha (existe antes do motor terminar, id consultável pela tela de espera); FAILED
-- quando o gate (US-234) esgota o teto de tentativas. `generationError` guarda o motivo
-- nesse caso.
-- AlterEnum
ALTER TYPE "AdventureStatus" ADD VALUE 'GENERATING';
ALTER TYPE "AdventureStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Adventure" ADD COLUMN     "generationError" TEXT;
