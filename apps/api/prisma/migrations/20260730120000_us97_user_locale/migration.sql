-- US-97: idioma ativo da conta. Default 'pt-BR' para as linhas existentes —
-- nenhum usuário atual muda de comportamento.
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'pt-BR';
