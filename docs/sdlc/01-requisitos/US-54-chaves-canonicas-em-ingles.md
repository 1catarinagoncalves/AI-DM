# US-54 — Chaves canônicas de classe em inglês

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player (habilitador de manutenção; sem valor de release)
**Status:** 🚧 Em progresso
**Depende de:** [US-47](./US-47-ingestao-srd-como-dado.md) (o `ingest`, o `CLASS_MAP` e o overlay `pt-BR.json` são a superfície principal desta story)
**Relacionado:** [ADR 005](../../adr/005-locale-como-dimensao.md) (locale como dimensão — registra as chaves PT como dívida; **esta story deve vir ANTES da fase "Ficha" do ADR**, ver "Sequenciamento") · [US-41](./US-41-features-traits-de-classe.md) / [US-42](./US-42-magias-conhecidas.md) (donas do `classFeatures`/`classSpells`) · [US-28](./US-28-aventura-inicial-baseada-na-classe.md) (`initialAdventures.hooks[].classKey`) · [US-52](./US-52-traducao-automatica-do-srd.md) (indexa rascunhos pela mesma chave composta)
**Criada em:** 2026-07-16

---

## História

> **Como** desenvolvedora,
> **quero** que as chaves canônicas de classe sejam `paladin`/`wizard` em vez de `paladino`/`mago`,
> **para que** os identificadores internos falem a língua da base nativa dos dados ([ADR 005](../../adr/005-locale-como-dimensao.md)) e um sistema em EN não seja indexado por chaves PT.

---

## Contexto e motivação

### O problema observado

O [ADR 005](../../adr/005-locale-como-dimensao.md) fixou **EN como a base nativa dos dados**: o dataset é inglês, PT-BR é overlay. As chaves canônicas não acompanharam. Hoje o `config` do SRD — derivado de um dataset inteiramente EN — é indexado assim:

```jsonc
"classFeatures": {
  "paladino": [ { "name": "Impor as Mãos", … } ],   // chave PT, conteúdo EN ou PT conforme o locale
  "mago":     [ { "name": "Recuperação Arcana", … } ]
}
```

E o overlay compõe a chave de feature a partir dela (`${canon}_${slug}` em [ingest.mjs:122](../../../scripts/srd/ingest.mjs:122)):

```jsonc
"paladino_lay-on-hands": { "name": "Impor as Mãos", … }   // metade PT, metade EN
```

Chave é ID: não é exibida, não é traduzida, não tem locale. Mas `paladino_lay-on-hands` **é um ID meio traduzido**, e ele é o índice de uma fonte que só fala inglês. Com `locale = en` ativo (ADR 005), o `config` inteiro fica EN — labels, descrições, magias — indexado por `paladino`.

### Por que a solução atual não basta

Funciona, e vai continuar funcionando: nada disso vaza para a tela. O custo é de manutenção e cresce:

- **O `CLASS_MAP` existe só para desfazer o descasamento.** [ingest.mjs:25](../../../scripts/srd/ingest.mjs:25) mapeia `srd-2024_paladin → paladino`. Com chaves EN, ele vira quase identidade (só tira o prefixo `srd-2024_`) — some um mapa de 12 linhas mantido à mão, e some a classe de bug "classe nova no dataset sem entrada no `CLASS_MAP`" (hoje um `throw`).
- **É a única ilha PT num espaço de chaves EN.** Atributos (`strength`), perícias (`animal_handling`) e magias (`fireball`) já são EN — vêm do `pk` do Open5e. Só classe destoa. Quem lê o código não tem regra: precisa lembrar que *essa* chave é PT.
- **Cada idioma novo herda a esquisitice.** Um overlay `locale/es.json` seria indexado por `paladino_lay-on-hands` — nem espanhol, nem inglês.

### A proposta

Renomear as 12 chaves canônicas de classe para inglês (`barbarian`, `bard`, …, `wizard`), propagando para tudo que as compõe ou consome. **Zero mudança visível ao jogador; zero mudança de comportamento.** É higiene de identificador, não feature.

---

## Sequenciamento (por que agora, e não depois)

⚠️ **Esta story fica mais cara se esperar.** O [ADR 005](../../adr/005-locale-como-dimensao.md) decidiu que `Character.features`/`Character.spells` deixam de guardar `{name, description}` e passam a guardar **chave**. Enquanto isso não acontece, nenhuma linha de `Character` contém chave de classe — o rename toca só `config`, overlay, seed e testes: **nenhum dado de usuário**.

Depois da fase "Ficha" do ADR 005, cada personagem carrega `"paladino_lay-on-hands"` no Json, e o rename vira **uma segunda migração de dados sobre linhas de usuário** — a primeira sendo a do próprio ADR.

**Ordem recomendada:** US-54 → fase "Ficha" do ADR 005. Assim a migração da ficha já nasce escrevendo chave EN, e ninguém migra a mesma coluna duas vezes.

---

## Escopo

### Dentro do escopo

As 12 chaves canônicas (`barbaro→barbarian`, `bardo→bard`, `clerigo→cleric`, `druida→druid`, `guerreiro→fighter`, `monge→monk`, `paladino→paladin`, `patrulheiro→ranger`, `ladino→rogue`, `feiticeiro→sorcerer`, `bruxo→warlock`, `mago→wizard`) e tudo que as usa:

- **`CLASS_MAP`** ([ingest.mjs:25](../../../scripts/srd/ingest.mjs:25)) — vira quase identidade; avaliar se ainda vale existir como mapa ou se um `slice` do prefixo basta (ver Questões em aberto).
- **Chaves de record do `config`** — `startingKits`, `classFeatures`, `classSpells` ([system.ts](../../../packages/shared/src/types/system.ts)); `initialAdventures.hooks[].classKey` (US-28).
- **Chaves compostas do overlay** — `locale/pt-BR.json`: `paladino_lay-on-hands → paladin_lay-on-hands`. O **valor** (texto PT) não muda: continua "Impor as Mãos".
- **Coluna canônica do `CLASS_SYNONYMS`** ([starting-inventory.ts:17](../../../apps/api/src/character/starting-inventory.ts:17)) — o **lado direito** (o destino do match).
- **`seed.ts`** — os kits/features/hooks semeados por chave de classe.
- **Testes e evals** que hardcodam a chave (`character.service.test.ts`, `starting-inventory.test.ts`, `system.test.ts`, `evals/cases/us-41-features.ts`, `us-42-magias.ts`, …).
- **Regenerar `srd-5e.config.json`** pelo `ingest`.

### Fora do escopo

- **A coluna de palavras-chave do `CLASS_SYNONYMS`** (o **lado esquerdo**: `brux`, `patrulhei`, `ranger`, `cacador`). Não são chaves — são o matcher da entrada livre do jogador, e são deliberadamente multilíngues (`paladin` e `ladin` já convivem). Continuam aceitando PT depois desta story: quem digita "Bruxo" tem de achar `warlock`. **Mexer aqui quebra a criação de personagem em PT.**
- **Labels de classe da UI** (`['Bárbaro', 'Bardo', …]` em [SetupWizard.tsx:22](../../../apps/web/src/components/setup/SetupWizard.tsx:22)) — são texto exibido, trabalho da fase "UI" do ADR 005. Esta story não toca em nada que o jogador lê.
- **`Character.class`/`Character.race`** — texto livre do jogador, não chave. Casam via `CLASS_SYNONYMS` e continuam casando. **Sem migração de dados.**
- **Chaves de atributo, perícia e magia** — já são EN (`strength`, `animal_handling`, `fireball`); nada a fazer.
- **`Character.features`/`Character.spells`** — hoje guardam texto, não chave. Viram chave na fase "Ficha" do ADR 005, já em EN se a ordem acima for respeitada.

---

## Critérios de aceite

- [ ] As 12 chaves canônicas de classe são EN em `config` (`startingKits`, `classFeatures`, `classSpells`, `initialAdventures.hooks[].classKey`), no `seed.ts` e no `CLASS_MAP`.
- [ ] As chaves compostas do overlay `pt-BR.json` são EN (`paladin_lay-on-hands`); **os valores PT ficam idênticos** — o diff do arquivo é só de chave.
- [ ] **Zero órfão, zero fallback novo:** `node scripts/srd/ingest.mjs --strict` passa e o relatório de órfãos sai vazio. (É o verificador mecânico: chave do overlay renomeada sem o par no `CLASS_MAP` vira órfã na hora.)
- [ ] **Criação de personagem em PT intacta:** digitar "Bruxo", "Patrulheiro", "Feiticeiro" resolve para `warlock`/`ranger`/`sorcerer` — o `CLASS_SYNONYMS` segue aceitando entrada PT.
- [ ] **`CLASS_SYNONYMS` comentado:** um comentário no topo do mapa registra que a coluna esquerda é matcher de entrada livre (multilíngue, PT incluso) e a direita é a chave canônica EN — e que pares como `['ranger', 'ranger']` são coincidência, não duplicação a limpar.
- [ ] **Nada muda na tela:** a ficha e a narração seguem exibindo "Impor as Mãos"/"Fúria" em PT; o seletor de classe da UI segue em PT. O jogador não percebe a story.
- [ ] **Eval / teste de regressão:** `pnpm test` e `pnpm eval` verdes. O caso que falha se a story for feita pela metade: um personagem **Paladino** criado pela API tem `features` não-vazia (chave renomeada no overlay mas não no `CLASS_MAP` → `classFeatures.paladin` inexistente → cai no `default` → ficha vazia, silenciosamente).
- [ ] `srd-5e.config.json` regenerado e commitado; o diff é **só renomeação de chave** (nenhum texto de `name`/`description` muda).

---

## Notas de implementação

- **É um rename mecânico, mas não um find-and-replace cego.** `paladino` aparece como chave *e* como palavra PT em comentários, labels e strings de teste. Renomear por regex pega a UI e o `CLASS_SYNONYMS` junto — exatamente o que está fora do escopo.
- **Ordem sugerida:** `CLASS_MAP` → overlay → `seed.ts` → `CLASS_SYNONYMS` (só a coluna direita) → testes/evals → regenerar o artefato. Rodar `ingest --strict` no fim; órfão significa chave esquecida.
- **Decidido: o `CLASS_MAP` continua explícito.** Com chaves EN ele vira quase identidade (`pk.replace(/^srd-2024_/, '')`) e é tentador apagar as 12 linhas. Não apagar: o mapa **falha alto** quando o dataset traz uma classe base desconhecida ([ingest.mjs:111](../../../scripts/srd/ingest.mjs:111)) e é o único lugar onde uma divergência futura entre o slug do Open5e e o nosso ID se corrige em uma linha. Derivar do slug troca 12 linhas de código por uma classe sumindo em silêncio num bump. A rigidez é a feature.
- **Decidido: `['ranger', 'ranger']` no `CLASS_SYNONYMS` fica, com comentário.** Depois do rename, `ranger` é palavra-chave (coluna esquerda, matcher da entrada do jogador) **e** chave canônica (coluna direita). A linha lê como redundância e convida a "limpeza" que quebra o match de quem digita "Ranger". O comentário tem de dizer que as colunas são coisas diferentes e a igualdade é coincidência.
- **O banco não é tocado.** Nenhuma coluna guarda chave de classe hoje (`Character.class` é texto livre). Sem migração Prisma, sem migração de dados.

---

## Referências no código

- [scripts/srd/ingest.mjs](../../../scripts/srd/ingest.mjs) — `CLASS_MAP` (l. 25), composição `${canon}_${slug}` (l. 122), relatórios de órfão/fallback (l. 151+).
- [scripts/srd/locale/pt-BR.json](../../../scripts/srd/locale/pt-BR.json) — overlay curado; chaves compostas a renomear, valores intactos.
- [scripts/srd/srd-5e.config.json](../../../scripts/srd/srd-5e.config.json) — artefato a regenerar.
- [apps/api/src/character/starting-inventory.ts](../../../apps/api/src/character/starting-inventory.ts) — `CLASS_SYNONYMS`: **coluna direita** entra no escopo, esquerda não.
- [apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts) — kits/features/hooks semeados por chave de classe.
- [packages/shared/src/types/system.ts](../../../packages/shared/src/types/system.ts) — `SystemConfigSchema`: os records são `z.record(z.string(), …)`, não enumeram chave. O schema **não pega** um rename incompleto — quem pega é o relatório de órfãos do `ingest` e os testes.
- [apps/web/src/components/setup/SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — labels PT do seletor; **fora do escopo**, citado para delimitar.
</content>
</invoke>
