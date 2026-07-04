# US-26 — Criação de personagem em etapas com trilha de progresso

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Pronta para desenvolvimento
**Depende de:** [US-20](./US-20-catalogo-de-sistemas-via-api.md) (catálogo de sistemas via API — reusado na etapa de Sistema) e [US-01](#) (criação de personagem já existe). A etapa de **Perícias** é preenchida por [US-27](./user-stories.md); esta story entrega o *slot* dela, não o conteúdo. Navegação de/para o assistente vem de [US-25](./US-25-boas-vindas-adaptativa.md); a etapa de **aventura** foi separada para [US-28](./user-stories.md).
**Criada em:** 2026-07-03

---

## História

> **Como** jogador,
> **quero** criar o personagem num assistente com etapas claras (Sistema → Raça/Classe → Atributos → Perícias → Revisão), com uma trilha lateral que mostra onde estou e o que já concluí,
> **para que** eu consiga avançar e voltar entre as etapas sem perder o que já preenchi, e revisar tudo antes de confirmar.

---

## Contexto e motivação

### O problema observado

O `SetupWizard` atual amontoa toda a criação de personagem numa **única tela-formulário** (o passo `character`): nome, género, raça, classe e todos os atributos de uma vez, seguido direto do passo de aventura. O fluxo real é `system → character → adventure`, sem volta e sem revisão.

Consequências no fluxo de design **1a (telas 3–6)**:

- **Não há como voltar.** A "trilha" atual é só uma barra de progresso decorativa (três traços em `SetupWizard.tsx:109-113`); clicar nela não navega, e não existe botão **Voltar**. Se o jogador escolheu o sistema errado ou quer rever a raça, tem de recarregar e recomeçar.
- **Não há revisão.** O personagem é criado (`api.createCharacter`) no fim do passo `character`, sem uma tela que resuma o que vai ser persistido. O jogador confirma às cegas.
- **Atributos sem orçamento.** Cada atributo é um `<input type=number>` solto com `min`/`max` do config (`SetupWizard.tsx:91-101`); nada impede o jogador de maximizar todos. O design 1a pede **point-buy** com "pontos restantes".
- **Sem etapa de perícias.** O design 1a tem uma etapa "Perícias" entre Atributos e Revisão; hoje ela não existe.

### Por que a solução atual não basta

O `SetupWizard` tem `type Step = 'system' | 'character' | 'adventure'` e um `useState<Step>` que só avança (`setStep('character')`, `setStep('adventure')`) — nunca retrocede, e a barra de progresso é puramente visual. Reaproveitar a estrutura significa **quebrar o passo `character` em três** (Raça/Classe, Atributos, Perícias), **inserir Revisão** antes do `createCharacter`, e transformar a barra numa **trilha navegável** com estado por etapa (pendente / atual / concluída). Também tira a etapa `adventure` daqui — ela vira US-28.

### A proposta

Reestruturar a criação num assistente de **cinco etapas** com uma **trilha de progresso** lateral (ou topo) que reflete o estado de cada etapa e permite voltar às já concluídas. Cada etapa valida a si mesma ao avançar; a última (**Revisão**) resume tudo e só então chama `api.createCharacter`. O mesmo assistente é reusado pela ramificação "criar novo personagem" do fluxo 2a, reentrando a partir da etapa de Sistema.

---

## Escopo

### Dentro do escopo

- **Assistente de 5 etapas** com ordem fixa: `Sistema → Raça/Classe → Atributos → Perícias → Revisão`.
- **Trilha de progresso** mostrando, para cada etapa, o estado: **pendente**, **atual** ou **concluída**. Etapas já concluídas são clicáveis para voltar; etapas à frente da atual não.
- **Botões Voltar / Próximo** em cada etapa (a primeira não tem Voltar; a última troca "Próximo" por **Confirmar personagem**).
- **Validação por etapa ao avançar:**
  - Sistema: um sistema selecionado (reusa [US-20](./US-20-catalogo-de-sistemas-via-api.md)).
  - Raça/Classe: nome obrigatório; **género, raça e classe são escolhidos em listas fechadas** (seleção, não texto livre). Género: Feminino, Masculino, Não-binário. Raças: Anão, Meio-Orc, Elfo, Halfling, Humano, Dragonborn, Gnomo, Meio-Elfo, Tiefling. Classes: Bárbaro, Bardo, Clérigo, Druida, Guerreiro, Monge, Paladino, Patrulheiro, Ladino, Feiticeiro, Bruxo, Mago. Avançar exige género, raça e classe selecionados.
  - Atributos: **point-buy** — mostra "pontos restantes" e **bloqueia Próximo** se o orçamento estourar ou sobrar (ver Questões em aberto sobre a fonte do orçamento).
  - Perícias: **por enquanto**, o jogador escreve **3 perícias** em texto livre para o personagem (a regra completa dirigida pelo sistema — lista fechada + orçamento — fica para [US-27](./user-stories.md)). Avançar exige as 3 preenchidas.
- **Persistência do preenchimento entre etapas:** voltar e avançar **não** apaga o que já foi preenchido (estado mantido enquanto o assistente está montado).
- **Tela de Revisão** que resume nome, género, raça, classe, nível, atributos e perícias; o botão **Confirmar personagem** persiste via `api.createCharacter` (uma única chamada, no fim).
- **Reuso pelo fluxo 2a:** "Criar novo personagem" (US-25) entra no assistente a partir da etapa de Sistema.
- Estados de **carregamento/erro** já existentes (spinner ao confirmar; mensagem de erro se `createCharacter` falhar) preservados.
- **Campo `pointBuy.budget` opcional no `SystemConfig`** (`packages/shared/src/types/system.ts`) + seed dos sistemas D&D 5e **e Free** com os mesmos 6 atributos (faixa 8–15) e `budget: 27` — é a fonte do orçamento da etapa de Atributos (ver Modelo de dados e Questão #1 resolvida).

### Fora do escopo

- **Conteúdo da etapa de Perícias** (lista de perícias, orçamento, injeção no DM) — é [US-27](./user-stories.md). Esta story só entrega o passo vazio/estrutural na trilha.
- **Seleção de aventura** (a antiga etapa `adventure`) — movida para [US-28](./user-stories.md). O assistente de US-26 **termina** em "Confirmar personagem"; quem encadeia para a aventura é US-28.
- **Edição de personagem existente** pelo assistente (o wizard é só criação).
- **Login/conta** (US-24) — assume-se `userId` já conhecido, como hoje (`loadSession` / `api.createUser` guest).

---

## Modelo de dados proposto

Esta story é majoritariamente de **UI/fluxo**: não cria tabela nova e a persistência final continua sendo o `api.createCharacter` já existente. A única alteração de **contrato de dados** é opcional e habilita o point-buy:

```jsonc
// SystemConfig — campo novo opcional para orçamento de atributos
{
  "attributes": [ { "key": "for", "label": "Força", "min": 8, "max": 15, "default": 8 } ],
  "startingKits": { "default": [] },
  "pointBuy": { "budget": 27 }   // ← novo (opcional); 27 = padrão D&D 5e. Ausente = etapa de atributos cai no modo livre atual
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `pointBuy.budget` | number \| ausente | Total de pontos distribuíveis entre atributos. Se ausente, a etapa de Atributos mantém o comportamento livre de hoje (inputs `min`/`max` sem orçamento). |

**Persistência:** nenhuma nova. O personagem final é gravado por `api.createCharacter({ userId, systemId, name, gender, race, class, attributes, ... })` — o mesmo de hoje. O estado do assistente (etapa atual, campos preenchidos) vive só em memória no componente; **não** se persiste rascunho no servidor (ver Fora do escopo / Questões em aberto).

---

## Critérios de aceite

- [ ] O assistente tem exatamente as etapas **Sistema → Raça/Classe → Atributos → Perícias → Revisão**, nessa ordem.
- [ ] Existe uma **trilha de progresso** que, para cada etapa, indica visualmente se está **pendente**, **atual** ou **concluída**.
- [ ] Cada etapa (exceto a primeira) tem **Voltar**; cada etapa (exceto a última) tem **Próximo**; a última tem **Confirmar personagem**.
- [ ] **Voltar** para uma etapa anterior e voltar a avançar **preserva** tudo o que já foi preenchido (nome, raça, classe, atributos, perícias).
- [ ] Clicar numa etapa **já concluída** na trilha navega até ela; clicar numa etapa **à frente** da atual não faz nada.
- [ ] **Próximo** valida a etapa atual e **não avança** se inválida: Raça/Classe exige nome + uma **raça** e uma **classe** selecionadas das listas; Atributos exige orçamento de point-buy fechado (nem sobra nem falta pontos) quando `pointBuy.budget` existe.
- [ ] Na etapa de **Raça/Classe**, género (Feminino, Masculino, Não-binário), raça (9 raças-base) e classe (12 classes-base) são escolhidos em **seleções** (não texto livre); não é possível avançar sem escolher os três.
- [ ] Na etapa de **Atributos** com point-buy, é exibido o número de **pontos restantes**, e ele nunca fica negativo (não dá pra gastar além do orçamento).
- [ ] Na etapa de **Perícias**, o jogador escreve **3 perícias** em texto livre; **Próximo** fica bloqueado enquanto as 3 não estiverem preenchidas.
- [ ] A etapa de **Revisão** mostra um resumo com nome, género, raça, classe, nível, atributos e as 3 perícias antes de confirmar.
- [ ] **Confirmar personagem** chama `api.createCharacter` **uma única vez** (não a cada etapa) e, em caso de erro, mostra mensagem sem perder o preenchimento.
- [ ] "Criar novo personagem" / "Criar meu personagem" (US-25) abre este assistente na etapa de **Sistema**.
- [ ] A antiga etapa de **aventura** **não** faz parte deste assistente (é US-28); o fluxo termina em Revisão/Confirmar.
- [ ] **Eval / teste de regressão (navegação):** preencher Raça/Classe, avançar até Atributos, voltar para Raça/Classe e avançar de novo mantém os valores digitados; a trilha marca Raça/Classe como concluída e Atributos como atual.
- [ ] **Eval / teste de regressão (validação):** com `pointBuy.budget` definido, o botão **Próximo**/**Confirmar** fica bloqueado enquanto sobrarem ou faltarem pontos, e libera exatamente quando o orçamento fecha.

---

## Notas de implementação

- **Arquivo principal:** `apps/web/src/components/setup/SetupWizard.tsx`. Trocar `type Step = 'system' | 'character' | 'adventure'` por `'system' | 'race-class' | 'attributes' | 'skills' | 'review'` e definir a lista `steps` na nova ordem.
- **Trilha navegável em vez de barra decorativa:** a barra atual (`SetupWizard.tsx:109-113`) já calcula "antes/depois da etapa atual" via `steps.indexOf(step)`. Transformar cada segmento num `<button>` que só é clicável se `steps.indexOf(s) < steps.indexOf(step)` (etapa concluída). O estado por etapa sai do próprio índice — não precisa de estrutura extra.
- **Preservar preenchimento:** os `useState` já existem por campo (`charData`, `attrs`) e sobrevivem à troca de `step` — desde que a navegação **não desmonte** o componente. Basta **não** chamar `createCharacter` antes da Revisão (hoje ele é chamado no fim do passo `character`, `SetupWizard.tsx:60-70`). Mover essa chamada para o handler de Confirmar da Revisão.
- **Point-buy (regra D&D 5e — confirmada):** cada atributo parte de **8** e sobe até **15**; distribui-se um orçamento de **27 pontos** com custo **progressivo** ("diminishing returns above 13"). Tabela de custo acumulado por valor:

  | Valor | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
  |---|---|---|---|---|---|---|---|---|
  | Custo | 0 | 1 | 2 | 3 | 4 | 5 | 7 | 9 |

  Derivar `pontosRestantes = budget - Σ(custo(valor de cada atributo))`. Codificar a tabela como um mapa `{8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9}` — não é fórmula linear (13→14 custa 2, 14→15 custa 2). Reusar `attrInput` (`SetupWizard.tsx:91-101`) trocando os `<input>` livres por botões +/- que respeitam o intervalo 8–15 **e** o orçamento (não deixam `pontosRestantes` ficar negativo). Se `pointBuy.budget` for ausente no config, manter os inputs livres de hoje (`min`/`max` do atributo), compatível com sistemas sem orçamento. Ver [regras de atributos (Runic Dice)](https://www.runicdice.com/blogs/news/dnd-5e-ability-scores-explained).
- **Validação por etapa:** uma função `canAdvance(step): boolean` consultada pelo botão Próximo (desabilita) e pela navegação da trilha. Mantém a validação num só lugar.
- **Etapa de Raça/Classe:** hoje raça e classe são texto livre (`SetupWizard.tsx:143-153`). Trocar o `<input>` de **raça** por um `<select>` (ou lista de botões, como o passo de Sistema) populado por uma constante no front — as 9 raças-base de D&D do [guia da Dicebreaker](https://www.dicebreaker.com/categories/roleplaying-game/how-to/dnd-races):

  ```ts
  const GENDERS = ['Feminino', 'Masculino', 'Não-binário'] as const
  const RACES = ['Anão', 'Meio-Orc', 'Elfo', 'Halfling', 'Humano', 'Dragonborn', 'Gnomo', 'Meio-Elfo', 'Tiefling'] as const
  const CLASSES = ['Bárbaro', 'Bardo', 'Clérigo', 'Druida', 'Guerreiro', 'Monge', 'Paladino', 'Patrulheiro', 'Ladino', 'Feiticeiro', 'Bruxo', 'Mago'] as const
  ```

  `canAdvance('race-class')` = nome preenchido + género (um de `GENDERS`) + raça (uma de `RACES`) + classe (uma de `CLASSES`). Trocar os três `<input>` livres de género, raça e classe por `<select>`/lista de botões. Mover essas listas para o `SystemConfig` (por-sistema, já que "Free" não teria raças/classes) é evolução de US-21 — fora do escopo aqui; por ora as constantes vivem no componente, como o `SOURCE_TYPE_HINT` já existente.
- **Etapa de Perícias (interina):** 3 `<input>` de texto livre (`useState<string[]>` de tamanho 3, ou `['','','']`). `canAdvance('skills')` = as 3 não-vazias (trim). Persistir junto do personagem em `createCharacter` (campo `skills: string[]`) e exibir na Revisão. US-27 depois troca os inputs livres por uma lista fechada vinda do `SystemConfig` + orçamento; deixar um `// TODO US-27` no passo.
- **Não** introduzir rascunho persistido no servidor: o estado do assistente é local; se o jogador fecha a aba, recomeça. Simples e alinhado ao MVP (ver Questões em aberto se isso incomodar).
- **Testes:** estender `apps/web/src/components/setup/SetupWizard.test.tsx` com os dois cenários de regressão (navegação ida-e-volta preserva estado; bloqueio de point-buy).

---

## Questões em aberto

1. ~~**Fonte do orçamento de point-buy.**~~ **Resolvido:** o orçamento vem de um campo **`pointBuy.budget` opcional no `SystemConfig`** (`pointBuy: z.object({ budget: z.number().int().positive() }).optional()` em `packages/shared/src/types/system.ts`), definido no seed dos sistemas D&D 5e **e Free** como `27` (ambos com os mesmos 6 atributos `min:8`/`max:15`). Mantém "sistema como dado" (ADR 003 / US-21): integrar um sistema é inserir `System` + `config`, sem tocar no `SetupWizard`. **`pointBuy` ausente → etapa de Atributos cai no modo livre** (inputs `min`/`max` sem orçamento), cobrindo sistemas futuros sem point-buy (ex.: uploads sem orçamento). A **faixa** vem do `min`/`max` de cada atributo (já no config) e a **tabela de custo** fica como constante no front (é a curva 5e; só vira dado quando surgir um sistema com curva própria).
2. ~~**Custo do point-buy.**~~ **Resolvido:** usar a lógica point-buy de D&D 5e — 27 pontos, faixa 8–15, tabela de custo progressiva (ver Notas de implementação e [referência Runic Dice](https://www.runicdice.com/blogs/news/dnd-5e-ability-scores-explained)).
3. ~~**Rascunho ao sair.**~~ **Resolvido:** perder o preenchimento ao fechar a aba é aceitável no MVP — o estado do assistente é local (em memória) e não se persiste rascunho. Rascunho em `localStorage`/servidor fica como evolução futura, se necessário.
4. ~~**Lista de raças — confirmar.**~~ **Resolvido:** as 9 raças são Anão, Meio-Orc, Elfo, Halfling, Humano, Dragonborn, Gnomo, Meio-Elfo, Tiefling. A lista fica no front por ora; mover para `SystemConfig` (por-sistema) é evolução de US-21.
5. ~~**Nível na Revisão.**~~ **Resolvido:** o personagem é sempre criado no **nível 1** na Fase 1 — não é campo escolhível. Na Revisão o nível aparece como valor fixo ("Nível 1"), não editável.

---

## Referências no código

- `apps/web/src/components/setup/SetupWizard.tsx` — assistente atual (`system → character → adventure`); barra de progresso decorativa e `createCharacter` chamado cedo demais. **Arquivo principal a reestruturar.**
- `apps/web/src/components/setup/SetupWizard.test.tsx` — testes do wizard; estender com navegação ida-e-volta e point-buy.
- `apps/web/src/lib/api.ts` — `api.createCharacter`, `api.listSystems`, `api.createUser` (reusados; a chamada de criação move-se para a Revisão).
- `packages/shared/src/types/system.ts` — `SystemConfig` (`attributes` + `startingKits`); onde entraria `pointBuy.budget` opcional.
- `docs/sdlc/01-requisitos/US-20-catalogo-de-sistemas-via-api.md` — etapa de Sistema reusa o catálogo.
- `docs/sdlc/01-requisitos/US-25-boas-vindas-adaptativa.md` — de onde o jogador entra no assistente ("Criar meu personagem" / "Criar novo personagem").
- `docs/sdlc/01-requisitos/user-stories.md` — índice; US-26 nas linhas 26–32 e no mapa de cobertura dos fluxos 1a/2a (telas 3–6).

### Referências externas (regras)

- [Guia de raças de D&D — Dicebreaker](https://www.dicebreaker.com/categories/roleplaying-game/how-to/dnd-races) — panorama das espécies/raças de D&D; base para os exemplos da etapa **Raça/Classe**.
- [Ability Scores explained — Runic Dice](https://www.runicdice.com/blogs/news/dnd-5e-ability-scores-explained) — os seis atributos e o método **point-buy** (27 pontos, faixa 8–15, custo progressivo); base da etapa **Atributos**.
