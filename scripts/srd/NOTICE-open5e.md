# Atribuição — dado de sistema D&D 5e (SRD 5.2 + SRD 5.1)

Os artefatos [`srd-5e.config.en-US.json`](./srd-5e.config.en-US.json),
[`srd-5e.config.pt-BR.json`](./srd-5e.config.pt-BR.json),
[`ability-modifiers.srd-2024.json`](./ability-modifiers.srd-2024.json) e
[`d20-tests.srd-2024.json`](../../packages/ai-engine/src/prompts/d20-tests.srd-2024.json) são
**derivados** do System Reference Document 5.2 ("SRD 5.2") e do System Reference Document 5.1
("SRD 5.1"), publicados por **Wizards of the Coast LLC**, obtidos a partir do projeto **Open5e**
(`open5e/open5e-api`, tag `v2.1.0`).

O `ability-modifiers.srd-2024.json` (US-108) é a tabela de modificadores de habilidade extraída do
texto normativo (`Rule.json`, regras `srd-2024_the-six-abilities_*`) — só SRD 5.2, sem 5.1 e sem
localização: a tabela é numérica e atravessa locale sem tradução.

O `d20-tests.srd-2024.json` (US-110) traz as tabelas de exemplo do ruleset `srd-2024_d20-tests`
(qual habilidade a situação chama, em teste/salvaguarda/ataque, mais as Classes de Dificuldade) —
também só SRD 5.2. É o único derivado que **não** mora nesta pasta: ele é importado como módulo
pelo builder do system prompt, e JSON de fora do pacote arrastaria o `rootDir` do tsc. O texto dos
exemplos fica em inglês, como o resto do system prompt.

O SRD 5.1 entra por decisão do [ADR 009](../../docs/adr/009-uniao-dos-srd-5-1-e-5-2.md). O
mecanismo de união (5.1 preenche o que o 5.2 não tem, com o 5.2 vencendo onde os dois descrevem
a mesma coisa) segue disponível para domínios futuros, mas **`races`** não passa mais por ele: o
ADR 009 §8 (15/08/2026, US-138) reverteu a precedência e fixou o SRD 5.1 como fonte ÚNICA de
`config.races` — sem fusão com o 5.2. Consequência: `goliath` e `orc` (exclusivas do 5.2) saem do
catálogo; `half-elf`/`half-orc` (exclusivas do 5.1) continuam.

Os catálogos `backgrounds` (US-121) são derivados de *Level Up: Advanced 5th Edition —
Adventurer's Guide* ("a5e-ag"), publicado por **EN Publishing**, também obtido via Open5e no
mesmo tag `v2.1.0`. É o primeiro dado do config que não vem de `wizards-of-the-coast/`; ver
[ADR 004](../../docs/adr/004-origem-do-dado-de-sistema.md) §3.3.

## Licença

Este material é usado sob a **Creative Commons Attribution 4.0 International (CC-BY-4.0)** —
a mesma licença sob a qual a Wizards of the Coast publicou o SRD 5.2. O SRD 5.1 é publicado sob
**licença dupla** (CC-BY-4.0 **ou** OGL 1.0a); aqui ele é usado **pela via CC-BY-4.0**, a mesma
do 5.2, mantendo o artefato com licença única. O `a5e-ag` também é publicado sob **licença
dupla** (CC-BY-4.0 **ou** OGL 1.0a); aqui ele é usado **pela via CC-BY-4.0**, mesmo padrão.

Texto da licença: <https://creativecommons.org/licenses/by/4.0/legalcode>

## Atribuição exigida

> This work includes material from the System Reference Document 5.2 ("SRD 5.2") and the System
> Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at
> <https://www.dndbeyond.com/srd>. The SRD 5.2 and the SRD 5.1 are licensed under the
> Creative Commons Attribution 4.0 International License, available at
> <https://creativecommons.org/licenses/by/4.0/legalcode>.
>
> Dados estruturados obtidos via Open5e (<https://github.com/open5e/open5e-api>, tag `v2.1.0`),
> também sob CC-BY-4.0.
>
> This work also includes material from Level Up: Advanced 5th Edition — Adventurer's Guide,
> by EN Publishing, licensed under the Creative Commons Attribution 4.0 International License,
> available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

## Escopo e limites

- **Licença única.** Todo o dado deste artefato é CC-BY-4.0. **Nenhum material OGL 1.0a** entra
  aqui — continua verdadeiro com o SRD 5.1, tomado pela via CC-BY-4.0 do seu duplo licenciamento
  (o equipamento inicial, que só o `5e-database`/OGL expõe estruturado, é a US-51, com a
  decisão de licença isolada lá), e com o `a5e-ag`, tomado pela mesma via.
- **Marcas não licenciadas.** A CC-BY-4.0 cobre o texto do SRD, não as marcas da Wizards of the
  Coast. O produto **não pode** ser chamado de "Dungeons & Dragons" nem usar o logotipo/identidade
  da WotC. Mesma regra para a EN Publishing: nenhuma marca **"Advanced 5th Edition"**, **"A5E"**
  ou identidade do publisher entra no produto.
- O `pt-BR` ([`locale/pt-BR.json`](./locale/pt-BR.json)) é **localização autoral do projeto** — não
  vem do SRD nem do Open5e.
