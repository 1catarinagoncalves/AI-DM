# US-37 — Nível cinematográfico mantido em todos os turnos

**Épico:** 2 — Aventura
**Fase:** 1 — MVP single-player
**Status:** 🗂️ Backlog
**Depende de:** [US-34](./US-34-qualidade-da-narracao-do-dm.md) (barra de ofício + abertura gerada pela IA) e [US-11b](./US-11b-estado-de-cena-estruturado.md) (estado de cena estruturado). Medida por [US-36](./US-36-eval-de-qualidade-da-narracao.md) (eval de qualidade).
**Criada em:** 2026-07-07

---

## História

> **Como** jogador,
> **quero** que a mesma qualidade cinematográfica da abertura se mantenha em cada turno seguinte,
> **para que** a aventura não comece como um romance e continue como um menu de "você faz X, sucesso/falha".

---

## Contexto e motivação

### O problema observado

Depois da [US-34](./US-34-qualidade-da-narracao-do-dm.md), a **abertura** ficou cinematográfica: abre pelos sentidos, nomeia coisas, dá voz a um NPC, fecha chamando o personagem pelo nome com opções. Mas os **turnos seguintes saíram muito mais curtos** — frequentemente uma ou duas linhas funcionais, sem sentidos, sem NPC vivo, sem ritmo.

Exemplo concreto do degrau:

> **Abertura (US-34):** cinco parágrafos — o riacho, as pegadas secas, o arrepio na espinha de Lyra, o velho caçador Thorne emergindo da floresta com medo nos olhos, stakes claros, e o gancho dirigido a Lyra com três opções.
>
> **Turno seguinte** (jogador: *"sigo as pegadas"*): *"Você segue as pegadas rio acima. Elas terminam numa clareira. O que você faz?"*

O jogador percebe a queda imediatamente: a aventura **abre** como um mestre humano e **continua** como um gerador genérico.

### Por que a solução atual não basta

A seção de **ofício** da US-34 já diz, no `buildDmSystemPrompt`, que a barra vale "para a abertura E para cada turno". Mesmo assim os turnos caem. Três causas se somam:

1. **A abertura tem um empurrão explícito que os turnos não têm.** A US-34 criou `buildOpeningInstruction` — uma mensagem de usuário que manda *expandir a cena numa abertura cinematográfica completa*. Nos turnos (`AiService.streamChat`), a mensagem de usuário é **apenas a ação crua do jogador** (ex.: *"abro a porta"*). Sem um reforço equivalente, o modelo espelha a brevidade do input e responde curto.
2. **As regras de concisão pesam contra o ofício.** A seção de formatação do `dm-system.ts` repete "always concise", "parágrafos de no máximo 3–4 linhas", "Immersive ≠ verbose". Sem contrapeso por turno, o modelo lê isso como "faça o mínimo" e comprime a cena a uma ou duas frases.
3. **A ação curta ancora a resposta curta.** Um input telegráfico ("vou até a vila") puxa uma saída telegráfica, a menos que o prompt reafirme, naquele turno, que a resposta deve ter corpo.

Ou seja: a barra existe no system prompt, mas falta o **mecanismo que a torna operante a cada turno**, e falta **reconciliar** "conciso" com "cinematográfico" para os dois não se anularem.

### A proposta

Trazer a narração dos turnos à **paridade** com a abertura: todo turno passa pela mesma barra de ofício de forma operante, e o significado de "conciso" é fixado como **prosa enxuta, não prosa magra** — 3–5 parágrafos curtos continuam sendo o corpo normal de um turno, com o ritmo livre para variar quando a cena pede (uma troca rápida de combate pode ser mais curta; uma chegada a um lugar novo, mais densa).

---

## Escopo

### Dentro do escopo

- **Reforço de ofício por turno** no caminho de chat (`AiService.streamChat`): garantir que cada narração de continuação seja avaliada pela mesma barra da abertura, **independente de quão curta seja a ação do jogador**. Seja via um builder de instrução de turno (análogo a `buildOpeningInstruction`) anexado à ação, seja via uma cláusula reforçada no system prompt — o que sobreviver melhor a inputs telegráficos.
- **Reconciliar concisão × ofício** no `dm-system.ts`: deixar explícito que "conciso" = sem enrolação/sem repetição, **não** menos cena. Manter "3–5 parágrafos curtos" como alvo do turno típico, sem que as regras de formatação empurrem para o mínimo.
- **Ritmo variável, não comprimento fixo:** a barra é qualidade, não contagem de linhas. Trocas rápidas (combate, réplica de diálogo) podem ser mais curtas de propósito; o que não pode é o turno normal virar uma linha funcional.
- Sem **enfraquecer** nenhuma regra existente: ordem de resolução de turno, um turno = uma narração, opções vs. diálogo, continuidade espacial (US-11b), concordância de gênero permanecem intactas.

### Fora do escopo

- A **abertura** — já resolvida na US-34. Esta US cuida só dos turnos de continuação.
- **Eval/rubrica** de qualidade — é a [US-36](./US-36-eval-de-qualidade-da-narracao.md), que mede exatamente esta regressão. Esta US produz a qualidade; a US-36 a vigia.
- Trocar o **modelo** de narração ou mexer na escada de fallback (`openai/gpt-oss-120b` → `llama-3.3-70b`). Se o fallback narrar mais curto, isso é insumo para a US-36, não objeto desta.
- **Streaming/entrega** ou formatação da UI de chat — inalterados.
- Aumentar o **comprimento por comprimento**: o objetivo é corpo e vida, não parágrafos inflados. Prolixidade é falha tanto quanto a linha seca.

---

## Critérios de aceite

- [ ] Um turno de continuação passa pela **mesma barra de ofício** da abertura (sentidos, concretude, classe como lente, voz/corpo de NPC quando há, gancho vivo dirigido ao personagem + opções).
- [ ] Um turno narrativo **normal** produz corpo equivalente ao da abertura (tipicamente 3–5 parágrafos curtos), **não** uma ou duas linhas funcionais.
- [ ] A resposta **não** encolhe só porque a ação do jogador foi telegráfica: a barra vale independentemente do tamanho do input.
- [ ] O ritmo pode **variar** por tempo dramático — uma troca rápida de combate/diálogo pode ser mais curta —, sem que isso vire desculpa para o turno padrão ficar raso.
- [ ] As regras de concisão do `dm-system.ts` foram **reconciliadas** com o ofício: "conciso" está definido como enxuto (sem enrolação), não como mínimo de cena; nenhuma regra manda o modelo comprimir a narração.
- [ ] Nenhuma regra de **consistência/formatação** existente foi removida ou enfraquecida (resolução de turno, um turno = uma narração, opções com `-`+emoji, diálogo com `—`, continuidade espacial, gênero).
- [ ] **(regressão)** Dada uma ação curta do jogador (ex.: *"sigo as pegadas"*) sobre uma cena estabelecida, a narração resultante é cinematográfica (multi-parágrafo, sensorial, com gancho e opções), e **não** um "você segue as pegadas. O que faz?".
- [ ] **(regressão — sem duplicação)** O reforço de ofício **não** reintroduz duplicação de narração nem quebra a ordem de resolução de turno da US-34/US-28 (um turno continua produzindo exatamente uma narração).

---

## Notas de implementação

> *Dicas, não especificação. O implementador pode divergir com boa justificativa.*

- **Onde atua:** `AiService.streamChat` (caminho `streamText` dos turnos) e `packages/ai-engine/src/prompts/dm-system.ts` (seção de ofício + reconciliação da concisão).
- **Empurrão por turno:** o jeito mais direto e simétrico com a US-34 é um `buildTurnInstruction(...)` no `ai-engine`, anexado à ação do jogador na última mensagem `user` (ou como mensagem `system`/`user` adicional), reafirmando a barra sem repetir o system prompt inteiro. Uma cláusula reforçada no system prompt é a alternativa mais barata em tokens; medir qual segura melhor contra inputs curtos. Exportar o builder no `index` se for por builder.
- **Reconciliar concisão:** ajustar os trechos "always concise" / "Immersive ≠ verbose" / "no máximo 3–4 linhas" para deixar claro que limitam **enrolação e tamanho de parágrafo**, não a quantidade de cena; o alvo do turno é 3–5 parágrafos curtos com sentidos e NPC quando houver.
- **Não brigar com a resolução de turno:** o reforço precisa conviver com "um turno = uma narração" e com a reconstrução de `steps` no `onFinish` (US-34). Não instruir nada que induza segunda narração.
- **Custo/latência:** o reforço não deve inchar demais o contexto de cada turno nem atrasar o primeiro token do stream. Preferir texto curto e acionável.
- **ai-engine dist:** a API roda `packages/ai-engine/dist` — obrigatório `pnpm --filter @ai-dm/ai-engine build` após editar o `src`.
- **Fechar o loop com a US-36:** ao implementar, validar com o eval de qualidade (quando existir) que o turno de continuação passa a barra, não só a abertura.

---

## Questões em aberto

1. **Empurrão por turno: instrução por mensagem ou cláusula no system prompt?** A instrução anexada à ação tende a dominar melhor um input curto; a cláusula é mais barata. Decidir medindo qual mantém a barra sem custar contexto demais a cada turno.
2. **Alvo de corpo do turno — guia ou piso?** Fixar "3–5 parágrafos" como piso rígido pode prejudicar trocas rápidas de combate; deixar como guia pode ser fraco demais contra a compressão. Provável meio-termo: guia forte + exceção explícita para tempo rápido.
3. **Diferença de verbosidade entre modelos.** O primário (`openai/gpt-oss-120b`) e o fallback (`llama-3.3-70b`) narram com corpos diferentes. Vale um reforço calibrado por modelo, ou o mesmo prompt basta? (Encaminhar sinal para a US-36.)
4. **Interação com a memória condensada.** Em sessões longas, a janela recente vira resumo; confirmar que o reforço de ofício continua operante quando boa parte do contexto é o `memorySummary`, não turnos verbatim.

---

## Referências no código

- `apps/api/src/ai/ai.service.ts` — `streamChat`: caminho de turno onde entra o reforço de ofício; hoje a mensagem `user` é só a ação crua.
- `packages/ai-engine/src/prompts/dm-system.ts` — seção de ofício (US-34) e regras de concisão a reconciliar; possível `buildTurnInstruction`.
- `packages/ai-engine/src/index.ts` — exportar o builder de turno, se houver.
- `docs/sdlc/01-requisitos/US-34-qualidade-da-narracao-do-dm.md` — origem da barra e da abertura cinematográfica; esta US estende a mesma barra aos turnos.
- `docs/sdlc/01-requisitos/US-36-eval-de-qualidade-da-narracao.md` — eval que mede esta regressão (abertura **e** turno de continuação).
