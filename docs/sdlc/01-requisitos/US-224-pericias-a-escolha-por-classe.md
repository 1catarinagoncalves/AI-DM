# US-224 — Perícias à escolha seguem o catálogo e a contagem da classe

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-27](./US-27-pericias-do-personagem.md) (`config.proficiency.choices`/`config.skills`/`validateSkills` — o mecanismo GLOBAL que esta story substitui por um mecanismo POR CLASSE) · [US-221](./US-221-proficiencias-de-arma-armadura-e-ferramenta-por-classe.md) (`buildClassProficiencies`/`extractProficiencySection`/`SKILL_FREE_CHOICE_WORDS`/`ClassCatalogEntrySchema` — precedente direto de parser e de extensão de schema; esta story lê o MESMO texto da feature `PROFICIENCIES` que a US-221 já isola, só que o campo `Skills:` que ela deixou de fora) · [US-131](./US-131-integracao-mecanica-background-proficiency.md) (exclusão de perícia já concedida por origem do pool — continua valendo, só a base do pool deixa de ser `config.skills` inteiro) · [US-220](./US-220-pericias-proficientes-por-raca.md) (exclusão por raça + colisão fixa×fixa — mesmo raciocínio, mesma base a trocar)
**Relacionado:** [US-207](./US-207-atributos-e-pericias-com-orcamento-visivel.md) (selo `X / Y escolhidas` na etapa `skills` — `Y` passa a variar por classe, texto já é interpolado dinamicamente) · [US-209](./US-209-hit-dice-e-salvaguardas-de-classe-no-config.md) (mesma extensão paralela de `ClassCatalogEntrySchema`/`buildClasses` — ver §Notas de implementação sobre landing em paralelo) · [US-222](./US-222-salvaguardas-de-classe-na-ficha.md) (consumidor irmão de `config.classes[].savingThrows`, mesmo texto de origem — ver §Contexto)
**Criada em:** 2026-09-08

---

## História

> **Como** jogadora,
> **quero** que a etapa de Perícias me deixe escolher só entre as perícias que a MINHA classe oferece, na quantidade que a MINHA classe manda,
> **para que** um Ladino escolha 4 perícias de um leque amplo e um Bárbaro escolha 2 de um leque estreito — do jeito que a regra do 5e realmente funciona, em vez de todo personagem escolher as mesmas 2 de qualquer uma das 18~20 perícias do catálogo.

---

## Contexto e motivação

### O que o dataset diz (medido em 2026-09-08, `Skills:` da feature `PROFICIENCIES`, as 13 classes jogáveis)

A mesma feature `<classe>_proficiencies` que a US-221 já parseia para `Armor:`/`Weapons:`/`Tools:` traz uma quinta linha, `Skills:`, com o pool e a contagem de cada classe (leitura direta de `scripts/srd/_data/ClassFeature.json` + `ClassFeature.a5e-ag.json`, `feature_type: "PROFICIENCIES"`):

| Classe (chave) | Contagem | Pool (perícias elegíveis) |
|---|---|---|
| `barbarian` | 2 | Adestrar Animais, Atletismo, Intimidação, Natureza, Percepção, Sobrevivência (6) |
| `bard` | 3 | **"Choose any three"** — qualquer perícia do catálogo inteiro, sem lista nomeada |
| `cleric` | 2 | História, Intuição, Medicina, Persuasão, Religião (5) |
| `druid` | 2 | Arcanismo, Adestrar Animais, Intuição, Medicina, Natureza, Percepção, Religião, Sobrevivência (8) |
| `fighter` | 2 | Acrobacia, Adestrar Animais, Atletismo, História, Intuição, Intimidação, Percepção, Sobrevivência (8) |
| `monk` | 2 | Acrobacia, Atletismo, História, Intuição, Religião, Furtividade (6) |
| `paladin` | 2 | Atletismo, Intuição, Intimidação, Medicina, Persuasão, Religião (6) |
| `ranger` | 3 | Adestrar Animais, Atletismo, Intuição, Investigação, Natureza, Percepção, Furtividade, Sobrevivência (8) |
| `rogue` | **4** | Acrobacia, Atletismo, Enganação, Intuição, Intimidação, Investigação, Percepção, Atuação, Persuasão, Prestidigitação, Furtividade (11) |
| `sorcerer` | 2 | Arcanismo, Enganação, Intuição, Intimidação, Persuasão, Religião (6) |
| `warlock` | 2 | Arcanismo, Enganação, História, Intimidação, Investigação, Natureza, Religião (7) |
| `wizard` | 2 | Arcanismo, História, Intuição, Investigação, Medicina, Religião (6) |
| `marshal` (a5e-ag) | 2 | Atletismo, História, Intuição, Intimidação, Medicina, Percepção, Persuasão (7) |

Nenhuma classe escolhe do catálogo inteiro **exceto** o Bardo — e mesmo o Bardo difere: 3 escolhas, não 2. O Ladino escolhe 4, de um pool de 11 (mais da metade do catálogo). Ninguém no dataset tem pool com menos de 5 nem mais de 11 perícias nomeadas — a única "escolha livre total" é o Bardo, texto (`"Choose any three"`) idêntico à forma que a US-131 já resolve para `skill_proficiency` de origem (`parseSkillGrant`, ramo `"<N> of your choice"`).

### Por que a solução atual não basta

A US-27 modelou perícia como **um único par global**: `config.proficiency.choices` (sempre 2) e `config.proficiency.bonus` (sempre +2), com o pool sendo **todo** `config.skills`. Isso é lido em dois lugares, nenhum deles com noção de classe:

- **`validateSkills`** ([character.service.ts:432](../../../apps/api/src/character/character.service.ts:432)) — `choices = config.proficiency.choices + extraChoices` (a única variação hoje é a colisão fixa×fixa da US-220, não a classe), `catalog = config.skills` inteiro menos `excluded` (raça/origem). Um Bárbaro e um Ladino chamam a **mesma** validação com o **mesmo** número e o **mesmo** pool.
- **Etapa `skills` do wizard** ([SetupWizard.tsx:367](../../../apps/web/src/components/setup/SetupWizard.tsx:367) e [:1351](../../../apps/web/src/components/setup/SetupWizard.tsx:1351)) — `skillChoices = system?.config?.proficiency?.choices ?? 0` (constante do sistema, não da classe); a lista renderizada é `skillCatalog` inteiro menos as já concedidas por origem/raça — nunca filtrada pela classe escolhida. Um jogador de Ladino vê os mesmos ~18-20 checkboxes que um jogador de Mago, e ambos travam em exatamente 2 marcadas.

Ou seja: hoje um Ladino **não pode** escolher 4 perícias (o formulário bloqueia em 2), e um Bárbaro **pode** escolher Arcanismo ou Religião — nenhuma das duas coisas é a regra do 5e. A US-221 já tinha o texto certo na mão (a mesma feature `PROFICIENCIES`) e deliberadamente deixou o campo `Skills:` de fora (comentário em `extractProficiencySection`, [ingest.mjs:1062](../../../scripts/srd/ingest.mjs:1062): *"os 5 campos (Armor/Weapons/Tools/Saving Throws/Skills, os 2 últimos fora do escopo desta story)"*) — Saving Throws foi resolvido pela US-209/US-222; Skills nunca foi.

### A proposta

Parsear o campo `Skills:` da MESMA feature `PROFICIENCIES` que a US-221 já isola, com o MESMO parser de contagem por extenso (`SKILL_FREE_CHOICE_WORDS`) que `parseClassTools`/`parseSkillGrant` já usam, produzindo `config.classes[].skillProficiencies: { chooseFrom: string[], chooseCount: number }` por classe — irmão estrutural do `grant` que `parseSkillGrant` já produz para origem, só sem a parte `fixed` (nenhuma classe concede perícia FIXA nesta feature; fixo de classe não existe no 5e, só de raça/origem). `validateSkills` e a etapa `skills` do wizard passam a ler esse par por classe em vez do global — o pool e a contagem variam por `Character.class`, exatamente como já variam por raça (US-220) e por origem (US-131).

---

## Escopo

### Dentro do escopo

- **`scripts/srd/ingest.mjs`:** `parseClassSkills(classKey, text, skillsByKey)`, ao lado de `parseClassTools`/`parseArmorProficiencies` — mesmo arquivo, mesmas duas formas medidas:
  - `"Choose N from A, B, and C"` / `"Choose N skills from A, B, and C"` (fighter/warlock inserem a palavra "skills"; os outros não — regex tolera as duas) → `chooseCount` de `SKILL_FREE_CHOICE_WORDS[N]` (reuso, sem tabela nova), `chooseFrom` = cada fragmento resolvido contra `config.skills` por `normalizeSkillKey` (mesma função que `parseSkillGrant` já usa) — chave sem match falha alto, mesmo contrato de `parseWeaponProficiencies`/`parseClassTools`.
  - `"Choose any N"` (só o Bardo, hoje) → `chooseFrom` = **todo** o catálogo de `config.skills` (mesmo ramo `free` de `parseSkillGrant`, [ingest.mjs:710](../../../scripts/srd/ingest.mjs:710): `chooseFrom: [...allSkillKeys].sort()`), `chooseCount` de `SKILL_FREE_CHOICE_WORDS[N]`.
  - Fragmento/contagem fora das duas formas → erro alto com o texto ofensor (mesmo padrão de todo parser desta feature desde a US-221).
- **`buildClassProficiencies`** ([ingest.mjs:1071](../../../scripts/srd/ingest.mjs:1071)): ganha um quarto campo no `out[canon]`, `skillProficiencies: parseClassSkills(canon, extractProficiencySection(canon, desc, 'Skills'), skillKeys)` — mesma função de extração de seção que já lê `Armor:`/`Weapons:`/`Tools:`, só que para `Skills:`; recebe `skills` (o array que `buildSkills` já produz) como parâmetro novo, mesmo padrão de `weapons`/`tools` que a função já recebe.
- **`ClassCatalogEntrySchema`** ([types/system.ts:113](../../../packages/shared/src/types/system.ts:113)): campo novo opcional, irmão de `weaponProficiencies`/`toolProficiencies`:
  ```ts
  skillProficiencies: z.object({
    chooseFrom: z.array(z.string()), // chaves de config.skills; catálogo inteiro no caso "choose any N"
    chooseCount: z.number().int().positive(),
  }).optional(),
  ```
- **`CharacterService.validateSkills`** ([character.service.ts:432](../../../apps/api/src/character/character.service.ts:432)): troca a fonte do pool/contagem. Em vez de ler `config.proficiency.choices`/`config.skills` diretamente, recebe `chooseFrom: string[]` e `chooseCount: number` já resolvidos pelo chamador (`create()`) a partir de `config.classes?.find(c => c.key === dto.class)?.skillProficiencies`. **Fallback** (classe sem `skillProficiencies` — artefato pré-ingest desta story, ou `config.classes` ausente): cai no comportamento de hoje, `chooseFrom = config.skills` inteiro e `chooseCount = config.proficiency.choices` — nunca quebra um artefato antigo, mesma disciplina de US-209/US-221/US-222. A lógica de `excluded`/`extraChoices` (raça/origem/colisão, US-131/US-220) não muda — só a base de `catalog`/`choices` que ela filtra/soma passa a ser por classe.
- **Etapa `skills` do wizard** ([SetupWizard.tsx:366-367](../../../apps/web/src/components/setup/SetupWizard.tsx:366)): `skillChoices` passa a ler `system?.config?.classes?.find(c => c.key === charData.class)?.skillProficiencies?.chooseCount ?? system?.config?.proficiency?.choices ?? 0` (mesmo fallback do backend). A lista renderizada ([SetupWizard.tsx:1351](../../../apps/web/src/components/setup/SetupWizard.tsx:1351)) ganha mais um filtro, ao lado do de origem/raça: só entra no catálogo clicável quem está em `skillProficiencies.chooseFrom` (quando o campo existe) — sem `chooseFrom` (fallback), mostra o catálogo inteiro como hoje. Resetar `skills` ao trocar de classe (mesmo padrão de reset que `raceToolChoice` já tem ao trocar de raça, [SetupWizard.tsx:274](../../../apps/web/src/components/setup/SetupWizard.tsx:274)) — um Bárbaro que trocar para Ladino no meio da criação não pode ficar com 2 perícias marcadas quando a etapa passa a exigir 4.
- **Texto da etapa** ([SetupWizard.tsx:1344](../../../apps/web/src/components/setup/SetupWizard.tsx:1344)): nenhuma chave nova — `setup.skills.instructions`/`setup.skills.selected` já interpolam `n`/`effectiveSkillChoices` dinamicamente; o número muda sozinho quando `skillChoices` passa a variar por classe.
- **Revisão** (`reviewSkills`, [SetupWizard.tsx:582](../../../apps/web/src/components/setup/SetupWizard.tsx:582)): nenhuma mudança de código — `buildSkillSheet` já é genérico, só passa a receber uma lista `skills` validada contra o pool certo.
- **Testes:** `ingest.test.mjs` cobre `parseClassSkills` nas 3 formas (lista nomeada com "skills" no meio da frase, lista nomeada sem, "choose any N") e a falha alta de fragmento/contagem fora da tabela; `character.service.test.ts` cobre Ladino (4 escolhas de um pool de 11, contagem errada e chave fora do pool rejeitadas), Bardo (3 escolhas de qualquer perícia do catálogo) e Bárbaro (2 escolhas restritas ao pool de 6 — perícia fora do pool, ex. `arcana`, rejeitada mesmo sendo válida no catálogo geral).

### Fora do escopo

- **Retroagir personagens já criados.** Mecânica só para criação nova, mesmo corte de US-131/US-220/US-221.
- **`config.proficiency.bonus` por classe.** O bônus de proficiência (+2) continua global — 5e não varia bônus por classe, só o pool/contagem de ESCOLHA. `config.proficiency` (o objeto) permanece no schema como fallback e fonte do `bonus`; só `choices` passa a ter uma fonte por-classe preferencial.
- **Sistema `Free` com classe ausente do catálogo.** Free herda `config.classes` do mesmo artefato SRD (`...srd` em `buildFreeConfig`, [seed.ts:169](../../../apps/api/prisma/seed.ts:169)) — as 13 classes e seus `skillProficiencies` chegam de graça, mesmo raciocínio da US-27 ("Free reusa o config do D&D"). Sem carve-out especial; o fallback do parágrafo anterior cobre qualquer artefato sem o campo, D&D ou Free.
- **Perícia fixa concedida por classe.** O dataset não tem nenhuma (diferente de raça/origem) — todas as 13 classes usam "Choose N from..."/"Choose any N", nunca uma perícia obrigatória sem escolha. Sem forma "fixed" no `skillProficiencies` desta story (ao contrário de `toolProficiencies`, que tem `fixed`+`choice`).
- **Subclasse concedendo perícia extra.** Nenhuma das 13 classes base tem isso na feature de nível 1; mesmo corte de US-209/US-221 para traço de subclasse.

---

## Modelo de dados proposto

`packages/shared/src/types/system.ts` — extensão de `ClassCatalogEntrySchema` (mesmo arquivo/objeto que US-209/US-221 já estendem; ver §Notas de implementação):

```ts
export const ClassCatalogEntrySchema = SystemCatalogEntrySchema.extend({
  // ...hitDice/savingThrows (US-209), armorProficiencies/weaponProficiencies/toolProficiencies (US-221)...
  skillProficiencies: z.object({
    chooseFrom: z.array(z.string()), // chaves de config.skills; catálogo inteiro no caso "choose any N"
    chooseCount: z.number().int().positive(),
  }).optional(),
})
```

Exemplo (`barbarian`, `bard`, `rogue`, ilustrando as 2 formas):

```jsonc
{
  "classes": [
    {
      "key": "barbarian", "label": "Bárbaro",
      "skillProficiencies": {
        "chooseFrom": ["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"],
        "chooseCount": 2
      }
    },
    {
      "key": "bard", "label": "Bardo",
      "skillProficiencies": { "chooseFrom": ["acrobatics", "..." /* todo config.skills */], "chooseCount": 3 }
    },
    {
      "key": "rogue", "label": "Ladino",
      "skillProficiencies": {
        "chooseFrom": ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight_of_hand", "stealth"],
        "chooseCount": 4
      }
    }
  ]
}
```

**Persistência:** nenhuma mudança — `Character.skills` (US-27) continua sendo só as chaves proficientes escolhidas, sem rastro de qual classe validou o pool. `config.classes[].skillProficiencies` é dado derivado do ingest, lido em tempo de validação/exibição, mesmo espírito de `hitDice`/`savingThrows`.

---

## Critérios de aceite

- [ ] `config.classes[].skillProficiencies` preenchido para as 13 classes, batendo com a tabela medida em §Contexto (Ladino `chooseCount: 4`; Bardo `chooseCount: 3` com `chooseFrom` = catálogo inteiro; as outras 11 com `chooseCount: 2` e `chooseFrom` restrito ao pool nomeado).
- [ ] Criar um Ladino e tentar marcar só 2 perícias na etapa `skills` → bloqueado; marcar 4 dentro do pool de 11 → libera e persiste as 4 em `Character.skills`.
- [ ] Criar um Bárbaro e tentar marcar `arcana` (fora do pool de 6) → o checkbox nem aparece na etapa `skills` (filtrado do catálogo renderizado); enviar a chave direto pela API → `CharacterService.create` rejeita com `BadRequestException` citando a chave ofensora.
- [ ] Criar um Bardo → a etapa `skills` exige exatamente 3, com QUALQUER perícia do catálogo elegível (sem filtro de pool).
- [ ] Trocar de classe no meio da criação (ex. Bárbaro → Ladino) limpa as perícias já marcadas — nunca deixa o formulário em um estado de "2 marcadas, 4 exigidas" sem indicar o que falta.
- [ ] Classe sem `skillProficiencies` no config (artefato pré-ingest desta story) → cai no comportamento da US-27 (`chooseCount = config.proficiency.choices`, pool = `config.skills` inteiro), sem crash, sem bloquear a criação.
- [ ] A exclusão de perícia já concedida por raça (US-220) e origem (US-131) continua funcionando sobre o pool por-classe — uma perícia fixa de raça que também esteja no pool da classe some das opções clicáveis da etapa, do jeito que já some do pool geral hoje.
- [ ] O selo `X / Y escolhidas` ([SetupWizard.tsx:1345](../../../apps/web/src/components/setup/SetupWizard.tsx:1345)) mostra o `Y` certo por classe sem chave de i18n nova (interpolação já existente).
- [ ] **Eval/teste de regressão:** `ingest.test.mjs` cobre as 3 formas de `Skills:` (nomeada com/sem a palavra "skills", "choose any N") mais a falha alta de fragmento/contagem fora da tabela; `character.service.test.ts` cobre Ladino (4 válidas / contagem errada / chave fora do pool), Bardo (3 de qualquer perícia) e Bárbaro (2 restritas ao pool, com um caso de perícia válida no catálogo geral mas fora do pool da classe sendo rejeitada).

---

## Notas de implementação

- **Reusar, não reescrever:** `SKILL_FREE_CHOICE_WORDS` ([ingest.mjs:695](../../../scripts/srd/ingest.mjs:695)), `normalizeSkillKey` ([ingest.mjs:693](../../../scripts/srd/ingest.mjs:693)) e `extractProficiencySection` ([ingest.mjs:1065](../../../scripts/srd/ingest.mjs:1065)) já existem e já cobrem tudo que `parseClassSkills` precisa — o trabalho é o parser do campo `Skills:`, não infraestrutura nova.
- **Ordem de landing com US-209/US-221:** as três stories estendem `ClassCatalogEntrySchema`/`buildClasses`/`buildClassProficiencies` no mesmo arquivo. Se mais de uma estiver em progresso ao mesmo tempo, cabe rebase — mesmo aviso que a US-221 já deixou para a US-209 (campos diferentes, sem conflito de merge real, mas paralelismo cego reaplica `.extend()` por cima).
- **`validateSkills` muda de assinatura, não de contrato.** Hoje lê `config` inteiro e deriva `catalog`/`choices` internamente; a mudança é o CHAMADOR (`create()`) resolver `chooseFrom`/`chooseCount` a partir da classe (com o fallback do config global) e passar prontos — a função em si só troca "de onde vêm os dois valores", a validação de contagem/chave/duplicata dentro dela não muda uma linha.
- **`"skills"` no meio da frase (fighter/warlock):** `"Choose two skills from..."` vs. `"Choose two from..."` — mesma forma, só um token a mais. Regex com `(?:\s+skills)?` opcional cobre as duas sem precisar de dois `match` separados.
- **Cuidado com `sorcerer`/`sorceror`:** mesmo erro de digitação do dataset upstream que a US-221 já documentou (`pk: "srd_sorceror_proficiencies"`, `parent` correto) — `parseClassSkills` é chamado a partir do MESMO `feature` que `buildClassProficiencies` já encontrou por `parent`+`feature_type`, então herda a correção de graça, sem tratamento novo.

---

## Questões em aberto

1. **O pool do Bardo (`chooseFrom` = catálogo inteiro) inclui perícias que um bump futuro do dataset adicionar ao `config.skills` geral** (o catálogo hoje já tem `culture`/`engineering` do a5e-ag, além das 18 clássicas — confirmado em `scripts/srd/locale/pt-BR.json`, `skills`). Isso é o comportamento correto (Bardo "escolhe qualquer uma") ou o pool do Bardo deveria travar nas 18 perícias SRD, deixando `culture`/`engineering` de fora por não constarem do texto original do PHB? Recomendação: manter dinâmico (segue `config.skills` como está, igual ao ramo `free` de `parseSkillGrant` já faz para origem) — é o mesmo raciocínio que o restante do parser já aplica, e travar um subconjunto exigiria uma lista adicional só para este caso.
2. **Perícia FORA do pool da classe, mas concedida por RAÇA/ORIGEM (ex. Bárbaro com `arcana` vindo do Meio-elfo/Skill Versatility, US-220):** ela entra em `Character.skills` pela via de raça, não pela etapa `skills` da classe — o pool restrito desta story bloqueia só a ESCOLHA da etapa `skills`, nunca invalida uma perícia que chegou por outra fonte. Comportamento já implícito no desenho (`excluded` continua sendo aditivo, não um filtro sobre o pool da classe), listado aqui só para deixar explícito que não é uma regressão.

---

## Referências no código

- [scripts/srd/ingest.mjs:993-1069](../../../scripts/srd/ingest.mjs:993) — `parseArmorProficiencies`/`parseWeaponProficiencies`/`parseClassTools`/`extractProficiencySection`, precedente direto de `parseClassSkills`.
- [scripts/srd/ingest.mjs:708](../../../scripts/srd/ingest.mjs:708) — `parseSkillGrant`, o parser irmão que já resolve `"<N> of your choice"` contra o catálogo inteiro (mesmo ramo que o Bardo precisa).
- [scripts/srd/ingest.mjs:1071](../../../scripts/srd/ingest.mjs:1071) — `buildClassProficiencies`, onde `skillProficiencies` entra como quarto campo.
- [packages/shared/src/types/system.ts:113](../../../packages/shared/src/types/system.ts:113) — `ClassCatalogEntrySchema`, onde o campo novo é adicionado.
- [apps/api/src/character/character.service.ts:432](../../../apps/api/src/character/character.service.ts:432) — `validateSkills`, a função cujo pool/contagem deixam de ser globais.
- [apps/web/src/components/setup/SetupWizard.tsx:366-367](../../../apps/web/src/components/setup/SetupWizard.tsx:366) e [:1351](../../../apps/web/src/components/setup/SetupWizard.tsx:1351) — `skillChoices`/lista renderizada da etapa `skills`.
- [apps/api/prisma/seed.ts:166-184](../../../apps/api/prisma/seed.ts:166) — `buildFreeConfig`, confirma que o Free herda `config.classes` (e portanto `skillProficiencies`) do mesmo artefato SRD.
