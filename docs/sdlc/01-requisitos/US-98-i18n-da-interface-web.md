# US-98 — Interface web em inglês (i18n das strings do front)

**Épico:** 4 — Onboarding e navegação
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** [US-97](./US-97-seletor-de-idioma-pt-br-en.md) — **obrigatória e anterior**: sem `User.locale` e sem seletor não há o que ler para escolher o dicionário nem evento ao qual reagir
**Relacionada a:** [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (a outra metade do texto que o jogador lê no wizard — labels de atributo e perícia vêm do `config`, não do front) · [US-46](./US-46-acessibilidade-wcag-aa.md) (`aria-label`, `title` e o atributo `lang` também são texto) · [US-66](./US-66-telas-mobile-friendly.md) (string traduzida muda de largura — o layout responsivo tem de aguentar) · [ADR 005](../../adr/005-locale-como-dimensao.md) (i18n da UI é a fase "UI" do faseamento) · [US-102](./US-102-gate-de-string-literal-no-jsx.md) (**posterior**: o gate que impede a próxima tela de reabrir esta story — nasceu da *Questão em aberto* #1 e só pode ligar com a baseline daqui zerada)
**Criada em:** 2026-07-30

---

## História

> **Como** jogador anglófono que já escolheu English no seletor,
> **quero** que a interface — botões, rótulos, mensagens de erro — esteja em inglês,
> **para que** eu consiga atravessar o login e a criação de personagem e chegar à mesa, em vez de travar num formulário que não leio.

---

## Contexto e motivação

### O problema observado

A [US-97](./US-97-seletor-de-idioma-pt-br-en.md) entrega narração e abertura em inglês, mas **o jogador anglófono não chega até elas**: o caminho até a mesa passa por login, home e um wizard de 6 etapas, todos com as strings PT escritas à mão no JSX. Escolher a raça, distribuir atributos e escolher perícias são decisões tomadas lendo rótulos — em português, não há como tomá-las.

**Baseline (estimativa por grep, 30/07/2026):** ~110 linhas de `.tsx` com texto em português **fora de linhas de comentário**, concentradas em [`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) (~49) e [`GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx) (~42), mais [`HomeHero.tsx`](../../../apps/web/src/components/HomeHero.tsx) (~13) e um punhado nas primitivas e telas restantes. É estimativa de ordem de grandeza para dimensionar a story, **não** contagem exata de strings — uma linha pode conter mais de uma, e a heurística (acentos + palavras-chave) erra nos dois sentidos.

### Por que a solução atual não basta

Não há solução atual: nenhuma string do front passa por indireção nenhuma. Cada texto está literal no componente que o renderiza, então "mostrar em inglês" hoje significa editar o JSX — não existe ponto onde o idioma escolhido possa entrar.

Dois detalhes que a extração vai expor e que valem correção no caminho:

- **A tela de login está em português europeu** — *"Entra com a tua conta para os teus personagens te seguirem em qualquer dispositivo"* ([`login/page.tsx:20`](../../../apps/web/src/app/login/page.tsx)) —, e o mesmo "tu/teu" aparece em textos do wizard. O prompt do Mestre proíbe explicitamente essa forma para a narração (`dm-system.ts:140`: usar "você", nunca "tu"), mas a interface nunca foi passada a limpo. Extrair strings é a hora barata de uniformizar o pt-BR.
- **`aria-label`, `title`, `<title>`/`description` do `metadata` e as mensagens de erro** são texto de interface tanto quanto o corpo dos botões, e costumam ficar para trás numa extração feita "a olho".

### A proposta

Tirar cada string visível de dentro do componente, resolvê-la por chave contra um dicionário por idioma, e ligar a escolha do dicionário ao `User.locale` da US-97 — com a troca refletindo na hora, sem recarregar a página.

---

## Escopo

### Dentro do escopo

- **Mecanismo de tradução:** dois dicionários TypeScript (`pt-BR`, `en-US`) e um `t(chave)` que resolve pelo locale ativo, mais o que for preciso para os componentes reagirem à troca sem reload.
- **Extração de todas as strings visíveis** das telas e primitivas: [`login/page.tsx`](../../../apps/web/src/app/login/page.tsx), [`HomeHero.tsx`](../../../apps/web/src/components/HomeHero.tsx), [`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) (rótulos das 6 etapas, botões, validações), [`GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx) (abas da ficha, HP, estados, caixa de ação, avisos de warm-up), [`AuthNav.tsx`](../../../apps/web/src/components/AuthNav.tsx), [`ThemeToggle.tsx`](../../../apps/web/src/components/ThemeToggle.tsx), [`dm.tsx`](../../../apps/web/src/components/ui/dm.tsx).
- **Texto que não é parágrafo:** `aria-label`, `title`, skip link ("Pular para o conteúdo"), `metadata.title`/`description` do [`layout.tsx`](../../../apps/web/src/app/layout.tsx), mensagens de erro de fetch.
- **Atributo `lang` do `<html>` no HTML servido.** Só a metade do servidor: a do cliente **já foi entregue pela [US-97](./US-97-seletor-de-idioma-pt-br-en.md)** (`document.documentElement.lang = locale`, [`LocaleProvider.tsx:65`](../../../apps/web/src/components/LocaleProvider.tsx)) e já tem teste ([`locale.test.tsx:50`](../../../apps/web/src/components/locale.test.tsx)). O que falta é [`layout.tsx:41`](../../../apps/web/src/app/layout.tsx), que emite `lang="pt-BR"` cravado em todo primeiro paint — [US-46](./US-46-acessibilidade-wcag-aa.md): é o que faz o leitor de tela escolher a voz certa.
- **Uniformizar o pt-BR** das strings extraídas (fim do "tu/teu" da tela de login e do wizard), alinhando com a regra que o prompt já impõe à narração.
- Testes: renderização de uma tela nos dois locales, e verificação de que o `lang` do `<html>` acompanha.

### Fora do escopo

- **Labels do `config`** — atributos, perícias, nomes de classe e magia vêm do banco, não do front: [US-99](./US-99-config-do-sistema-no-locale-ativo.md).
- **Ficha do personagem** (`features`/`spells` materializados em texto) — fase "Ficha" do [ADR 005](../../adr/005-locale-como-dimensao.md).
- **Narração e abertura** — [US-97](./US-97-seletor-de-idioma-pt-br-en.md). **Ganchos de aventura** — [US-101](./US-101-ganchos-de-aventura-em-ingles.md): esta story traduz a moldura da tela do convite, não o texto do gancho dentro dela.
- **Mensagens de erro da API** (texto de exceção do NestJS que chega ao cliente). Só entram se aparecerem na tela para o jogador; nesse caso, traduzir no front pela chave, não no servidor.
- Um terceiro idioma. A estrutura aceita, mas nada é feito por ele aqui.

---

## Critérios de aceite

- [x] Com `locale = 'en-US'`, um jogador completa o fluxo inteiro — login, home, wizard das 6 etapas, gancho, entrar na mesa — sem encontrar texto de interface em português (labels vindas do `config` são exceção conhecida até a [US-99](./US-99-config-do-sistema-no-locale-ativo.md)).
- [x] Trocar o idioma no seletor re-renderiza a interface **sem recarregar a página** e sem perder o estado da tela (etapa do wizard, texto já digitado).
- [x] **O `lang` do `<html>` já sai certo do servidor**, não só depois da hidratação: com o cookie `ai-dm-locale` em `en-US`, o HTML servido traz `lang="en-US"`. A metade do cliente está entregue e coberta desde a [US-97](./US-97-seletor-de-idioma-pt-br-en.md) — [`LocaleProvider.tsx:65`](../../../apps/web/src/components/LocaleProvider.tsx), teste em [`locale.test.tsx:50`](../../../apps/web/src/components/locale.test.tsx) —, então o trabalho aqui é só [`layout.tsx:41`](../../../apps/web/src/app/layout.tsx), hoje `lang="pt-BR"` cravado. **Por que não basta o efeito do cliente:** o leitor de tela escolhe a voz pelo primeiro paint, e o HTML servido (crawler, "ver código-fonte", falha de hidratação) nunca chega a ser corrigido. Ler o cookie no layout resolve com o mesmo `cookies()` de `next/headers` que [`auth.ts:58`](../../../apps/web/src/auth.ts) já usa.
- [x] `aria-label`, `title`, o skip link e o `metadata` da página estão traduzidos, não só o texto visível.
- [x] Nenhuma string PT literal restou no JSX das telas listadas no escopo — **zero exceções**. A marca chegou a ficar literal no cabeçalho do `SceneFrame` por ser nome próprio invariante; deixou de o ser em 31/07/2026 (*Mestre da Crônica* / *Chronicle Master*) e passou pelo dicionário como o resto, via o componente [`BrandName`](../../../apps/web/src/components/BrandName.tsx).
- [x] As strings pt-BR extraídas usam "você" — nenhuma forma "tu/teu" sobrevive. Junto vieram os europeísmos que a extração expôs: `Género`→`Gênero`, `registadas`→`registradas`, `A carregar`→`Carregando`, `Confere`→`Confira`, `Recarrega`→`Recarregue`.
- [ ] Layout não quebra em 375px com as strings EN (algumas encompridam) — regressão da [US-66](./US-66-telas-mobile-friendly.md). **Parcial:** medido zero overflow horizontal em 375px na tela de login em `en-US`, e a `responsive.test.tsx` continua verde. O wizard e a mesa **não foram inspecionados visualmente em inglês** — `/setup` e `/play` estão atrás do login Google ([`middleware.ts`](../../../apps/web/src/middleware.ts)) e não são alcançáveis sem uma sessão real.
- [x] **Eval / teste de regressão:** renderizar uma tela com texto denso (o wizard) nos dois locales e afirmar um rótulo de cada — falha se o dicionário não estiver ligado ao locale ativo ou se a troca não propagar. Em [`i18n.test.tsx`](../../../apps/web/src/components/i18n.test.tsx), com mais três casos que a story não previa: o `value` de classe continua em PT, os placeholders batem entre os dois dicionários, e o cookie do servidor cai no default quando é lixo.

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- **Dois objetos TS e um `t()` de uma linha, sem lib.** São 2 idiomas, sem plural complexo nem formatação de data/moeda. `next-intl` e afins pagam roteamento por locale (`/en/...`, `/pt-BR/...`) e ICU MessageFormat — nenhum dos dois serve aqui, porque o idioma vem de `User.locale`, não da URL (D1 do [ADR 005](../../adr/005-locale-como-dimensao.md)). A lib entra quando aparecer um terceiro idioma ou plural de verdade. Racional completo na US-97, seção *Nota para a story de i18n da UI*.
- **Não concatenar frases.** `t('etapa') + ' ' + n + ' ' + t('de') + ...` quebra em qualquer idioma com outra ordem de palavras. Use a frase inteira com placeholder — o wizard já tem o caso: *"Etapa {n} de {total} — {rótulo}"* ([`SetupWizard.tsx:253`](../../../apps/web/src/components/setup/SetupWizard.tsx)).
- **Chave por tela/componente** (`setup.attributes.titulo`), não por texto em inglês: chave derivada do texto muda toda vez que o texto muda.
- **Tipar o dicionário e derivar a assinatura dele.** `t(k: keyof typeof ptBR)` faz o typo de chave (`t('setup.tipo')`) virar erro de compilação no `pnpm typecheck` que o CI já roda, e força o dicionário EN a cobrir toda chave do PT (`Record<keyof typeof ptBR, string>`) — chave esquecida na tradução não chega a produção como `undefined` na tela. Uma assinatura resolve as duas coisas; não precisa de gate próprio (fechamento da *Questão em aberto* #1).
- O dicionário PT sai do que já está no JSX — é recorte, não redação. O EN é o texto novo.
- **Componente de cliente dentro de um de servidor, para não arrastar o design system.** O `SceneFrame` ([`dm.tsx`](../../../apps/web/src/components/ui/dm.tsx)) precisa de texto traduzido (a marca) mas tem de continuar renderizável no servidor — `app/page.tsx` monta-o sem `'use client'`, e um hook ali tornaria a home inteira cliente. A saída é a que o próprio SceneFrame já usava para o `LocaleToggle`: um componente de cliente pequeno ([`BrandName`](../../../apps/web/src/components/BrandName.tsx)) renderizado por dentro. Vale para qualquer primitiva do design system que venha a precisar de texto.
- **Traduzir o rótulo, nunca o `value` — achado na implementação (31/07/2026).** Os `<select>` de gênero/raça/classe do wizard não são texto puro: o que o jogador escolhe viaja para a API e vira `Character.class`. A API resolve kit, features, magias e gancho de aventura por **palavra portuguesa** — `CLASS_SYNONYMS` em [`starting-inventory.ts`](../../../apps/api/src/character/starting-inventory.ts) casa `'mag'`→`wizard`, `'guerreir'`→`fighter`, `'monge'`→`monk`, e **não** tem entrada para `wizard`, `fighter` nem `monk`. Enviar o rótulo traduzido não daria erro nenhum: a classe cairia no kit `default` em silêncio, e o personagem inglês nasceria sem features nem magias. Por isso as listas `GENDERS`/`RACES`/`CLASSES` continuam em pt-BR (são chave, não cópia) e só o `<option>` é traduzido. Chave EN de verdade é a [US-100](./US-100-ficha-do-personagem-no-locale-ativo.md), não esta.
- Cuidado com os componentes de servidor: o `metadata` do App Router é resolvido no servidor, então precisa do locale por outro caminho que não o estado do cliente. **O caminho já existe:** a US-97 escreve um cookie `ai-dm-locale` ([`LocaleProvider.tsx:20`](../../../apps/web/src/components/LocaleProvider.tsx)) criado exatamente por isto — o comentário lá diz *"o `localStorage` não existe no servidor"*. O `export const metadata` estático de [`layout.tsx:16`](../../../apps/web/src/app/layout.tsx) vira a variante dinâmica do App Router (função `async`), lê `cookies().get(LOCALE_STORAGE_KEY)` e indexa o dicionário direto; nenhuma infra nova.

---

## Questões em aberto

1. **Vale um gate mecânico contra string literal no JSX** (na linha dos gates de doc — [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md), [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md)), para a próxima tela nascer traduzida? Ou é cedo demais, com uma tela nova a cada duas semanas?

   ✅ **Fechada em 31/07/2026 — sim, e virou a [US-102](./US-102-gate-de-string-literal-no-jsx.md); fora desta story, depois dela.**

   O "cedo demais" era o argumento errado invertido: uma tela nova a cada duas semanas é a **frequência do defeito**, não a razão para adiar o gate. Sem ele, cada tela nova é uma reabertura desta story em miniatura.

   O que decidiu o desenho foi a medição, não a intuição. Varredura por parser (`ts.createSourceFile`, `ScriptKind.TSX`) sobre os 15 `.tsx` de `apps/web/src`, em 31/07/2026: **126 nós cobráveis** (87 `JsxText` com letra, 16 atributo visível literal, 23 prosa em `{…}`) contra **109 de ruído** se a regra for "qualquer literal dentro de JSX" (48 classes Tailwind em `{cn(...)}`, 46 tokens curtos como `'primary'`/`'tab'`/`'pt-BR'`, 15 `JsxText` de pontuação `·`/`—`). 46% de falso positivo na regra ingênua — e gate com falso positivo é gate que alguém desliga.

   Dois desdobramentos que voltam **para dentro** desta story:
   - **Os 126 são a baseline que a US-102 exige zerada.** Ela não pode ligar antes desta fechar, sob pena de nascer vermelha (a lição do `docs:links`, que só apertou quando a [US-79](./US-79-consertar-links-quebrados-na-documentacao.md) zerou a dele). O critério de aceite *"Nenhuma string PT literal restou no JSX das telas listadas"* passa a ter número: **zero achados no `pnpm i18n:literals`**.
   - **Tipar o dicionário é trabalho daqui, não de lá.** `t(k: keyof typeof ptBR)` faz o typo de chave (`t('setup.tipo')`) virar erro no `pnpm typecheck` que o CI já roda — uma assinatura, não um gate. Ver *Notas de implementação*.

   O gate cobre o corpo do componente e **não** cobre a periferia: os mapas `STEP_LABEL`/`SOURCE_TYPE_HINT` no topo do [`SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx), o `window.confirm` do [`HomeHero.tsx:56`](../../../apps/web/src/components/HomeHero.tsx) e o `metadata` do [`layout.tsx`](../../../apps/web/src/app/layout.tsx) não são nó JSX. São ~10 casos que continuam dependendo de revisão humana — e todos os três já estão no escopo desta story, então a extração daqui é a única passagem em que eles serão pegos de propósito.

2. **Onde o dicionário mora** — um arquivo por idioma (`messages/pt-BR.ts`) ou um arquivo por tela com as duas línguas lado a lado? O primeiro facilita traduzir em bloco; o segundo mantém o texto perto de quem o usa.

   ✅ **Fechada em 31/07/2026 — um arquivo por idioma, com namespace por tela dentro.** `apps/web/src/messages/pt-BR.ts` e `apps/web/src/messages/en-US.ts`. A estrutura interna espelha a chave já decidida em *Notas de implementação* (`setup.attributes.titulo`), então não há segunda convenção a manter.

   ```ts
   // messages/pt-BR.ts — recorte do que já está no JSX
   export const ptBR = {
     setup: { attributes: { titulo: 'Distribua os atributos' } },
     home:  { erro: { lista: 'Não foi possível carregar seus personagens.' } },
   } as const

   // messages/en-US.ts — o TIPO é o gate: chave faltando não compila
   export const enUS: Record<keyof typeof ptBR, unknown> = { … }
   ```

   **O argumento principal do lado B morreu no fechamento da #1.** "Lado a lado deixa ver a tradução faltando" era a força da divisão por tela — e o dicionário tipado transforma chave faltante em erro de compilação no `pnpm typecheck` que o CI já roda. Detecção por `tsc` domina detecção por olho; sobra da opção B só o custo.

   O resto do desempate:

   - **O EN é texto novo escrito de uma vez.** O pt-BR é recorte; o en-US é uma passada de tradução sobre o conjunto inteiro, feita e revista uma vez. Um arquivo é uma passada e um diff; espalhado por tela são 15 arquivos abertos para uma tarefa só.
   - **~140 chaves ≈ 170 linhas por arquivo**, contra a regra de <500 do [`AGENTS.md`](../../../AGENTS.md). Não pressiona.
   - **Regra de divisão, já escrita:** passando de 500 linhas (terceiro idioma, telas da Fase 2), divide em `messages/pt-BR/setup.ts` pelo namespace que já existe. É por isso que o namespace entra desde agora em vez de chave achatada — a divisão futura fica mecânica.

   **O contra é real e foi aceito:** trocar a cópia de uma tela passa a exigir dois arquivos distantes, não um. Mas mudar a cópia **de um idioma só** é justamente a operação que não deve ser fácil num app bilíngue — é ela que produz drift. Atrito direcional, no sentido certo.

   **Restrição que sai daqui e vale mais que a divisão em arquivos:** o dicionário é módulo importável puro, nunca algo alcançável só pelo `useLocale()`. É o que permite ao `metadata` do servidor indexar o mesmo objeto — ver a nota dele em *Notas de implementação*.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — maior concentração de texto; rótulos das etapas, validações, revisão.
- [`apps/web/src/components/game/GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx) — segunda maior; abas da ficha, HP, caixa de ação, avisos de warm-up.
- [`apps/web/src/app/login/page.tsx:20`](../../../apps/web/src/app/login/page.tsx) — a frase em português europeu que a extração deve corrigir.
- [`apps/web/src/app/layout.tsx:41`](../../../apps/web/src/app/layout.tsx) — `lang="pt-BR"` cravado; `:16` o `metadata`; `:44` o skip link.
- [`apps/web/src/components/ui/dm.tsx`](../../../apps/web/src/components/ui/dm.tsx) — primitivas do design system; texto aqui aparece em todas as telas.
- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — a regra de pt-BR brasileiro (sem "tu/teu") que a narração já segue e a UI ainda não.
