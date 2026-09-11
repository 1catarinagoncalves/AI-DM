# Exemplar — A Cripta do Véu Silencioso

**Papel:** âncora de eval (regressão) do motor de geração de aventuras autorais. Segundo exemplar ao lado de *O Olho de Iremet*.
- *O Olho de Iremet* ancora **prosa/densidade**.
- *A Cripta do Véu Silencioso* (este) ancora a **estrutura das 8 seções** (taxonomia [DnDGenerate](https://github.com/dhorions/DnDGenerate), MPL-2.0) + a presença de **Challenges** (obstáculo não-combate) e **Objective** (meta + recompensa).

**Fora do prompt de produção.** Como *O Olho de Iremet*, este exemplar é anchor de eval — ensina qualidade e estrutura de forma abstrata, **não** entra no prompt de autoria (evita a convergência de motivo que o Spike 1 expôs). Ver [Arquitetura §Âncora de eval](../../docs/arquitetura-motor-aventuras-autorais.md) e [§Camada de render](../../docs/arquitetura-motor-aventuras-autorais.md).

**Observações de mecânica:** o texto abaixo traz CD/HP/CA inline (CD 15, HP 58, +6 no ataque). Sob o contrato da [US-29](../../docs/sdlc/01-requisitos/US-29-saneamento-de-rolagens-ficticias.md), o **artefato gerado NÃO congela esses números na prosa** — o teste é nomeado qualitativamente (perícia/atributo), a CD vem em jogo (escada US-111), e os statblocks vêm do PASSO 2 (código 5e). Aqui os números ficam só como referência da forma-alvo; não são o que o motor deve emitir na prosa.

**Facções por baixo, não como seção.** A alma vem da tensão implícita (Culto do Véu extinto, orcs corrompidos, Vhorn) — nenhuma listada numa seção "Factions", mas movendo Story/Objective/Encounters. É exatamente o mundo-primeiro (`factions[]` interno) renderizado nas 8 seções.

---

## A Cripta do Véu Silencioso

### Setting
A Floresta de Ashwyrne cobre léguas de terreno antigo, névoa perpétua rastejando entre troncos negros. Sob raízes mais velhas que os reinos ao redor, dorme um templo esquecido — construído por um culto que adorava o silêncio como divindade. Camponeses da aldeia vizinha, Vaelmoor, evitam a floresta há gerações; ultimamente, viajantes desaparecem sem rastro, e um zumbido grave ecoa das profundezas nas noites sem lua. O ar sob as ruínas é frio demais pra estação, e tochas tremulam mesmo sem vento.

### Story
Vaelmoor perdeu seis moradores nas últimas três luas — lenhadores, um caçador, uma criança. Um mercador itinerante que sobreviveu a um encontro na orla da floresta fala de "sombras que engolem som" antes de desmaiar de terror. Investigação revela símbolos entalhados em árvores próximas: um olho fechado dentro de um círculo — marca do Culto do Véu, seita extinta há séculos que buscava aprisionar um deus menor do silêncio, Vhorn, dentro de uma cripta selada. Algo despertou o selo. Os grupos precisam entrar na floresta, localizar o templo enterrado, e decidir o destino da entidade antes que o silêncio se espalhe além da floresta.

### Objective
**Descrição:** Localizar a Cripta do Véu Silencioso, descobrir o que rompeu o selo de Vhorn, e escolher entre restaurar o selo ou destruir a entidade — cada escolha com consequências diferentes pra região.
**Recompensa:** O Sino de Vhorn, um sino de prata enegrecida que, quando tocado, silencia toda magia e som num raio de 9 metros por 1 minuto (1x por dia). Peça de culto original, forjada pra conter a voz do próprio deus; carrega fragmento de sua essência — sussurra em sonhos de quem o carrega.
**Localização:** encontrado na Câmara do Selo Quebrado (ver Locations).

### Locations
**1. Orla de Ashwyrne** — Fronteira da floresta onde a névoa começa a engrossar. Árvores tortas, silêncio antinatural — nem pássaros cantam aqui. Uma trilha de pegadas arrastadas some entre as raízes. *Itens:* nenhum notável, apenas os símbolos do Culto entalhados na casca, ponto de pista inicial.

**2. Vilarejo de Vaelmoor** — Pequeno povoado de pescadores e lenhadores, cercas reforçadas às pressas, poucas luzes acesas à noite. Ancião da vila, Maergen, guarda registros antigos sobre o Culto do Véu em seu porão. *Itens:* Diário do Culto (meio queimado) — descreve ritual de selamento original e localização aproximada do templo.

**3. Trilha Afundada** — Caminho de pedra coberto por raízes que desce gradualmente abaixo do nível da floresta, revelando que o templo foi construído para baixo, não pra cima. Ecos de passos soam atrasados, como se o som demorasse a viajar. *Itens:* nenhum.

**4. Átrio do Templo Afundado** — Entrada monumental esculpida em pedra negra, pilares com o símbolo do olho fechado. Um portão de prata, parcialmente derretido, marca a antiga barreira ritual. *Itens:* Amuleto do Silêncio Parcial — pingente de obsidiana que concede vantagem em testes de Furtividade baseados em som, mas causa desvantagem em testes de Percepção auditiva enquanto usado. Encontrado sob escombros do portão.

**5. Salão dos Ecos Perdidos** — Câmara ampla onde o som se comporta de forma errática — vozes viajam distorcidas, gritos chegam como sussurros. Estátuas de antigos sacerdotes cultistas alinham as paredes, olhos vazados. *Itens:* nenhum, mas local de um dos desafios.

**6. Câmara do Selo Quebrado** — Coração do templo. Um círculo ritual rachado no chão emite pulsos de escuridão visível. No centro, correntes de prata partidas — o selo de Vhorn. A entidade, ainda fraca, manifesta-se como sombra sussurrante presa parcialmente ao círculo. *Itens:* O Sino de Vhorn (recompensa), preso a um pedestal de pedra ao lado do selo.

### Challenges
**Desafio 1 — O Silêncio que Engana** *(Salão dos Ecos Perdidos)*
Jogadores ouvem o que parece ser um companheiro gritando por ajuda vindo de uma direção — mas o som é eco distorcido de outra sala, armadilha natural do templo. Teste de Sabedoria (Percepção) ou Inteligência (Investigação) pra perceber a distorção antes de se separar do grupo. Falha faz um personagem se afastar sozinho e cair em um alçapão raso levando a um encontro isolado com 2 esqueletos guardiões.

**Desafio 2 — A Barreira de Prata Derretida** *(Átrio do Templo Afundado)*
O portão de prata parcialmente derretido ainda carrega resíduo de magia de selamento; tocá-lo sem precaução causa dano. Personagens devem decifrar (Inteligência - Arcanismo) a sequência correta de símbolos pra desarmar o resíduo antes de passar, ou sofrer dano necrótico e alertar os orcs guardiões da câmara seguinte.

**Desafio 3 — O Peso do Silêncio** *(Câmara do Selo Quebrado)*
Ao se aproximar do selo quebrado, os jogadores sentem o silêncio físico começar a sugar o som de seus próprios corpos — vozes falham, passos não ecoam. Teste de Constituição a cada rodada próxima ao selo ou sofrer nível de exaustão por perda de capacidade de gritar comandos, cantar magias verbais (desvantagem em testes de concentração). Efeito cessa ao sair da câmara ou resolver o selo.

### Encounters
**Encontro 1 — Emboscada na Trilha Afundada** *(Trilha Afundada)* — Um bando de orcs bárbaros, agora servos corrompidos que guardam a trilha, ataca o grupo em terreno estreito, usando as raízes como cobertura. *NPCs:* 4x Orc Bárbaro (guarda).

**Encontro 2 — Os Guardiões Ossos** *(Salão dos Ecos Perdidos)* — Esqueletos animados pelo próprio ritual antigo emergem das estátuas quando o grupo atravessa o centro da sala, protegendo a passagem restante. *NPCs:* 6x Esqueleto Guardião.

**Encontro Final — O Despertar de Vhorn** *(Câmara do Selo Quebrado)* — Ao se aproximar do selo, a sombra sussurrante de Vhorn se manifesta com mais força, tentando corromper um dos jogadores pra libertar-se completamente (teste de Sabedoria pra resistir a possessão breve). O grupo deve decidir: restaurar o selo canalizando o Sino (ritual de 3 rodadas, defendendo o Mago Gnomo aliado que conduz o ritual) ou atacar Vhorn diretamente pra destruí-lo (batalha contra manifestação de sombra com resistência a dano não-mágico). *NPCs:* Vhorn (entidade do silêncio), Fendrel (Gnomo Mago aliado, se restauração escolhida).

### Follow Up Ideas
1. **O Eco Restante:** Se o selo foi restaurado, fragmentos da essência de Vhorn escaparam pro Sino que os jogadores carregam. Em futuras aventuras, o item começa a sussurrar pedidos, tentando guiar o grupo a libertar a entidade em outro local — gancho pra arco de corrupção lenta de item mágico.
2. **Os Órfãos do Culto:** Se Vhorn foi destruído, remanescentes do Culto do Véu (espalhados por outras regiões) descobrem o feito e caçam o grupo por vingança, ou tentam recrutá-los pra reviver a entidade de outra forma.
3. **Vaelmoor Depois do Silêncio:** A aldeia, livre da ameaça, começa a prosperar, mas sem o efeito supressor de Vhorn, criaturas da floresta profunda (antes mantidas quietas) começam a se mover livremente. Gancho pra nova investida na Floresta de Ashwyrne.

### NPCs
**Fendrel Cascalâmpada (aliado)** — Gnomo Mago, nível 6, papel Guia Erudito. Estudioso obcecado por cultos extintos, veio de uma cidade distante ao ouvir rumores de Vaelmoor. Fala rápido, ansioso, mas genuinamente corajoso quando precisa agir. Carrega cajado entalhado com runas de proteção. *Encontros:* Encontro Final. *Localização:* Câmara do Selo Quebrado (também encontrável antes, no Vilarejo, se investigarem o porão do ancião). Junta-se ao grupo se convencido do perigo real (Persuasão, ou automático se mostrarem o Diário do Culto); no Encontro Final conduz o ritual de restauração, precisando de proteção.
> "Vocês não entendem — isso não é um monstro comum, é um deus abandonado. Deuses abandonados não morrem. Eles esperam."

**Capitão Grosh (inimigo, grupo)** — Orc Bárbaro, nível 4, papel Capitão da guarda corrompida (4 indivíduos). Outrora guerreiros de um clã próximo, corrompidos pela influência do silêncio de Vhorn ao longo de anos, tornaram-se servos mudos e violentos. Olhos vazios, movimentos bruscos. *Encontros:* Encontro 1. *Localização:* Trilha Afundada. Atacam sem aviso, sem negociação — já não possuem vontade própria.
> (nenhuma — os orcs corrompidos não falam, apenas emitem um zumbido grave antes de atacar)

**Guardiões Ossos (inimigo, grupo)** — Esqueletos animados, nível 2, papel Guardiões antigos (6 indivíduos). Restos dos sacerdotes cultistas originais, reanimados pelo ritual de selamento como guardiões eternos. *Encontros:* Encontro 2. *Localização:* Salão dos Ecos Perdidos. Emergem das estátuas ao redor quando ativados, lutam até destruição total, sem fala.

**Sable Grimtongue (neutro)** — Humano Vigarista, nível 3, papel Comerciante suspeito. Encontrado acampado na Orla de Ashwyrne, alega vender "proteção contra a névoa" — na verdade, itens inúteis roubados de vítimas anteriores. Covarde, mas conhece rumores úteis se pressionado ou pago. *Encontros:* nenhum combate garantido — interação social opcional. *Localização:* Orla de Ashwyrne. Pode ser convencido (Intimidação ou pagamento) a revelar que viu "algo grande arrastando corpos pra dentro da terra" perto da trilha afundada, adiantando a localização do templo.
> "Prata primeiro, história depois. Não sou herói, sou vivo — quero continuar assim."

**Vhorn, o Silêncio Esquecido (antagonista final)** — Entidade menor, essência de deus aprisionado. Manifesta-se como mancha de escuridão que absorve som e luz ao redor, sussurra em múltiplas vozes sobrepostas — vítimas que consumiu ao longo dos séculos. Não deseja destruição, apenas ser ouvido de novo. Toque Silenciador: alvo fica incapaz de falar ou lançar magias verbais por 1 rodada (efeito de controle). Resistência a dano não-mágico. *Encontros:* Encontro Final. *Localização:* Câmara do Selo Quebrado. Tenta possuir um jogador no primeiro turno; se falhar, luta diretamente ou tenta corromper Fendrel pra interromper o ritual.
> "Vocês falam tanto... e ninguém, em mil anos, parou pra escutar. Fiquem. Escutem-me."
