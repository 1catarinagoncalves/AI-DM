-- US-232: autoria mundo-primeiro tem fecho RAMIFICADO (branchedResolution, sem herói), não
-- uma conclusão única pré-escrita. `Quest.conclusionHint` deixa de ser escrita por qualquer
-- caminho de código e sai da tabela. Coluna nullable, sem dado a preservar (artefatos velhos
-- são descartados junto — ADR 012 D6).
ALTER TABLE "Quest" DROP COLUMN "conclusionHint";
