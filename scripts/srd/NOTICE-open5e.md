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

O SRD 5.1 entra por decisão do [ADR 009](../../docs/adr/009-uniao-dos-srd-5-1-e-5-2.md): a fonte é a
**união** dos dois documentos do mesmo tag, com o 5.2 vencendo onde os dois descrevem a mesma coisa.
Hoje o 5.1 contribui as espécies `half-elf` e `half-orc`, que a edição 2024 retirou.

## Licença

Este material é usado sob a **Creative Commons Attribution 4.0 International (CC-BY-4.0)** —
a mesma licença sob a qual a Wizards of the Coast publicou o SRD 5.2. O SRD 5.1 é publicado sob
**licença dupla** (CC-BY-4.0 **ou** OGL 1.0a); aqui ele é usado **pela via CC-BY-4.0**, a mesma
do 5.2, mantendo o artefato com licença única.

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

## Escopo e limites

- **Licença única.** Todo o dado deste artefato é CC-BY-4.0. **Nenhum material OGL 1.0a** entra
  aqui — continua verdadeiro com o SRD 5.1, tomado pela via CC-BY-4.0 do seu duplo licenciamento
  (o equipamento inicial, que só o `5e-database`/OGL expõe estruturado, é a US-51, com a
  decisão de licença isolada lá).
- **Marcas não licenciadas.** A CC-BY-4.0 cobre o texto do SRD, não as marcas da Wizards of the
  Coast. O produto **não pode** ser chamado de "Dungeons & Dragons" nem usar o logotipo/identidade
  da WotC.
- O `pt-BR` ([`locale/pt-BR.json`](./locale/pt-BR.json)) é **localização autoral do projeto** — não
  vem do SRD nem do Open5e.
