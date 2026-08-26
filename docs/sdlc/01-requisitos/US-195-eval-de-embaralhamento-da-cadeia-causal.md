# US-195 — Eval de embaralhamento da cadeia causal entre encontros

**Épico:** 2 — Campanha e aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-193](./US-193-encontros-sem-cadeia-causal-entre-si.md) (`unlocks` — o campo que esta eval lê; sem ele não há o que medir)
**Relacionado:** [packages/ai-engine/src/overlap.ts](../../../packages/ai-engine/src/overlap.ts) (mesma família — detector determinístico, custo zero, limiar calibrado à mão) · [evals/README.md](../../../evals/README.md) (§Qualidade da narração — o padrão de juiz LLM que esta story explicitamente NÃO usa)

**Criada em:** 2026-08-24 — extraída da US-193 durante a implementação. O critério de aceite *"Eval nova (embaralhamento)"* daquela story foi tentado com dados reais (não hipotéticos) e a heurística determinística não discriminou de forma confiável — ver *Achado* abaixo. A própria US-193 previa esse desfecho: *"Se aprovar, o juiz não discrimina e a eval não mede nada — conserta a rubrica antes de escrever a story."* Esta story é o "conserta a rubrica", feita à parte para não bloquear o resto da US-193 (schema/prompt/guard, que fecharam limpos).

---

## História

> **Como** mantenedora,
> **quero** um jeito confiável de detectar quando os 8 encontros de uma aventura gerada NÃO formam uma trilha causal (o teste do "troque dois vizinhos de lugar" da US-193),
> **para que** a US-193 tenha uma rede de segurança automática contra regressão silenciosa da cadeia, e não só verificação manual (seed jogado à mão).

---

## Achado (o que já foi tentado, com números reais)

Gerei uma aventura real pós-US-193 (`evals/fixtures/us-193-chain-1.json`, 8 encontros com `unlocks` preenchido por `deepseek/deepseek-v4-flash`) e testei três heurísticas determinísticas, comparando o score da ORDEM CORRETA (`overlap(goal[i+1], unlocks[i])` para os 7 pares adjacentes) contra a ORDEM COM UM PAR TROCADO:

1. **Overlap de palavras (stopwords filtradas, ≥4 letras).** Score total ordem correta = 31; trocando encontros 3↔4 = 24 (queda real, ~23%). Mas por PAR individual o sinal é ruidoso: em 3 dos 7 pares a versão invertida empata ou supera a correta (vocabulário da aventura inteira — "grimório", "ritual", "Torvin" — se repete em quase todo encontro, não só no vizinho imediato).
2. **Overlap ponderado por IDF** (penaliza palavra que aparece em muitos dos 8 encontros). Melhor: 2 de 7 pares ainda invertidos.
3. **Overlap de NOMES PRÓPRIOS** (NPCs/itens/locais capitalizados — o sinal mais limpo dos três). Agregado ordem-correta = 10, ordem-invertida = 3 (bom). Mas testando as 7 posições possíveis de troca adjacente contra o total agregado: 2 das 7 trocas (`encontro 1↔2`, `encontro 6↔7`) fazem o score total SUBIR ou empatar em vez de cair — a troca "quebra a leitura" narrativamente, mas a heurística não acusa.

Nenhuma das três é confiável o bastante pra virar gate (falso-negativo — deixar passar uma trilha quebrada — é o pior desfecho pra um eval que existe pra pegar exatamente isso). É o limite que `overlap.ts` já reconhece pra replay de narração (`REPLAY_OVERLAP_THRESHOLD`, "calibração fina fica aberta") — aqui o problema é mais difícil ainda porque o que se mede é uma RELAÇÃO entre dois textos curtos, não repetição dentro do mesmo texto.

As fixtures desta investigação ficam no repo, reutilizáveis por quem pegar esta story:
- `evals/fixtures/us-193-baseline-1.json` / `-2.json` — aventuras reais geradas pelo código PRÉ-US-193 (sem `unlocks`), congeladas como controle negativo trivial (não têm o campo — qualquer heurística que dependa dele reprova as duas por construção).
- `evals/fixtures/us-193-chain-1.json` — aventura real gerada PÓS-US-193, com `unlocks`. É onde os números acima foram tirados.

---

## Escopo

### Dentro do escopo

- Decidir a abordagem (ver *Opções* abaixo) e implementar `evals/cases/us-193-eval-cadeia-causal.ts` (ou nome equivalente) rodando sobre as fixtures já congeladas.
- Gerar mais 2-3 fixtures reais (`generateAdventure` com `unlocks`) para calibrar contra mais de UM exemplar — a US-193 só teve tempo/orçamento pra um. O script usado pra gerar as fixtures atuais foi descartado (knip reprova arquivo sem consumidor, US-89); recriar é curto: instanciar `AiService`/`AdventureService` direto (sem bootstrap do Nest — `generateAdventure` não toca `prisma`/`dice`), chamar `.generateAdventure(profile, characterId, order, 'pt-BR')` e escrever o retorno em `evals/fixtures/`, rodando com `pnpm exec dotenv -e .env -- pnpm --filter api exec ts-node <script>` (root `.env`, mesmo padrão de `db:seed`).
- Se a abordagem escolhida for heurística determinística: documentar o limiar e o método de calibração no próprio arquivo do eval (mesmo padrão de `REPLAY_OVERLAP_THRESHOLD`), com nota clara de que é sinal AGREGADO, não garantia por par.
- Se a abordagem escolhida for juiz LLM: atualizar o critério de aceite da US-193 que hoje exige "determinístico, sem custo de API por rodada" (ele fica FALSO se este caminho for escolhido) e seguir o padrão de `evals/README.md` §Qualidade da narração (pula quando faltar `GEMINI_API_KEY`, não gateia CI sem secret).

### Fora do escopo

- Mudar `AdventureEncounterSchema`/`generateClosing`/o prompt de `ai.service.ts` — já fechados pela US-193, sem pendência aqui.
- Rodar em CI como gate obrigatório antes de validar contra pelo menos 5-10 fixtures reais — 1 exemplar não é amostra suficiente pra travar merge de ninguém.

---

## Opções (para decidir no início desta story, não implementar as três)

1. **Heurística de nomes próprios, agregada, limiar frouxo** — a mais barata, mesma família de `overlap.ts`. Aceita que não detecta 100% das trocas (só quer pegar regressão GROSSEIRA: cadeia inteira ausente, não troca cirúrgica de 1 par). Se o objetivo real é "detectar quando o motor parou de escrever `unlocks` conectado a nada" (regressão total, não swap fino), este nível de sinal pode bastar — precisa decidir qual dos dois é o alvo.
2. **Juiz LLM (Gemini), mesmo padrão da US-36** — discrimina melhor (é literalmente o que um leitor humano faria), custa API por rodada, não gateia CI sem secret. Muda o texto do critério de aceite da US-193.
3. **Sem eval automático — só o checklist manual da US-193** ("seed jogado à mão confirma que a aventura se lê como trilha"). Descarta a ambição de rede de segurança automática; mantém verificação manual como única defesa contra regressão da cadeia.

---

## Critérios de aceite

- [ ] Opção escolhida entre as 3 acima, com a razão registrada nesta story (não só na conversa que a decidiu).
- [ ] Eval roda contra as fixtures de `evals/fixtures/us-193-*.json` (baseline PRÉ, mínimo 1 real PÓS) e reprova as duas fixtures baseline.
- [ ] Eval aprova pelo menos 1 fixture real pós-US-193 na ordem original.
- [ ] Eval reprova a mesma fixture com pelo menos 1 par adjacente trocado — testado contra TODAS as 7 posições de troca possíveis (não só uma escolhida a dedo), com a taxa de acerto registrada nesta story.
- [ ] `pnpm eval` (ou `pnpm test`, conforme a opção escolhida) passa.
