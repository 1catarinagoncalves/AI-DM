# Repositórios de referência — registro e regra de uso

**Criado em:** 2026-08-12
**Para que serve:** um lugar só onde vive **a licença e o veredito** de cada repositório externo
já triado, para que ninguém re-triaje do zero nem cite um repo cuja licença ninguém checou.

Este documento **não descreve o que cada referência ensinou** — isso vive na US, no ADR ou no
backlog que a cita, porque interpretação é do documento que decide. Aqui ficam os fatos que não
mudam com o contexto: quem é, sob que licença, e se pode ser tocado.

---

## A regra em cinco linhas

1. **Ideia atravessa; linha de código não** — a menos que a licença permita e a atribuição seja feita.
2. **Regra de jogo não é do repo que a implementou.** A progressão de slot, a árvore de CA, o
   bônus de proficiência: tudo isso é **SRD sob CC-BY-4.0**, que este projeto já fixa por pipeline
   próprio ([ADR 004](../../adr/004-origem-do-dado-de-sistema.md)). Reimplementar a regra nunca é o
   problema. Copiar a **implementação** é.
3. **Toda citação carrega licença.** US, ADR ou backlog que menciona um repo externo escreve o
   link, a licença e uma linha do que aquilo autorizou. Sem licença ao lado, a citação está
   incompleta.
4. **Registrar a profundidade da leitura.** Quase toda triagem aqui foi por README e metadados da
   API do GitHub — código não executado, não auditado. Dizer isso é parte da citação.
5. **Referência é evidência, não autoridade.** Nenhuma decisão se sustenta em "o projeto X faz
   assim". Sustenta-se em verificação neste repo; a referência no máximo confirma, contradiz ou
   sugere. Quando ela contradiz uma decisão nossa, isso vale mais que quando concorda — foi o que
   inverteu o DEF-2.

---

## Portão de licença

Checar **antes** de abrir o código, não depois.

| Licença | O que é permitido | Cuidado |
|---|---|---|
| **MIT**, **Apache-2.0**, **CC-BY-4.0** | ler, adaptar, incorporar **com atribuição** | manter o aviso de copyright junto do que for adaptado |
| **MPL-2.0** | copyleft **por arquivo** — dá para conviver com o resto do repo | o arquivo importado continua MPL e modificação nele é publicada |
| **AGPL-3.0** | **ler para entender. Nunca copiar** | copyleft forte **com cláusula de rede**: código copiado tornaria o AI DM inteiro AGPL e obrigaria a entregar o fonte a todo usuário do serviço. Ideia sim, linha não |
| **"Other"** (o GitHub não reconheceu) | nada, até alguém ler o arquivo `LICENSE` | tratar como desconhecida, não como permissiva |
| **ausente / `null`** | **nada.** Sem licença = todos os direitos reservados | nem com atribuição. Só serve como leitura de escopo |

---

## Registro

Triagem de **12/08/2026**, salvo indicação. `Push` é o último commit no dia da triagem — sinal de
manutenção, não de qualidade.

| Repositório | Licença | Push | Veredito | Citado em |
|---|---|---|---|---|
| [blakewatson/minimal-character-sheet](https://github.com/blakewatson/minimal-character-sheet) | MIT | 11/08/2026 | **Referência ativa.** Modelo de dados mínimo e mantido; a única cuja divergência inverteu uma decisão nossa | [backlog CA](../01-requisitos/backlog-classe-de-armadura-e-ataque.md), [backlog recursos](../01-requisitos/backlog-economia-de-recursos-do-personagem.md) |
| [vietts/dm-dashboard-oss](https://github.com/vietts/dm-dashboard-oss) | MIT | 09/01/2026 | **Catálogo de escopo.** Metade DM não serve (é trabalho do modelo aqui); metade jogador é a lista das lacunas de mecânica | [backlog recursos](../01-requisitos/backlog-economia-de-recursos-do-personagem.md), [backlog CA](../01-requisitos/backlog-classe-de-armadura-e-ataque.md) |
| [neuralinitiative/claude-dnd-skill](https://github.com/neuralinitiative/claude-dnd-skill) | **AGPL-3.0** | — | **Só desenho.** Concorrente direto; ideias fortes, código intocável | [US-112](../01-requisitos/US-112-arco-de-beats-do-que-muda.md), [US-113](../01-requisitos/US-113-vinculos-ancorados-na-fonte-no-ledger.md) |
| [tegridydev/dnd-llm-game](https://github.com/tegridydev/dnd-llm-game) | "Other" | 23/05/2026 | **Só arquitetura.** Split narração × modelo utilitário; RAG de PDF como lore | [US-114](../01-requisitos/US-114-modelo-utilitario-para-extracao-e-fecho.md), [ADR 010](../../adr/010-upload-de-livro-como-lore.md) |
| [nisakson2000/dnd-tracker](https://github.com/nisakson2000/dnd-tracker) | "Other" | 14/04/2026 | **Só regra.** Stack Tauri/Rust incompatível; o valor é a árvore de CA e a precedência de atributo do importador de D&D Beyond | [backlog CA](../01-requisitos/backlog-classe-de-armadura-e-ataque.md) |
| [dhorions/DnDGenerate](https://github.com/dhorions/DnDGenerate) | MPL-2.0 | 30/01/2024 | **Reavaliado.** Descartei na primeira leitura (gerador one-shot, Java, 2024); voltou por decisão da mantenedora — integridade referencial, `narrative`, `followUps` | [backlog do motor](../01-requisitos/backlog-motor-de-geracao-de-aventuras.md) |
| [cpuchip/dnd-tools](https://github.com/cpuchip/dnd-tools) | MIT | 11/06/2026 | **Convergência.** Mesma fonte (Open5e, SRD 5.2) e mesma disciplina de dado fora do LLM. Pouco a extrair porque já fazemos, com mais rigor. **Achado negativo útil:** o `levelup` dele não resolve feature por nível — a D2 segue sem solução conhecida | este documento |
| [katherineberton/spell-slot-tracker](https://github.com/katherineberton/spell-slot-tracker) | **ausente** | 07/07/2022 | **Contraexemplo.** Implementou a economia inteira; mostrou onde o backlog de recursos estava estreito. Nada copiável | [backlog recursos](../01-requisitos/backlog-economia-de-recursos-do-personagem.md) |
| [nqs/dnd-campaign-template](https://github.com/nqs/dnd-campaign-template) | **ausente** | 22/07/2026 | **Descartado.** Workspace de prep para mestre humano (transcrição, PDF de handout, wiki). Sem interseção com um mestre que é a IA | — |
| [drovani/dnd-maintainer](https://github.com/drovani/dnd-maintainer) | **ausente** | — | **Descartado.** Sem licença, e o que oferece já existe aqui | — |
| [ZoltyMat/dnd](https://github.com/ZoltyMat/dnd) | **ausente** | 10/03/2026 | **Descartado.** Campanha solo local (Copilot+VS Code+MCP), não produto hospedado; arquitetura só confirma decisões já tomadas (tool-calling, prompt por tipo de turno). `lessons-learned.md` (autocrítica do Mestre entre sessões) é ideia sem equivalente, anotada e não acionada | — |
| [SirDarcanos/openfray](https://github.com/SirDarcanos/openfray) | **AGPL-3.0** | 07/08/2026 | **Referência ativa, ideia só.** Confirmou dois gaps reais: concentração (prompt já se declara fora de escopo em `dm-system.ts:289` sem tool que feche isso) e recurso de monstro tipo ação lendária (cai no GEN-9 do motor, não no backlog de recursos do jogador). Achado negativo: `conditions` do `CharacterState` é lido mas sem escritor visível. `src/combat/initiative.ts` lido a fundo (permitido sob AGPL) — deu o desenho do ponteiro de turno por id, tick de round e decremento de concentração | este documento, [backlog de combate por turno](../01-requisitos/backlog-combate-por-turno.md) |
| [Tetra-cube/Tetra-cube.github.io](https://github.com/Tetra-cube/Tetra-cube.github.io) | **ausente** | 13/05/2026 | **Descartado.** Editor manual de statblock/personagem/item, sem IA, cliente único. `books.json` cataloga sourcebook fora do SRD/OGL (DMG, MToF, VGtM, XGtE...) — dado ali é mais restrito que licença de código, incompatível com [ADR 004](../../adr/004-origem-do-dado-de-sistema.md). Objeto `mon` de `statblock-script.js` serviu só de checklist: confirma que a redução por papel da GEN-9 é escopo certo, não lacuna | este documento |
| [cdmatherly/dnd_builds](https://github.com/cdmatherly/dnd_builds) | **ausente** | 04/06/2023 | **Descartado.** Projeto de bootcamp (Flask+MySQL), 0 stars, sem README. Raça/classe/antecedente são texto de dropdown sem fonte SRD; zero mecânica. Atrás do que o repo já tem (US-105/106, US-121/122) | — |
| [cdmatherly/mystic-mimic](https://github.com/cdmatherly/mystic-mimic) | **ausente** | 05/06/2023 | **Descartado.** Mesma turma de bootcamp do `dnd_builds`, um dia depois. MERN+Socket.io, campanha compartilhada, chat/dado "ao vivo" sem lógica de dado visível no servidor (suspeita de rolagem client-side, sem autoridade). Único achado: padrão `join_room(campaign_id)`, útil só se a fase 4 (multiplayer) for escopada — e o mesmo arquivo tem um handler de broadcast sem escopo de sala ao lado, como contraexemplo do erro a não repetir | — |
| [CheekyChinchilla/CozyVTT](https://github.com/CheekyChinchilla/CozyVTT) | **AGPL-3.0** | 14/07/2026 | **Referência de infraestrutura, ideia só.** VTT (mesa virtual visual — mapa, token, luz, fog of war), não Mestre por IA; categoria de produto diferente, maior parte não serve. Controle de acesso por papel, postura de segurança de produção e ficha multi-sistema, relevantes pra fase 4. `backend/src/websocket/handlers/tokens.ts` lido a fundo (permitido sob AGPL) — protocolo de três fases de movimento e recálculo de visibilidade por jogador | este documento, [backlog de mapa em tempo real](../01-requisitos/backlog-mapa-em-tempo-real.md) |

Duas outras referências foram triadas pela mantenedora dentro do
[backlog do motor](../01-requisitos/backlog-motor-de-geracao-de-aventuras.md) → *Triagem das
referências*, e ficam com ele: `github.com/Hayawi/OneShotGenerator` (descartada) e o gist de
system prompt do `tock-dev` (aceita — virou a ordem de geração).

---

## Como citar numa US, ADR ou backlog

Padrão já usado no [ADR 010](../../adr/010-upload-de-livro-como-lore.md) e nos dois backlogs de
mecânica. Uma tabela no fim do documento:

```markdown
### Referências externas

Lidas por README e metadados da API do GitHub — código não executado nem auditado. Nenhuma
decisão aqui se apoia na autoridade delas.

| Repositório | Licença | Rendeu |
|---|---|---|
| [org/repo](https://github.com/org/repo) | MIT | o que aquilo autorizou, em uma linha |
```

Se o repo for **AGPL** ou **sem licença**, a linha diz isso em negrito e o corpo do documento
repete a proibição onde a ideia é usada — como a US-112 e a US-113 fazem: *"reimplementar, nunca
copiar"*. Redundância aqui é barata; a alternativa é alguém abrir o código seis meses depois sem
o contexto.

---

## Quando re-triar

- **Licença muda.** Repo sem licença pode ganhar uma; "Other" pode virar padrão. Vale reler antes
  de qualquer decisão que dependa de copiar.
- **A referência foi descartada por idade e o repo voltou a andar.** O `DnDGenerate` já mostrou
  que descarte não é permanente.
- **Uma decisão nossa mudou de lado.** Quando a inversão do DEF-2 aconteceu, valeu revisitar o que
  as outras referências diziam sobre armazenar vs derivar.

Não vale re-triar por rotina. Este registro existe para **não** repetir o trabalho.
