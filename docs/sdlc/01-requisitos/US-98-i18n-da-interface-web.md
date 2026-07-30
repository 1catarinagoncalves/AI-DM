# US-98 — Interface web em inglês (i18n das strings do front)

**Épico:** 4 — Onboarding e navegação
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-97](./US-97-seletor-de-idioma-pt-br-en.md) — **obrigatória e anterior**: sem `User.locale` e sem seletor não há o que ler para escolher o dicionário nem evento ao qual reagir
**Relacionada a:** [US-99](./US-99-config-do-sistema-no-locale-ativo.md) (a outra metade do texto que o jogador lê no wizard — labels de atributo e perícia vêm do `config`, não do front) · [US-46](./US-46-acessibilidade-wcag-aa.md) (`aria-label`, `title` e o atributo `lang` também são texto) · [US-66](./US-66-telas-mobile-friendly.md) (string traduzida muda de largura — o layout responsivo tem de aguentar) · [ADR 005](../../adr/005-locale-como-dimensao.md) (i18n da UI é a fase "UI" do faseamento)
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
- **Atributo `lang` do `<html>`** acompanhando o locale (hoje cravado `pt-BR` em [`layout.tsx:41`](../../../apps/web/src/app/layout.tsx)) — [US-46](./US-46-acessibilidade-wcag-aa.md): é o que faz o leitor de tela escolher a voz certa.
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

- [ ] Com `locale = 'en-US'`, um jogador completa o fluxo inteiro — login, home, wizard das 6 etapas, gancho, entrar na mesa — sem encontrar texto de interface em português (labels vindas do `config` são exceção conhecida até a [US-99](./US-99-config-do-sistema-no-locale-ativo.md)).
- [ ] Trocar o idioma no seletor re-renderiza a interface **sem recarregar a página** e sem perder o estado da tela (etapa do wizard, texto já digitado).
- [ ] O atributo `lang` do `<html>` reflete o locale ativo.
- [ ] `aria-label`, `title`, o skip link e o `metadata` da página estão traduzidos, não só o texto visível.
- [ ] Nenhuma string PT literal restou no JSX das telas listadas no escopo.
- [ ] As strings pt-BR extraídas usam "você" — nenhuma forma "tu/teu" sobrevive.
- [ ] Layout não quebra em 375px com as strings EN (algumas encompridam) — regressão da [US-66](./US-66-telas-mobile-friendly.md).
- [ ] **Eval / teste de regressão:** renderizar uma tela com texto denso (o wizard) nos dois locales e afirmar um rótulo de cada — falha se o dicionário não estiver ligado ao locale ativo ou se a troca não propagar.

---

## Notas de implementação

> *Dicas e decisões técnicas para quem vai implementar. Não é especificação obrigatória — o implementador pode divergir com boa justificativa.*

- **Dois objetos TS e um `t()` de uma linha, sem lib.** São 2 idiomas, sem plural complexo nem formatação de data/moeda. `next-intl` e afins pagam roteamento por locale (`/en/...`, `/pt-BR/...`) e ICU MessageFormat — nenhum dos dois serve aqui, porque o idioma vem de `User.locale`, não da URL (D1 do [ADR 005](../../adr/005-locale-como-dimensao.md)). A lib entra quando aparecer um terceiro idioma ou plural de verdade. Racional completo na US-97, seção *Nota para a story de i18n da UI*.
- **Não concatenar frases.** `t('etapa') + ' ' + n + ' ' + t('de') + ...` quebra em qualquer idioma com outra ordem de palavras. Use a frase inteira com placeholder — o wizard já tem o caso: *"Etapa {n} de {total} — {rótulo}"* ([`SetupWizard.tsx:253`](../../../apps/web/src/components/setup/SetupWizard.tsx)).
- **Chave por tela/componente** (`setup.attributes.titulo`), não por texto em inglês: chave derivada do texto muda toda vez que o texto muda.
- O dicionário PT sai do que já está no JSX — é recorte, não redação. O EN é o texto novo.
- Cuidado com os componentes de servidor: o `metadata` do App Router é resolvido no servidor, então precisa do locale por outro caminho que não o estado do cliente.

---

## Questões em aberto

1. **Vale um gate mecânico contra string literal no JSX** (na linha dos gates de doc — [US-82](./US-82-gate-de-convencao-de-nomes-de-arquivo-nos-docs.md), [US-88](./US-88-gate-de-identificadores-inexistentes-nos-docs-normativos.md)), para a próxima tela nascer traduzida? Ou é cedo demais, com uma tela nova a cada duas semanas?
2. **Onde o dicionário mora** — um arquivo por idioma (`messages/pt-BR.ts`) ou um arquivo por tela com as duas línguas lado a lado? O primeiro facilita traduzir em bloco; o segundo mantém o texto perto de quem o usa.

---

## Referências no código

- [`apps/web/src/components/setup/SetupWizard.tsx`](../../../apps/web/src/components/setup/SetupWizard.tsx) — maior concentração de texto; rótulos das etapas, validações, revisão.
- [`apps/web/src/components/game/GameView.tsx`](../../../apps/web/src/components/game/GameView.tsx) — segunda maior; abas da ficha, HP, caixa de ação, avisos de warm-up.
- [`apps/web/src/app/login/page.tsx:20`](../../../apps/web/src/app/login/page.tsx) — a frase em português europeu que a extração deve corrigir.
- [`apps/web/src/app/layout.tsx:41`](../../../apps/web/src/app/layout.tsx) — `lang="pt-BR"` cravado; `:16` o `metadata`; `:44` o skip link.
- [`apps/web/src/components/ui/dm.tsx`](../../../apps/web/src/components/ui/dm.tsx) — primitivas do design system; texto aqui aparece em todas as telas.
- [`packages/ai-engine/src/prompts/dm-system.ts`](../../../packages/ai-engine/src/prompts/dm-system.ts) — a regra de pt-BR brasileiro (sem "tu/teu") que a narração já segue e a UI ainda não.
