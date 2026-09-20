# US-264 — Escolhas com valor padrão invisível e campo fora de lugar: nível, variante de espécie e nome

**Épico:** 1 — Personagem
**Fase:** 1 — MVP single-player
**Status:** 📋 Planejada (não iniciada)
**Depende de:** [US-227](./US-227-nivel-inicial-pv-e-bonus-de-proficiencia-por-classe.md) (✅) · [US-142](./US-142-tracos-mecanicos-subespecie-srd-5-1.md) (✅) · [US-210](./US-210-identidade-como-etapa-propria.md) (✅)
**Relacionada a:** [US-259](./US-259-proximo-desabilitado-diz-o-que-falta.md)
**Criada em:** 2026-09-18
**Origem:** crítica de design do fluxo de criação (2026-09-18), lida do código. Três achados pequenos que a jogadora encontra sem perceber que existem; nenhum **reverte** decisão anterior.

---

## História

> **Como** jogadora que ainda não conhece o wizard,
> **quero** ver que existe um nível a escolher, que uma subespécie já veio marcada e que o texto da etapa não me chama de "o personagem" quando eu ainda não dei nome,
> **para que** eu não siga com valores que não escolhi ou textos que não fazem sentido.

---

## Contexto e motivação

### O problema observado

1. **Nível.** O seletor de nível inicial (1–20) mora dentro do painel de detalhe da classe, abaixo de subclasse e acima do kit ([SetupWizard.tsx:1374](../../../apps/web/src/components/setup/SetupWizard.tsx)). Só existe depois de escolher a classe e fica abaixo da dobra. A tela não diz o que o nível muda (a [US-227](./US-227-nivel-inicial-pv-e-bonus-de-proficiencia-por-classe.md) mostra que PV e bônus de proficiência derivam dele).
2. **Variante.** `selectRootCard` preenche a **primeira** subespécie ([:804](../../../apps/web/src/components/setup/SetupWizard.tsx)) porque a raiz sozinha não é chave jogável (ver o comentário do código, "correção de 2026-09-02"). "Próximo" já fica habilitado; a jogadora pode seguir sem ver a grade de variantes abaixo e sem saber que herdou uma.
3. **Nome.** O subtítulo de `background` interpola `{name}` ([:1800](../../../apps/web/src/components/setup/SetupWizard.tsx), `setup.background.subtitulo`). O nome só é pedido em `identity`, quatro etapas depois, então na primeira passada o texto cai sempre em "Quem é o personagem?" (`setup.background.defaultName`).

### A proposta

- Nível: uma linha sob o seletor dizendo o que muda ("PV e bônus de proficiência acompanham o nível").
- Variante: marcar a subespécie pré-selecionada como "Padrão — troque abaixo" e levar a vista até a grade quando a raiz é escolhida.
- Nome: tirar a interpolação de `{name}` do subtítulo de `background`.

---

## Escopo

### Dentro do escopo

- Chave nova com a frase de consequência do nível, nos dois locales.
- Selo "Padrão" no cartão de variante escolhido automaticamente; some quando a jogadora clica em qualquer variante. `scrollIntoView` da grade de variantes ao escolher uma raiz com subespécie.
- `setup.background.subtitulo` sem `{name}` e remoção de `setup.background.defaultName` se nada mais a usa.

### Fora do escopo

- **Mover o nome para o início.** A [US-210](./US-210-identidade-como-etapa-propria.md) põe nome, gênero e alinhamento no **fim** de propósito (campos estruturados, decisão da mantenedora). Não reabrir aqui; ver Questões.
- **Mover o nível para outra etapa.** Posição decidida pela mantenedora em 2026-09-10 (US-227). Aqui só a frase.
- **Exigir escolha explícita de variante.** É a alternativa recusada abaixo.

---

## Critérios de aceite

- [ ] Sob o seletor de nível existe a frase de consequência, em pt-BR e en-US.
- [ ] Escolher uma raiz com subespécie marca a primeira variante como "Padrão" e rola até a grade; clicar em qualquer variante remove o selo.
- [ ] Raiz sem subespécie não mostra selo nem rola.
- [ ] Com `charData.name` vazio ou preenchido, o subtítulo de `background` é o mesmo texto.
- [ ] **Teste de regressão:** o subtítulo de `background` não contém a chave `defaultName` nem depende do nome; o selo "Padrão" aparece só antes da primeira escolha manual de variante.

---

## Notas de implementação

- O selo "Padrão" é estado derivado ("variante == primeira && a jogadora ainda não escolheu"), um booleano `variantTouched`, resetado junto de `selectRootCard`.
- O nível acima de 1 pode implicar escolhas (aumentos de atributo, features por nível) que o wizard não oferece. **Não verifiquei** o que ele faz hoje com nível > 1 além de PV e proficiência; ver Questões antes de escrever a frase.

---

## Questões em aberto

1. **O que muda de fato com nível > 1 na criação?** A frase de consequência só pode citar o que é verdade no código de hoje. Verificar antes de escrever.
2. **Exigir a escolha da variante em vez de pré-selecionar?** Corta o padrão silencioso, mas custa um clique extra em toda raça com subespécie. Recomendação: manter a pré-seleção e torná-la visível.
3. **Pedir o nome mais cedo?** Reabre a US-210. Só se dados de uso mostrarem abandono na etapa de identidade; hoje é opinião.

---

## Referências no código

- [SetupWizard.tsx](../../../apps/web/src/components/setup/SetupWizard.tsx) — nível (:1374-1387), `selectRootCard` (:804), subtítulo de `background` (:1799)
- [pt-BR.ts](../../../apps/web/src/messages/pt-BR.ts) — `setup.background.subtitulo` (:251), `setup.background.defaultName` (:252)
