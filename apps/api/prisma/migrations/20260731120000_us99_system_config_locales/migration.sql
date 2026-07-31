-- US-99: localizações do `config` por locale. `System.config` passa a ser a base EN;
-- este mapa guarda `{ "pt-BR": SystemConfig }`. Default '{}' para as linhas existentes:
-- sem re-seed elas caem no `config` de hoje (pt-BR) e nada muda de comportamento.
ALTER TABLE "System" ADD COLUMN     "configLocales" JSONB NOT NULL DEFAULT '{}';
