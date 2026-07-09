# Aventura de referência — Lady Seraphine Valthor, Paladina de Solariel

**Origem:** partida real jogada no Grok, exportada de `A Jornada de Lady Seraphine Valthor – Paladina de Solariel.docx` (~87k palavras, ~3346 parágrafos).
**Papel neste projeto:** âncora **positiva** de qualidade narrativa para a US-17 (bake-off de modelos + LLM-judge). Fonte da rubrica e dos turnos exemplares de calibração (few-shot).
**Extraído em:** 2026-07-09 (UTF-8 limpo; a extração direta do `.docx` vinha corrompida em cp1252).

---

## ⚠️ Como usar (e como NÃO usar)

**É âncora de NARRAÇÃO, não gold de mecânica.** Esta partida agradou pelo *jeito de narrar* — imersão, voz de NPC, tensão, escolhas. Mas tem falhas mecânicas conhecidas que **não** devem ser imitadas nem julgadas pelo juiz LLM:

- Não rolava dados — resultados de ação eram narrados por decisão do mestre ("dois zumbis desintegram-se"), sem tiragem.
- O mestre não lia a ficha — modificadores/atributos não ancoravam os desfechos.
- Inventário e recursos ("energia divina") eram descritos por vibe, não calculados.

Essas dimensões vivem em testes **determinísticos** (US-27/29/38). Para o juiz de narrativa, use os exemplares abaixo como padrão de **"nota 5" de prosa**, nunca como resposta a copiar nem como fonte de regras.

---

## Rubrica derivada desta referência

| Dimensão | O que esta aventura faz bem |
|---|---|
| **Imersão** | 2ª pessoa, presente, sem quebrar a 4ª parede ("Você desmonta perto do portão…"). |
| **Detalhe sensorial** | Ancora cada cena em som/visão/tato (chuva fina, silêncio pesado, "gosto amargo na boca e peso gelado no peito"). |
| **Agência** | Fecha todo turno com 3–5 escolhas concretas + "Outra ação (descreva)". |
| **Voz de NPC** | NPCs têm fala, medo e intenção próprios (Garrick trêmulo; Padre Elias corrompido e sedutor; Kael, Elara e Theodric com opiniões distintas). |
| **Ritmo** | Escala tensão progressivamente (chegada → investigação → primeiro confronto → revelação). |
| **Coerência** | Mantém o estado: bênção/luz ativas são reafirmadas nos turnos seguintes; o mal "recua" e "lembra" da invocação anterior. |

---

## Turnos exemplares (few-shot de calibração)

Cada bloco é um par `ação do jogador → resposta do DM`. São os alvos de "nota 5" passados ao juiz como âncora.

### Exemplar 1 — Turno de abertura (imersão + gancho + agência)

**Ação do jogador:** _[início da aventura]_

**Resposta do DM:**

> A chuva fina caía sobre a estrada de terra batida enquanto você cavalgava em sua égua branca, Aurora. A armadura brilhante, mesmo molhada, ainda refletia a luz fraca do entardecer. Fazia três dias desde que deixou a última cidade, guiada por um sonho divino: "Nas sombras de Eldridge, as trevas despertam. Uma chama se apaga… e o inocente clama por justiça."
>
> À frente, as luzes tremulantes de Vila de Eldridge surgiam entre as árvores. Um lugar pequeno, cercado por florestas densas e campos de trigo. Mas algo estava errado. O portão de madeira estava entreaberto, e o silêncio era pesado demais para uma vila ao anoitecer. Nenhum som de crianças, cachorros ou risadas da taverna.
>
> Você desmonta perto do portão. Sua mão direita descansa no punho da espada longa Luz da Manhã, enquanto a esquerda segura o escudo com o símbolo do Sol Dourado.
>
> De repente, um homem idoso, magro e com roupas rasgadas, sai correndo de uma casa próxima e cai de joelhos ao vê-la.
>
> — Pela Luz! Uma paladina! — ele exclama, com a voz trêmula. — Senhora… por favor… eles levaram as crianças! Faz três noites que as sombras vêm. Criaturas que não são vivas nem mortas… Elas surgem quando a lua está alta. O prefeito mandou fechar tudo, mas… nós não aguentamos mais!
>
> Você sente um formigamento familiar no peito: a presença do mal próximo. Solariel está atento. O que você faz, Lady Seraphine?

**Por que é nota 5:** abre estabelecendo lugar, clima e stakes em três parágrafos; planta o mistério (silêncio, portão entreaberto); dá voz imediata a um NPC com necessidade concreta; encerra devolvendo a agência ao jogador.

---

### Exemplar 2 — Coleta de informação (voz de NPC + lore sem despejo)

**Ação do jogador:** Perguntar mais detalhes ao velho (quantas crianças, as criaturas, o padre).

**Resposta do DM:**

> Lady Seraphine assente com seriedade e ajuda o velho a se levantar, sua voz firme e calma:
>
> — Fale tudo o que sabe, bom homem. Quantas crianças foram levadas? Como eram essas criaturas? O que exatamente aconteceu com o padre?
>
> O velho, ainda tremendo, segura suas mãos como se fossem uma âncora. Seus olhos estão vermelhos de choro e noites sem dormir.
>
> — S-são sete crianças, senhora... as mais novas tinham só cinco anos. Elas sumiram uma por noite. A primeira foi o filho do ferreiro, depois as outras. Sempre quando a lua está alta.
>
> Ele engole em seco antes de continuar:
>
> — As criaturas... que Solariel nos proteja... são mortos-vivos, mas não como os zumbis comuns. São sombras com forma humana, olhos vermelhos brilhantes, mãos que parecem garras de osso. Elas não fazem barulho ao andar. Passam através das portas trancadas como se fossem fumaça.
>
> — Quanto ao padre... Padre Elias era um bom homem. Na terceira noite, ele disse que ia enfrentar o mal na igreja antiga. Pegou seu cajado sagrado e foi sozinho. Nunca mais voltou. Desde então, as luzes da igreja à noite ficam... erradas. Roxas e tremulantes, não amarelas como velas normais.
>
> O velho baixa a voz, quase sussurrando:
>
> — Tem gente na vila dizendo que o próprio padre pode ter sido corrompido... ou que algo despertou embaixo da cripta. Tem uma lenda antiga sobre um necromante que foi enterrado aqui há duzentos anos...
>
> Enquanto ele fala, você sente novamente aquela presença maligna pulsando mais forte — especialmente vinda da direção da igreja. A noite está quase completa. O que você faz agora, Lady Seraphine?

**Por que é nota 5:** entrega exposição inteiramente pela boca de um personagem com voz própria (gaguejo, sussurro, medo); a lore chega em pedaços motivados, não em bloco; fecha reancorando a ameaça e o relógio ("a noite está quase completa").

---

### Exemplar 3 — Confronto e revelação (ritmo + cliffhanger)

**Ação do jogador:** Invocar Expulsar Mortos-Vivos para purificar a área antes de entrar.

**Resposta do DM:**

> Lady Seraphine para a poucos metros da entrada da igreja, planta os pés firmemente no chão molhado e ergue seu escudo alto. Com voz poderosa e cheia de fé, você proclama:
>
> — Pela Luz de Solariel! Que as trevas sejam expulsas!
>
> Uma onda de energia dourada e brilhante explode de você em todas as direções, como uma explosão de luz solar.
>
> Três figuras sombrias que estavam escondidas entre as lápides são atingidas em cheio. Elas soltam gritos agudos e sobrenaturais enquanto suas formas putrefatas queimam em chamas douradas. Dois zumbis corrompidos desintegram-se completamente. O terceiro, mais resistente, recua cambaleando para dentro da igreja, com o corpo fumegando.
>
> A presença maligna maior (a da cripta) não foi destruída, mas você sente que ela recuou momentaneamente, como se doesse.
>
> Enquanto você se recupera do esforço da invocação, as portas da igreja se abrem lentamente com um rangido. Uma voz rouca e distorcida ecoa de dentro:
>
> — Paladina... sua luz ofende o Mestre... Mas você chegou tarde. As crianças já são dele...
>
> Uma figura aparece na entrada: o que um dia foi o Padre Elias. Seu rosto está pálido, veias negras percorrem sua pele, e seus olhos brilham em um roxo doentio. Ele segura um cajado retorcido, e atrás dele você consegue ver formas sombrias se movendo. Ele sorri de forma perturbada.
>
> — Venha... junte-se a nós na escuridão.

**Por que é nota 5:** resolve a ação com imagens fortes; gradua o resultado (dois destruídos, um resiste, o chefe só recua) em vez de "você vence"; vira a cena numa revelação e termina num gancho de diálogo que puxa o próximo turno. _(Nota mecânica: aqui o resultado foi narrado sem rolagem — no AI DM isto passaria por `rollDice`.)_

---

### Exemplar 4 — Dilema moral e coro de aliados (voz de NPC múltipla + peso)

**Ação do jogador:** Usar a visão de Solariel para saber se há um cultista realmente arrependido e qual papel ele deveria ter.

**Resposta do DM:**

> Lady Seraphine levanta a mão, pedindo um momento de silêncio na sala de planejamento. Você se afasta um pouco da mesa, coloca a mão sobre o símbolo de Solariel e fecha os olhos, buscando orientação divina:
>
> — Solariel, Luz Eterna, mostre-me a verdade nos corações desses dois homens.
>
> Uma luz dourada suave preenche sua mente. Você tem uma visão clara e curta:
>
> O mais jovem (cerca de 24 anos, magro, chamado Balen): sua alma está genuinamente arrependida. Ele foi atraído pelo culto por promessas de poder, mas nunca matou ninguém. Há medo, vergonha e um desejo real de redenção. Solariel mostra uma luz fraca, mas crescente, dentro dele.
>
> O mais velho (cerca de 41 anos, chamado Garren): há arrependimento, mas também medo profundo e um leve resquício de dúvida. Ele não é completamente confiável — se a situação ficar muito perigosa, ele pode tentar salvar a própria pele traindo o grupo.
>
> Solariel transmite uma sensação clara: "A misericórdia é uma arma poderosa, mas a sabedoria deve guiá-la."
>
> Você abre os olhos. Todos na sala estão em silêncio, esperando. O que você deseja fazer agora, Lady Seraphine?

**Por que é nota 5:** transforma um pedido de informação num dilema moral com nuance (dois graus de arrependimento, não bom/mau binário); a voz divina fala em máxima temática, não em números; sustenta a agência devolvendo uma decisão de verdade. Nos turnos vizinhos, os aliados Kael, Elara e Theodric reagem com opiniões distintas (entusiasmo, cautela, pragmatismo), mostrando um coro de NPCs bem diferenciados.

---

## Apêndice — Ficha da personagem (contexto que o DM deveria ler)

Incluída porque uma das falhas da referência era **não ler a ficha**. No AI DM, este bloco é o tipo de contexto que o prompt de sistema injeta e que a narração deve respeitar.

- **Nome:** Lady Seraphine Valthor — **Idade:** 29
- **Aparência:** mulher alta e atlética, cabelos castanhos em trança de batalha, olhos cinzentos, cicatriz na sobrancelha esquerda; armadura de placas polida com o símbolo de Solariel (sol dourado entrelaçado a espada e asa).
- **Deus:** Solariel, Senhor da Luz Eterna (justiça, cura, combate ao mal).
- **Background:** nobre menor que perdeu a família para um culto demoníaco; fez juramento sagrado e recebeu poderes divinos; paladina errante.
- **Habilidades:** combate com espada longa e escudo; cura divina; detectar o mal / expulsar mortos-vivos e demônios; aura de proteção.
- **Fraqueza:** código de honra rígido (não mente, não abandona inocentes, não tolera injustiça) — os poderes divinos enfraquecem se ela violar os votos.

---

## Nota de proveniência

Texto completo extraído para `full.txt` no scratchpad da sessão; apenas os trechos exemplares acima foram trazidos para o repositório (fair use de referência interna de avaliação). Os exemplares foram levemente aparados (remoção de rótulos de sistema tipo "Expulsar Mortos-Vivos ativado com sucesso!" e listas de "situação atual") para isolar a prosa narrativa.
