# US-68 — Nomes de fantasia originais e ancorados na cultura da cena

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** 🚧 Em progresso
**Depende de:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (ofício narrativo no system prompt — é onde esta regra entra).
**Criada em:** 2026-07-22

---

## História

> **Como** jogador,
> **quero** que o AI DM batize NPCs, lugares e coisas com nomes de fantasia originais e coerentes com a cultura da cena (a sonoridade do nome — celta, greco, nórdico, rústico… — segue o povo, a raça e o ambiente do personagem e da situação),
> **para que** o mundo pareça um lugar com povos e histórias próprias, e não uma sucessão dos mesmos nomes de fantasia genéricos ("Elara", "Kael") que denunciam texto de IA.

---

## Contexto e motivação

### O problema observado

O ofício narrativo da [US-34](./US-34-qualidade-da-narracao-do-dm.md) já manda **nomear as coisas** ("Be concrete and NAME things: the mount, the sword, the holy symbol, the NPC"). Mas manda nomear — não diz **como escolher o nome**. Sem orientação, o modelo cai nos nomes que mais aparecem no seu treino: **Elara, Kael, Lyra, Aria, Zephyr, Seraphina, Thorne**. São os "nomes-slop" da fantasia gerada por IA. O sintoma:

- **Repetição entre sessões:** a taverneira de uma aventura e a maga de outra se chamam ambas "Elara". Cada mundo perde identidade.
- **Sem coerência cultural:** um vilarejo de pescadores no litoral, uma aldeia druídica na floresta e um templo de mármore recebem NPCs com a mesma sonoridade genérica. O nome não diz de onde a pessoa vem.
- **Falta de intenção:** nomes de lugar (a vila, a estalagem, a estrada) saem igualmente genéricos ou em inglês solto, quebrando a imersão em pt-BR.

### Por que a solução atual não basta

A seção `## Narrative craft` em `packages/ai-engine/src/prompts/dm-system.ts` (linhas ~220–230) instrui a **concretude** ("A specific detail beats a generic one"), mas trata o nome como um detalhe qualquer. Não há **nenhuma** regra sobre a *procedência* ou a *sonoridade* do nome. O `buildOpeningInstruction` (que dispara a primeira cena) também só pede para "name concrete things" — herda a mesma lacuna. Resultado: o modelo é livre para repetir o mesmo punhado de nomes de treino.

### A proposta

Adicionar ao ofício narrativo uma regra de **onomástica**: como o AI DM escolhe nomes de pessoas, lugares e coisas. Dois eixos:

1. **Originalidade** — proibir explicitamente a lista de nomes-clichê e exigir variação; um nome não deve reaparecer entre personagens sem motivo de ficção.
2. **Ancoragem cultural** — a **sonoridade** do nome segue o registro da cena e do personagem, escolhido a partir de uma paleta **aberta** de registros culturais (celta, greco-clássico, nórdico, latino, árabe/persa, eslavo, élfico, anão, gutural, infernal, rústico — e outros que o DM cunhe quando a ficção pedir). Paladino/nobre/templo → greco; druida/floresta → celta; bárbaro/gelo → nórdico; halfling/vilarejo → rústico; e assim por diante. O DM escolhe o registro pela ficção, não por acaso — e tem liberdade de inventar sonoridades novas desde que fujam do slop.

É uma mudança de **prompt apenas** — sem schema, sem tool, sem dado novo.

---

## Escopo

### Dentro do escopo

- Uma subseção de **onomástica** dentro de `## Narrative craft` em `buildDmSystemPrompt`, aplicável à abertura e a todos os turnos.
- Regra de **originalidade**: lista curta de nomes-slop banidos (Elara, Kael, Lyra, Aria, Zephyr, Seraphina, Thorne… como *exemplos do que evitar*, não lista fechada) + instrução de não repetir um nome já usado nesta aventura para outra pessoa/lugar.
- Regra de **ancoragem cultural**: uma paleta **aberta** de registros de sonoridade (celta/gaélico, greco-clássico, nórdico/germânico, latino/romano, árabe/persa, eslavo/folclórico, élfico "alto", anão/subterrâneo, gutural bruto, infernal/exótico, rústico/bucólico, nipônico, egípcio antigo, mesoamericano, hebraico/celestial, sânscrito/índico, africano subsaariano) com orientação de **quando** usar cada um (raça, classe, ambiente, tom da cena), e liberdade de misturar/variar dentro do registro para nomes de **pessoas, lugares e coisas**.
- **Paleta aberta:** os registros da tabela são ponto de partida, não lista fechada. O DM pode **cunhar registros/sonoridades novos** para culturas que a paleta não cobre, desde que o resultado seja original (fora do slop) e internamente consistente.
- Aplicar a mesma orientação a nomes **próprios de lugar e de objeto** (a vila, a estalagem, a espada, o navio), não só a NPCs.
- Reforço no `buildOpeningInstruction` para que a **primeira cena** já nasça com nomes no registro certo.
- Nomes em prosa **pt-BR natural** (coerente com a regra de LANGUAGE já existente): o nome próprio pode ser de sonoridade estrangeira, mas a frase ao redor é pt-BR.

### Fora do escopo

- O **nome do personagem do jogador** — vem da criação de personagem, não é gerado pelo DM. Esta US governa só o que o DM inventa.
- **Banco de nomes / gerador determinístico** (tabela de sílabas, lista curada por cultura). Seria mais robusto contra repetição, mas é peso de dado/tool; se a regra de prompt não bastar, vira story própria. Ver Questões em aberto.
- **Consistência de nome entre sessões diferentes** de campanhas distintas. O alvo é originalidade e coerência *dentro* da aventura; unicidade global exigiria persistir nomes usados.
- **Registros além dos listados na tabela** (nórdico-sámi, polinésio, mongol-estepe…). A paleta já cobre bem as raças SRD e os arquétipos de Fase 1; nomes de culturas fora dela ficam a cargo da regra de paleta-aberta (o DM cunha), sem virar linha nova no prompt.
- Suíte de **eval** dedicada a onomástica como entrega bloqueante — o critério de regressão abaixo cobre o mínimo; medir por rubrica é candidato a evoluir a [US-36](./US-36-eval-de-qualidade-da-narracao.md).

---

## Abordagem técnica

Mudança única em `packages/ai-engine/src/prompts/dm-system.ts`, dentro de `## Narrative craft`, mais um reforço curto em `buildOpeningInstruction`. Regras acionáveis (não decorativas):

- **Nomes originais:** nunca use os nomes-clichê de fantasia de IA (ex.: Elara, Kael, Lyra, Aria, Zephyr, Seraphina, Thorne). Invente nomes próprios. Dentro de uma aventura, **não reutilize** um nome já dado a outra pessoa ou lugar.
- **Escolha o registro pela ficção** — a **raça, a classe e o ambiente** decidem; o registro é escolha, não sorteio. Paleta:

  | Registro | Quando usar | Sonoridade / exemplos-sabor |
  |---|---|---|
  | **Greco-clássico** | nobreza, templos, cidades de mármore, ordens de paladinos/clérigos, litoral civilizado | vogais abertas, terminação -os/-ia — *Thessaly, Kallias, Nerites, Andraste, Elpis, Orphaion* |
  | **Celta/gaélico** | druidas, povos da floresta, clãs, terras brumosas do norte | *Brannoc, Maeve, Caerwyn, Deirdre, Aodhan, Dunmore* |
  | **Nórdico/germânico** | bárbaros, anões, terras geladas, clãs guerreiros, montanhas | consonantal, martelado, runas — *Bjorn, Ragnhild, Thorgrim, Ustengrav, Fjall* |
  | **Latino/romano** | impérios, legiões, lei, ordens militares, cidades imperiais | mais duro que o grego, -us/-ia — *Valerius, Cassia, Aurelian, Tarquin, Vexillum* |
  | **Árabe/persa** | desertos, cidades-oásis, mercadores, gênios, magia de fogo/areia | guturais suaves, vogais longas — *Zahir, Nadira, Qasr al-Rihla, Farideh, Suleikha* |
  | **Eslavo/folclórico** | bruxas, florestas escuras do leste, pântanos, folclore sombrio | *Vasska, Miroslav, Zbroja, Yaga, Dolina* |
  | **Élfico "alto"** | elfos antigos, cortes feéricas, ruínas sagradas | fluido, vogais longas, poucos sons duros — *Ithriel, Caelmaros, Sylunae* ⚠️ é onde mora o slop; variar, não cair no default |
  | **Anão/subterrâneo** | fortalezas, forjas, mineração (pode fundir com nórdico) | sílaba fechada, gutural — *Durgan, Khazrund, Baltrek* |
  | **Gutural bruto** | orcs, goblinoides, meio-orcs, tribos hostis, monstros | consoante dura, sílaba curta, apóstrofo — *Gru'ak, Mor'zag, Drukka* |
  | **Infernal/exótico** | tieflings, cultos, pactos, planos inferiores | sibilante, apóstrofo, sonoridade "errada" de propósito — *Malacar, Nyx'thel, Vaerith* |
  | **Rústico/bucólico** | halflings, vilarejos pacíficos, estalagens, campônios | nomes caseiros, terrosos, pt-BR-amigáveis — *Tobias Cravo, Aldeia de Ervadoce, Estalagem do Porco Gordo* |
  | **Nipônico** | monges, artes marciais, ordens de honra, clãs isolados, montanhas de névoa | sílabas abertas, cadência limpa — *Kaede, Ryōzen, Takumi, Hoshimura, Aoiya* |
  | **Egípcio antigo** | templos mortuários, mortos-vivos, desertos áridos, dinastias, cultos do sol | consoantes secas, vogais graves — *Nebetah, Kharouf, Sethra, Amonkar, Duat-Nefer* |
  | **Mesoamericano** | selvas, pirâmides, cultos do sol/sacrifício, cidades de pedra na floresta | plosivas fortes, "tl/tz" — *Itzalna, Tepoztli, Xochtli, Kukulmac, Tlacaél* |
  | **Hebraico/celestial** | anjos, profecia, celestiais, ordens sagradas, planos superiores | terminação -el/-iel, tom solene — *Zadkiel, Nethanya, Uriah, Saraphel, Meridiel* |
  | **Sânscrito/índico** | ascetas, magia cósmica, monastérios remotos, feras sagradas, ciclos e destino | vogais longas, aspiradas — *Ashvara, Devani, Kaladhar, Surinza, Mahatpa* |
  | **Africano subsaariano** | savanas, espíritos ancestrais, reinos tribais, tambores e máscaras | ritmo silábico, tons — *Adeyemi, Zolani, Nkemdi, Okarra, Baraköa* |

- **Paleta ABERTA, não fechada:** os 11 registros e seus exemplos são um **ponto de partida** para calibrar sonoridade, não uma lista exaustiva. Quando a cena pedir uma cultura que a paleta não cobre, **invente** um registro coerente (uma sonoridade própria para aquele povo) e mantenha-o consistente. A ÚNICA fronteira é o slop: a criatividade é livre desde que o nome não recaia nos clichês de fantasia de IA nem copie os exemplos literalmente. Registro novo tratado como cultura de verdade — sons consistentes entre os nomes daquele mesmo povo/lugar.
- **Vale para tudo que recebe nome próprio:** pessoas, aldeias, estalagens, rios, espadas, navios.
- A frase ao redor continua **pt-BR natural**; só o nome próprio carrega a sonoridade estrangeira.
- Marcar como **falha** repetir os nomes-clichê ou dar a NPCs de culturas diferentes a mesma sonoridade genérica.

Essa subseção **soma** ao ofício; não enfraquece nenhuma regra de consistência/formatação existente. Como fica na camada 2 do system (constante por aventura), continua cacheável (US-55) — não há custo de token por turno.

> **Obrigatório após editar `src`:** a API roda `packages/ai-engine/dist`. Rodar `pnpm --filter @ai-dm/ai-engine build` senão a mudança não tem efeito.

---

## Critérios de aceite

- [ ] `buildDmSystemPrompt` inclui uma subseção de onomástica dentro de `## Narrative craft`, aplicável à abertura e a todos os turnos.
- [ ] A subseção **proíbe explicitamente** os nomes-clichê de fantasia de IA (com Elara e Kael entre os exemplos citados) e instrui a inventar nomes originais.
- [ ] A subseção define a paleta de registros de sonoridade (a tabela completa) e diz **quando** usar cada um (raça, classe, ambiente, tom da cena).
- [ ] A subseção deixa a paleta **aberta**: instrui o DM a inventar registros/sonoridades novos para culturas não cobertas, com a **única** fronteira sendo não recair no slop nem copiar os exemplos literalmente.
- [ ] A orientação cobre nomes de **pessoas, lugares e coisas**, não só NPCs.
- [ ] A subseção instrui a **não reutilizar** um mesmo nome para duas pessoas/lugares diferentes dentro da mesma aventura.
- [ ] `buildOpeningInstruction` reforça que a primeira cena já use nomes no registro correto.
- [ ] A regra **não remove nem enfraquece** o ofício da US-34, a regra de LANGUAGE (pt-BR), nem qualquer regra de formatação/consistência.
- [ ] A subseção fica na camada estável do system (não no bloco de turno), preservando o prompt caching da US-55.
- [ ] **(regressão — anti-slop)** Gerando N aberturas (ex.: 10) para personagens/classes variados, nenhum NPC ou lugar se chama Elara/Kael/Lyra/Aria/Zephyr; nomes não se repetem entre as aberturas sem razão de ficha.
- [ ] **(regressão — ancoragem)** Aberturas de arquétipos diferentes produzem o registro esperado: druida/floresta → celta; paladino/templo → greco; bárbaro/gelo → nórdico; halfling/vilarejo → rústico.

---

## Notas de implementação

- **ai-engine:** editar a seção `## Narrative craft` em `packages/ai-engine/src/prompts/dm-system.ts` (após o bullet de "NAME things") e acrescentar uma frase no `buildOpeningInstruction`. Sem novos parâmetros na interface do builder.
- **Build:** `pnpm --filter @ai-dm/ai-engine build` após editar `src` (a API consome `dist`).
- **Exemplos como *sabor*, não como *whitelist*:** os nomes citados no prompt são para calibrar a sonoridade; o modelo deve **variar** a partir deles, nunca copiá-los literalmente. Deixar isso explícito no texto para não trocar um slop por outro.
- **Custo de token vs. cobertura:** com 17 registros, esta é a tabela mais pesada do ofício. Vive na camada 2 (cacheável, US-55) → sem custo por turno, mas ocupa contexto e pode diluir a instrução. Se pesar, condensar cada registro a uma linha (gatilho + 2 exemplos) já basta como âncora; a versão extensa é a tabela desta US. Se ainda assim ficar grande demais, é sinal de migrar para **dado/gerador** (Questão em aberto #1).
- **Respeito cultural:** os registros inspirados em culturas reais (nipônico, egípcio, mesoamericano, hebraico, sânscrito, africano, árabe/persa, eslavo…) são âncoras de **sonoridade inventada**, não coleção de nomes sagrados ou reais literais. Os exemplos-sabor são cunhados no espírito da língua, não retirados de figuras religiosas/históricas concretas; o prompt deve reforçar "inspirado na sonoridade de", nunca caricatura nem apropriação de nome sacro.
- **Testes:** o teste de snapshot/estrutura do system prompt (se existir em `packages/ai-engine`) precisa acomodar a nova subseção. O critério anti-slop é melhor exercido no runner de eval (`evals/`), não em unit test — um assert de "não contém Elara/Kael" sobre saídas geradas é o mínimo barato.
- **Sem mudança de contrato:** nenhuma US anterior muda de comportamento; esta só adiciona orientação de qualidade ao texto do prompt.

---

## Questões em aberto

1. ~~**Prompt basta ou precisa de gerador?**~~ **Resolvido:** por ora a **regra de prompt basta**. Não entra gerador determinístico nesta US. Se a eval mostrar recaída de slop/repetição sob pressão, aí sim vira story própria (gerador por registro cultural, como tool ou pré-injetado).
2. ~~**Persistir nomes usados na aventura?**~~ **Resolvido:** **não persistir** nomes nesta US. A não-repetição fica por conta do que cabe na janela de contexto + instrução do prompt. Reavaliar só se a repetição incomodar em campanhas longas.
3. ~~**Quantos registros?**~~ **Resolvido:** a tabela traz **17 registros** (11 originais + nipônico, egípcio antigo, mesoamericano, hebraico/celestial, sânscrito/índico, africano subsaariano). Culturas fora da tabela ficam a cargo da paleta-aberta (o DM cunha), sem virar linha nova.

---

## Referências no código

- `packages/ai-engine/src/prompts/dm-system.ts` — seção `## Narrative craft` em `buildDmSystemPrompt` (onde a regra entra) e `buildOpeningInstruction` (reforço da abertura).
- `docs/sdlc/01-requisitos/US-34-qualidade-da-narracao-do-dm.md` — story do ofício narrativo; esta US refina a regra de "nomear coisas".
- `docs/sdlc/01-requisitos/US-36-eval-de-qualidade-da-narracao.md` — eval de narração por rubrica; candidato natural a hospedar a checagem anti-slop de nomes.
- `evals/` — runner onde o critério de regressão anti-slop roda sobre saídas geradas.
