import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import type { SystemConfig } from '@ai-dm/shared'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
})

// === Sistema Free — SNAPSHOT CONGELADO (US-47) ===================================================
// Antes, o Free REFERENCIAVA as mesmas constantes do D&D. Com o ingest passando a substituir os 4
// campos SRD-derivados no D&D, o Free ganha LITERAIS PRÓPRIAS (free*) desses campos para não herdar
// o SRD sem ninguém pedir. Os dois sistemas viram dados independentes de propósito. Ver US-47.
// Faixa 10–18, default 10: point-buy 5e (US-26). Valor inicial grátis (começa 27/27), gasta subindo.
const freeAttributes: SystemConfig['attributes'] = [
  { key: 'strength', label: 'Força', min: 10, max: 18, default: 10 },
  { key: 'dexterity', label: 'Destreza', min: 10, max: 18, default: 10 },
  { key: 'constitution', label: 'Constituição', min: 10, max: 18, default: 10 },
  { key: 'intelligence', label: 'Inteligência', min: 10, max: 18, default: 10 },
  { key: 'wisdom', label: 'Sabedoria', min: 10, max: 18, default: 10 },
  { key: 'charisma', label: 'Carisma', min: 10, max: 18, default: 10 },
]

// As 18 perícias 5e (US-27), cada uma ancorada num atributo. Snapshot do Free (o D&D agora vem do
// artefato). Constituição não ancora nenhuma. Fonte: https://www.wargamer.com/dnd/skills
const freeSkills: SystemConfig['skills'] = [
  { key: 'athletics', label: 'Atletismo', ability: 'strength' },
  { key: 'acrobatics', label: 'Acrobacia', ability: 'dexterity' },
  { key: 'sleight_of_hand', label: 'Prestidigitação', ability: 'dexterity' },
  { key: 'stealth', label: 'Furtividade', ability: 'dexterity' },
  { key: 'arcana', label: 'Arcanismo', ability: 'intelligence' },
  { key: 'history', label: 'História', ability: 'intelligence' },
  { key: 'investigation', label: 'Investigação', ability: 'intelligence' },
  { key: 'nature', label: 'Natureza', ability: 'intelligence' },
  { key: 'religion', label: 'Religião', ability: 'intelligence' },
  { key: 'animal_handling', label: 'Adestrar Animais', ability: 'wisdom' },
  { key: 'insight', label: 'Intuição', ability: 'wisdom' },
  { key: 'medicine', label: 'Medicina', ability: 'wisdom' },
  { key: 'perception', label: 'Percepção', ability: 'wisdom' },
  { key: 'survival', label: 'Sobrevivência', ability: 'wisdom' },
  { key: 'deception', label: 'Enganação', ability: 'charisma' },
  { key: 'intimidation', label: 'Intimidação', ability: 'charisma' },
  { key: 'performance', label: 'Atuação', ability: 'charisma' },
  { key: 'persuasion', label: 'Persuasão', ability: 'charisma' },
]

// Nível 1: escolhe 2 proficientes, cada uma soma +2 ao modificador do atributo.
const dnd5eProficiency: SystemConfig['proficiency'] = { choices: 2, bonus: 2 }

// Transportada de starting-inventory.ts (era a constante KITS hardcoded).
const dnd5eKits: SystemConfig['startingKits'] = {
  fighter: [
    { name: 'Espada longa', qty: 1 },
    { name: 'Escudo', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Mochila', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  wizard: [
    { name: 'Cajado arcano', qty: 1 },
    { name: 'Grimório', qty: 1 },
    { name: 'Vestes de mago', qty: 1 },
    { name: 'Poção de mana', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  // US-42: chave própria do Ranger (antes colapsava em 'arqueiro'); US-54: canônica em EN.
  // O match tolerante (CLASS_SYNONYMS) ainda cobre "arqueiro"/"caçador"/"patrulheiro".
  ranger: [
    { name: 'Arco longo', qty: 1 },
    { name: 'Aljava (20 flechas)', qty: 1 },
    { name: 'Adaga', qty: 1 },
    { name: 'Armadura de couro leve', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  rogue: [
    { name: 'Adaga', qty: 2 },
    { name: 'Ferramentas de ladrão', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Corda', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  cleric: [
    { name: 'Martelo', qty: 1 },
    { name: 'Símbolo sagrado', qty: 1 },
    { name: 'Armadura de malha', qty: 1 },
    { name: 'Kit de primeiros socorros', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  paladin: [
    { name: 'Espada longa', qty: 1 },
    { name: 'Escudo', qty: 1 },
    { name: 'Armadura de malha', qty: 1 },
    { name: 'Símbolo sagrado', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  barbarian: [
    { name: 'Machado grande', qty: 1 },
    { name: 'Pele de urso (armadura)', qty: 1 },
    { name: 'Adaga', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  druid: [
    { name: 'Cajado de carvalho', qty: 1 },
    { name: 'Símbolo druídico', qty: 1 },
    { name: 'Túnica de couro', qty: 1 },
    { name: 'Kit de ervas', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  bard: [
    { name: 'Espada curta', qty: 1 },
    { name: 'Instrumento musical', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  sorcerer: [
    { name: 'Cajado', qty: 1 },
    { name: 'Foco arcano (cristal)', qty: 1 },
    { name: 'Vestes ornamentadas', qty: 1 },
    { name: 'Poção de mana', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  // US-42: `bruxo` deixou de colapsar em `feiticeiro` (CLASS_SYNONYMS) e precisa de kit próprio,
  // senão cairia no `default` e regrediria o inventário inicial (US-28).
  warlock: [
    { name: 'Adaga', qty: 2 },
    { name: 'Foco arcano (talismã do pacto)', qty: 1 },
    { name: 'Grimório de invocações', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
  // Fallback: aventureiro genérico para classes fora da tabela. Nunca devolvemos inventário vazio.
  default: [
    { name: 'Adaga', qty: 1 },
    { name: 'Armadura de couro', qty: 1 },
    { name: 'Mochila', qty: 1 },
    { name: 'Cantil', qty: 1 },
  ],
}

// Catálogo de aventuras iniciais por classe (US-28). classKey é a chave canônica da classe
// (EN desde a US-54), resolvida a partir do texto livre de Character.class pelo mesmo match
// tolerante do inventário (CLASS_SYNONYMS, ver resolveInitialHook); `default` cobre classes
// desconhecidas/custom. Os `id` seguem em PT: são identificadores de gancho, não de classe.
const dnd5eInitialAdventures: SystemConfig['initialAdventures'] = {
  hooks: [
    {
      id: 'barbaro-ascensao-na-tribo', classKey: 'barbarian', title: 'A Ascensão na Tribo',
      pitch: 'Nascido e criado na tribo, {characterName} recebe a primeira prova que separa os guerreiros comuns dos que um dia lideram.',
      primaryQuestTitle: 'Provar o teu valor e subir de posto na tribo',
      primaryQuestDescription: 'Cumprir a prova que os anciãos impõem a {characterName} e conquistar o respeito que abre caminho até os postos mais altos da tribo — pela força, pela fúria e pelo nome que se ganha em combate.',
      openingNarration: 'A fogueira central crepita no meio do acampamento, e os olhos da tribo estão em você. Você cresceu aqui, entre lanças e cantos de guerra, e hoje os anciãos pronunciam o seu nome, {characterName}, diante de todos — chegou a sua vez de provar do que é feito. O posto que você almeja não se pede: se conquista. E a primeira prova já espera para além da luz do fogo.',
      tags: ['tribo', 'fúria', 'ascensão'],
    },
    {
      id: 'bardo-baile-dos-feericos', classKey: 'bard', title: 'O Baile dos Feéricos',
      pitch: 'Um convite impossível de recusar leva {characterName} a uma corte feérica, onde uma chave cobiçada só se ganha vencendo os fey no seu próprio jogo de charme e astúcia.',
      primaryQuestTitle: 'Conquistar a chave do baú na corte feérica',
      primaryQuestDescription: 'Navegar as regras estranhas e mutáveis de um baile feérico e arrancar dos Eladrin a chave de um baú — encantando, persuadindo ou enganando sem jamais cair nas armadilhas de palavra que eles adoram armar. A força não abre esta porta; só a lábia de {characterName}.',
      openingNarration: 'A música chega antes do salão: harpas que tocam sozinhas, risadas que se afinam demais para serem humanas. Você atravessa um arco de flores que não existiam há um instante e entra no baile — os Eladrin viram-se para você com sorrisos bonitos e olhos que não prometem nada bom. Um deles ergue uma taça e uma chave brilha pendurada em seu pescoço, a mesma que abre o baú que você veio buscar. "Dance conosco, {characterName}", diz a voz, doce como mel e afiada como lâmina. "Mas cuidado com o que promete aqui." As regras deste lugar ninguém te explicou. Terá de descobri-las falando.',
      tags: ['feérico', 'charme', 'astúcia'],
    },
    {
      id: 'clerigo-deus-da-chama', classKey: 'cleric', title: 'O Deus da Chama Desapareceu',
      pitch: 'Nenhuma chama arde dentro da cidade, e os boatos dizem que o Deus da Chama morreu — cabe a {characterName}, servo dos deuses, descobrir a verdade antes que a escuridão a devore.',
      primaryQuestTitle: 'Descobrir por que o fogo morreu na cidade',
      primaryQuestDescription: 'Investigar por que nenhuma chama — comum ou mágica — arde dentro dos muros, confirmar se o Deus da Chama de fato pereceu, e estancar a causa antes que os trolls e o crime tomem a cidade às escuras. A fé de {characterName} pode ser a última luz que resta.',
      openingNarration: 'Você raspa o isqueiro pela terceira vez e nada — nem uma faísca pega. Ao seu redor, a cidade inteira sofre do mesmo mal: tochas apagadas, fornos frios, cozinhas mudas. Dentro destes muros, o fogo simplesmente se recusa a nascer, e nem a chama sagrada que você invocou mil vezes responde ao seu chamado. Nas ruas correm os mesmos sussurros: o Deus da Chama morreu. Mas do lado de fora dos portões, dizem, uma fogueira ainda arde normalmente — e essa única verdade contradiz tudo. Ao longe, algo grande e faminto se move na penumbra que já não se pode afastar com luz. Eles vieram até você, {characterName}: se alguém pode ler a vontade dos deuses neste silêncio, é você.',
      tags: ['fé', 'mistério', 'fogo'],
    },
    {
      id: 'druida-equilibrio-quebrado', classKey: 'druid', title: 'O Equilíbrio Rompido',
      pitch: 'As feras de uma mata selvagem se voltaram contra tudo, e {characterName} é chamado para descobrir o que quebrou o equilíbrio — e consertar isso, seja curando, seja caçando.',
      primaryQuestTitle: 'Restaurar o equilíbrio da mata',
      primaryQuestDescription: 'Descobrir que invasão — uma monstruosidade, uma aberração ou uma praga — jogou as feras na loucura, e decidir como {characterName} traz a ordem de volta: acalmando e curando os bichos enlouquecidos, ou caçando e destruindo aquilo que os corrompeu.',
      openingNarration: 'Tem algo errado nessa mata, e você percebe antes mesmo de ver. Os pássaros não param de gritar, um veado passa correndo por você com os olhos brancos de pavor, e no ar paira um cheiro que não é daqui. Você conhece essa terra, conhece o ritmo dela — e esse ritmo se quebrou. Os bichos que deveriam respeitar a mata agora rosnam na sua direção, dominados por um medo que não tem nada de natural. Seja lá o que entrou aqui, {characterName}, está escondido em algum lugar no meio das árvores. E a natureza está esperando pra ver o que você vai fazer.',
      tags: ['natureza', 'equilíbrio', 'investigação'],
    },
    {
      id: 'guerreiro-travessia-do-campo', classKey: 'fighter', title: 'A Travessia do Campo',
      pitch: 'Com um batalhão sob seu comando, {characterName} precisa cruzar um campo aberto tomado por monstros para alcançar a fortaleza do outro lado.',
      primaryQuestTitle: 'Levar o batalhão vivo até a fortaleza do outro lado',
      primaryQuestDescription: 'Atravessar um campo aberto infestado de monstros, comandando um batalhão, para chegar à fortaleza na outra margem. {characterName} precisa posicionar os soldados, escolher quando lutar e quando avançar, e chegar ao objetivo com o máximo de gente viva.',
      openingNarration: 'Você está parado na beira de um campo aberto, o capim alto ondulando até onde a vista alcança. Lá longe, recortada contra o céu, ergue-se a fortaleza — é até lá que você precisa levar seus soldados. No papel, é simples: uma linha reta de um lado ao outro. Só que o campo entre você e ela está infestado de monstros, e não há uma única árvore ou muro para se esconder no caminho. Atrás de você, o batalhão aguarda a ordem: cansados, assustados, mas seus. Não dá pra correr às cegas nem enfrentar tudo de peito aberto — cada avanço vai custar, e é você quem decide quem marcha na frente, quem cobre e quem sangra. A fortaleza não vai chegar mais perto sozinha, {characterName}. A ordem para avançar é sua.',
      tags: ['tática', 'comando', 'batalha'],
    },
    {
      id: 'monge-cacada-nos-telhados', classKey: 'monk', title: 'A Caçada nos Telhados',
      pitch: 'Um assassino comete o seu crime diante de {characterName} e foge pelos telhados da cidade — e só a agilidade de um monge é rápida o bastante para alcançá-lo.',
      primaryQuestTitle: 'Alcançar o assassino e detê-lo antes que escape',
      primaryQuestDescription: 'Perseguir um assassino veloz pelos becos, muros e telhados da cidade, sem perdê-lo de vista, e derrotá-lo junto dos seus capangas quando ele for encurralado. A agilidade de {characterName} é a única coisa capaz de vencer a dele.',
      openingNarration: 'A lâmina cintila, o alvo cai, e antes que o grito da multidão se forme o assassino já corre — rápido, rápido demais para um homem comum. Mas você não é comum, {characterName}. Ele salta para uma pilha de caixotes, alcança uma sacada e some por cima de um telhado, achando que a cidade o esconde. Ele não sabe com quem está lidando. Seu corpo já se move antes do pensamento: o beco, o muro, o salto. Lá em cima, entre as chaminés e a roupa estendida a secar, é onde essa caçada vai se decidir. Ele é veloz — mas você treinou a vida inteira para ser mais veloz ainda.',
      tags: ['perseguição', 'agilidade', 'urbano'],
    },
    {
      id: 'paladino-mal-oculto', classKey: 'paladin', title: 'O Mal Oculto',
      pitch: 'Um demônio capaz de assumir qualquer rosto se infiltrou numa vila, e cabe a {characterName} descobrir quem ele é antes que o seu plano se complete.',
      primaryQuestTitle: 'Desmascarar o demônio metamorfo e frustrar o seu plano',
      primaryQuestDescription: 'Investigar uma vila onde um demônio metamorfo se esconde sob rosto humano, usando conversa, intuição e o dom divino de {characterName} para revelá-lo — e então detê-lo, desfazendo o mal que ele espalha, seja comida envenenada, doença ou pior.',
      openingNarration: 'A vila parece tranquila demais para o que trouxe você até aqui. Foi avisado de que um demônio se esconde entre estas pessoas — não uma fera de garras à mostra, mas algo que veste o rosto de um vizinho, de um amigo, de qualquer um. Enquanto caminha pela praça, sua fé formiga na pele: em algum lugar por perto, sob pele humana, arde uma presença que não deveria existir. As pessoas sorriem, oferecem pão, trocam boas-vindas — e uma dessas faces é uma mentira. Você não sabe ainda qual, {characterName}. Mas sabe que, se demorar, o veneno que esse ser espalha vai cobrar a vila inteira. A caçada começa com uma conversa.',
      tags: ['investigação', 'sagrado', 'engano'],
    },
    {
      id: 'patrulheiro-coisas-do-ceu', classKey: 'ranger', title: 'Coisas Que Caem do Céu',
      pitch: 'Cinco cometas caíram na região selvagem, e um deles transformou uma aldeia goblin em algo novo e perigoso — cabe a {characterName} rastrear os fragmentos e conter o estrago.',
      primaryQuestTitle: 'Conter o fragmento na aldeia goblin e rastrear os outros cometas',
      primaryQuestDescription: 'Entrar na aldeia goblin mutada pelo cometa — onde os goblins agora dominam o fogo, pensam como um só e cresceram além do natural — e usar o artefato que {characterName} recebeu para conter o fragmento. Depois, descobrir onde caíram os outros quatro pedaços e o que eles despertaram.',
      openingNarration: 'Você viu o céu rasgar-se cinco vezes na semana passada — riscos de fogo caindo além das colinas, cada um num ponto diferente da mata que só você conhece de cor. Um deles caiu perto, e a floresta ao redor mudou: o cheiro está errado, as trilhas dos goblins agora seguem padrões cerrados demais para bichos que sempre viveram na desordem, e à noite se ouvem vozes falando juntas, como uma só. Na sua mão pesa o artefato que lhe confiaram — a única coisa capaz de conter o que caiu do céu. Para usá-lo, você vai ter que entrar bem no meio deles, {characterName}. E quando terminar, ainda restam quatro pontos no mapa onde o céu tocou o chão — e ninguém sabe o que despertou lá.',
      tags: ['exploração', 'rastro', 'ameaça'],
    },
    {
      id: 'ladino-gema-da-torre', classKey: 'rogue', title: 'A Lágrima de Solane',
      pitch: 'A Lágrima de Solane, a gema mais cobiçada da cidade, repousa no topo da torre trancada de Mestre Corvane — exatamente o tipo de impossível que {characterName} adora provar que é possível.',
      primaryQuestTitle: 'Roubar a Lágrima de Solane do topo da torre de Corvane',
      primaryQuestDescription: 'Subir a torre de Mestre Corvane, o colecionador, defendida por armadilhas, fechaduras e a sua guarda pessoal, até a câmara no topo, pegar a gema chamada Lágrima de Solane e sair inteiro. {characterName} pode escalar, arrombar, enganar ou se esgueirar — desde que ninguém perceba até ser tarde demais.',
      openingNarration: 'Lá está ela: uma agulha de pedra escura furando o céu, a torre de Mestre Corvane, o colecionador que nunca vende o que guarda. No último andar, atrás de vidro e de tudo o que o ouro pode comprar, brilha a Lágrima de Solane — a gema que você veio buscar. A entrada da frente tem os guardas de Corvane trocando de turno em intervalos que você já cronometrou. As janelas mais baixas escondem trincos, e cada degrau lá dentro pode esconder uma armadilha que separa os espertos dos mortos. Ninguém sobe essa torre pela força, {characterName} — sobe por quem sabe onde pisar, o que abrir e quando desaparecer. A noite é sua. A Lágrima, ainda não. Por enquanto.',
      tags: ['furto', 'infiltração', 'armadilha'],
    },
    {
      id: 'feiticeiro-farol-apagado', classKey: 'sorcerer', title: 'O Farol Apagado',
      pitch: 'O farol mais antigo da costa se apagou, seu guardião sumiu, e só alguém com magia no sangue como {characterName} pode reacender a luz antes que a tragédia chegue pelo mar.',
      primaryQuestTitle: 'Reacender o farol antes do navio e da tempestade',
      primaryQuestDescription: 'Descobrir o que apagou o farol — um pequeno elemental de fogo que estava preso no feixe e agora anda solto — e recapturá-lo, ou achar outra fonte de luz forte o bastante, antes que um navio de passageiros cruze a costa em três dias, bem quando a tempestade chega. O poder de {characterName} pode ser a única chama à altura.',
      openingNarration: 'A praia range de cacos sob suas botas — pedaços grandes de vidro grosso, do tipo que só se acha no alto de um farol. E é para o farol que você olha: o mais antigo desta costa, escuro pela primeira vez em gerações, o feixe morto no topo. Do faroleiro, nem sinal. Você sobe e encontra o pior: a redoma de vidro que cercava a luz está despedaçada por dentro, como se algo tivesse rompido para fora. A magia ainda formiga no ar, e o seu próprio sangue responde a ela — seja lá o que ardia aqui, era parente do que arde em você, {characterName}. Faltam três dias para um navio cheio de gente cruzar essas pedras, e no horizonte a tempestade já se junta. Sem essa luz, eles não vão ver o perigo a tempo.',
      tags: ['fogo', 'mistério', 'resgate'],
    },
    {
      id: 'bruxo-noite-no-arboreto', classKey: 'warlock', title: 'Noite no Arboreto',
      pitch: 'O patrono de {characterName} exige a Sangue-de-Lua, uma erva rara guardada num arboreto — mas sob a lua cheia, as plantas acordam com fome.',
      primaryQuestTitle: 'Roubar a Sangue-de-Lua do arboreto e sair vivo',
      primaryQuestDescription: 'Entrar no arboreto à noite para "adquirir" a Sangue-de-Lua, a erva rara que o patrono de {characterName} cobra, e escapar quando o luar da lua cheia desperta as plantas — agora vivas e famintas — que se erguem para impedir o roubo.',
      openingNarration: 'A fechadura cede fácil demais, como se o lugar quisesse te deixar entrar. Lá dentro, o arboreto se estende em fileiras de vasos e estufas de vidro, e o ar é doce, pesado, quase vivo. Em algum canto cresce a Sangue-de-Lua, a erva que o seu patrono cobra — a voz na sua cabeça não te deixa esquecer dela. Você avança entre os canteiros, e é então que a lua cheia sobe o bastante para derramar sua luz pelas claraboias. Onde o luar toca, as folhas estremecem. Gavinhas se desenrolam devagar na sua direção, flores se abrem como bocas, e algo no chão sob seus pés começa a se mover. Você não está sozinho aqui, {characterName} — e o jardim inteiro acabou de acordar com fome.',
      tags: ['pacto', 'furto', 'sobrenatural'],
    },
    {
      id: 'mago-preso-no-tomo', classKey: 'wizard', title: 'O Tomo Que Devora',
      pitch: 'Um livro que {characterName} nunca deveria ter aberto o puxa para dentro de um reino mágico, e só a inteligência vai encontrar a saída.',
      primaryQuestTitle: 'Entender o reino do tomo e escapar dele',
      primaryQuestDescription: 'Sobreviver a um reino mágico com regras próprias, onde pensar rápido vale mais que lutar, e descobrir como {characterName} desfaz a magia que o prendeu para voltar ao mundo real antes que o lugar o consuma.',
      openingNarration: 'A última coisa que você lembra é ter aberto o livro. As letras começaram a se mexer na página, a tinta escorreu como se fosse água, e o mundo se enrolou para dentro dele. Quando você deu por si, estava de pé num lugar que não faz o menor sentido: escadas que sobem para os lados, um céu da cor de tinta velha, portas boiando no ar sem nenhuma parede em volta. Mas não é um sonho. O ar tem peso, o frio morde de verdade, e dá pra sentir que este lugar segue algum tipo de regra — estranha, mas real. Foi o tomo que te trouxe aqui, {characterName}, e alguma coisa te diz que é ele também que guarda a saída. Aqui, força não serve de nada. Só a sua cabeça vai te tirar desse lugar — desde que você descubra como ele funciona antes que ele acabe com você.',
      tags: ['arcano', 'enigma', 'sobrevivência'],
    },
    {
      id: 'default-primeiro-sinal', classKey: 'default', title: 'O Primeiro Sinal de {characterClass}',
      pitch: 'Algo no mundo reconhece a vocação de {characterName}.',
      primaryQuestTitle: 'Descobrir por que a tua vocação foi reconhecida',
      primaryQuestDescription: 'Investigar o chamado inicial sem presumir regras específicas da tua classe.',
      openingNarration: 'Antes que a estrada decida o teu rumo, alguém pronuncia a tua vocação como se fosse uma chave: {characterClass}. E olha para ti, {characterName}, à espera do que farás com ela.',
      tags: ['origem', 'chamado'],
    },
  ],
}

// Features de classe de NÍVEL 1 (US-41), D&D 5e SRD. Awareness read-only: o mestre
// oferece/narra; usos/custo/efeito são outra camada. Keyed pela chave canônica de
// classe (mesmo match tolerante do inventário, ver getClassFeatures). Exclui
// Conjuração/magias (US-42) e proficiências/perícias (US-27). Classes cuja única
// feature de nível 1 depende de subclasse (Clérigo→domínio, Feiticeiro→origem,
// Bruxo→patrono) ficam de fora por ora (YAGNI, sem escolha de subclasse na Fase 1):
// caem no default [] e o personagem fica sem features (sem crash, sem seção).
const freeClassFeatures: SystemConfig['classFeatures'] = {
  barbarian: [
    { name: 'Fúria', description: 'Entra em fúria, ganhando ímpeto e resistência no combate.' },
    { name: 'Defesa sem Armadura', description: 'Protege-se sem armadura usando o próprio vigor.' },
  ],
  bard: [
    { name: 'Inspiração de Bardo', description: 'Inspira um aliado, dando-lhe um impulso extra numa ação.' },
  ],
  fighter: [
    { name: 'Estilo de Luta', description: 'Domina uma técnica marcial que o torna mais eficaz.' },
    { name: 'Retomar o Fôlego', description: 'Recupera vigor no meio da batalha por um instante.' },
  ],
  monk: [
    { name: 'Defesa sem Armadura', description: 'Protege-se sem armadura pela sua serenidade e treino.' },
    { name: 'Artes Marciais', description: 'Luta desarmado com golpes rápidos e precisos.' },
  ],
  paladin: [
    { name: 'Sentido Divino', description: 'Sente presenças de bem/mal e mortos-vivos por perto.' },
    { name: 'Impor as Mãos', description: 'Cura ferimentos tocando o alvo com energia divina.' },
  ],
  // US-42: chave própria do Ranger, junto do kit (CLASS_SYNONYMS deixou de colapsar
  // Ranger→arqueiro). Sem ela, o Patrulheiro perderia estas features no `default`.
  ranger: [
    { name: 'Inimigo Favorito', description: 'Conhece a fundo um tipo de criatura e como caçá-la.' },
    { name: 'Explorador Nato', description: 'Move-se e sobrevive com maestria no seu terreno.' },
  ],
  rogue: [
    { name: 'Especialização', description: 'É excepcionalmente bom em certas perícias.' },
    { name: 'Ataque Furtivo', description: 'Golpe extra devastador quando pega o alvo desprevenido.' },
    { name: 'Gíria de Ladrão', description: 'Comunica-se em código secreto do submundo.' },
  ],
  druid: [
    { name: 'Druídico', description: 'Conhece a língua secreta dos druidas e as suas mensagens ocultas.' },
  ],
  wizard: [
    { name: 'Recuperação Arcana', description: 'Recupera parte da energia mágica ao descansar brevemente.' },
  ],
  // Clérigo, Feiticeiro e Bruxo: única feature de nível 1 depende de subclasse → sem entrada (caem no default []).
  default: [],
}

// Magias conhecidas por classe (US-42). Awareness read-only: o nome vai ao prompt (o
// mestre OFERECE), a descrição volta sob demanda pela tool getSpell. Sem slots/preparação.
// Recorte: TODOS os truques (nível 0) da lista da classe; Paladino/Patrulheiro (sem
// truques) recebem 2 magias de nível 1 fixas (exceção). Não-conjuradores → default [].
//
// Seleção (quais truques por classe): wiki 2024 — dnd2024.wikidot.com/spell:all (aba Cantrip).
// Título EN + descrição: D&D Beyond Basic Rules 2014, destilada numa linha em PT-BR.
// `†` = ausente nas Basic Rules 2014 (título/descrição do wiki 2024, a verificar antes de congelar).
// Feiticeiro e Bruxo têm listas DISTINTAS (não colapsam mais — ver CLASS_SYNONYMS).
// `classes[]` usa a chave canônica de classe (EN desde a US-54), não o nome exibido.
const CANTRIP_CATALOG: { name: string; classes: string[]; description: string }[] = [
  { name: 'Amizade', classes: ['wizard', 'bard', 'sorcerer', 'warlock'], description: 'por um instante influencia alguém com mais facilidade (que depois nota o encanto).' }, // †
  { name: 'Ataque Certeiro', classes: ['wizard', 'bard', 'sorcerer', 'warlock'], description: 'guia o próximo golpe, tornando-o mais preciso.' },
  { name: 'Bordão Druídico', classes: ['druid'], description: 'imbui um bordão com a força da natureza, tornando-o arma mágica.' },
  { name: 'Borrifo Venenoso', classes: ['wizard', 'druid', 'sorcerer', 'warlock'], description: 'um sopro de gás tóxico atinge um alvo próximo.' },
  { name: 'Chama Sagrada', classes: ['cleric'], description: 'luz sagrada desce sobre o alvo, ignorando cobertura.' },
  { name: 'Chicote de Espinhos', classes: ['druid'], description: 'um chicote de espinhos fere e puxa o alvo para perto.' }, // †
  { name: 'Consertar', classes: ['wizard', 'cleric', 'druid', 'bard', 'sorcerer'], description: 'repara uma pequena quebra ou rasgo num objeto.' },
  { name: 'Dobre dos Mortos', classes: ['wizard', 'cleric', 'warlock'], description: 'um dobre fúnebre soa e fere a mente ou a carne do alvo.' }, // †
  { name: 'Elementalismo', classes: ['wizard', 'druid', 'sorcerer'], description: 'manipula um punhado dos elementos: faísca, brisa, respingo, poeira.' }, // †
  { name: 'Estabilizar', classes: ['cleric', 'druid'], description: 'um toque estabiliza uma criatura caída a 0 de vida.' },
  { name: 'Estilhaço Mental', classes: ['wizard', 'sorcerer', 'warlock'], description: 'lasca psíquica fere a mente e atrapalha o próximo salvamento do alvo.' }, // †
  { name: 'Estrondo', classes: ['wizard', 'druid', 'bard', 'sorcerer', 'warlock'], description: 'uma onda de trovão explode ao redor, atingindo todos por perto.' }, // †
  { name: 'Explosão Feiticeira', classes: ['sorcerer'], description: 'um estouro de energia mágica bruta atinge um alvo.' }, // †
  { name: 'Fagulha Estelar', classes: ['druid', 'bard'], description: 'um lampejo de luz estelar fere e destaca o alvo.' }, // †
  { name: 'Guarda de Lâmina', classes: ['wizard', 'bard', 'sorcerer', 'warlock'], description: 'energia defensiva reduz por um instante o dano de golpes físicos.' }, // †
  { name: 'Ilusão Menor', classes: ['wizard', 'bard', 'sorcerer', 'warlock'], description: 'cria um som ou uma pequena imagem ilusória.' },
  { name: 'Jato de Ácido', classes: ['wizard', 'sorcerer'], description: 'arremessa uma bolha de ácido que corrói um ou dois alvos próximos.' },
  { name: 'Luz', classes: ['wizard', 'cleric', 'bard', 'sorcerer'], description: 'faz um objeto brilhar como uma tocha.' },
  { name: 'Luzes Dançantes', classes: ['wizard', 'bard', 'sorcerer'], description: 'cria pequenas luzes flutuantes que controla à distância.' },
  { name: 'Mensagem', classes: ['wizard', 'druid', 'bard', 'sorcerer'], description: 'sussurra uma mensagem que só o alvo distante ouve, e ele pode responder.' },
  { name: 'Mão Mágica', classes: ['wizard', 'bard', 'sorcerer', 'warlock'], description: 'mão espectral flutuante manipula objetos leves à distância.' },
  { name: 'Orientação', classes: ['cleric', 'druid'], description: 'um toque divino dá um impulso extra ao próximo teste do aliado.' },
  { name: 'Palavra Radiante', classes: ['cleric'], description: 'uma palavra sagrada faz luz ofuscante ferir os inimigos ao redor.' }, // †
  { name: 'Prestidigitação', classes: ['wizard', 'bard', 'sorcerer', 'warlock'], description: 'pequenos truques mágicos: limpar, sujar, aromatizar, faíscas inofensivas.' },
  { name: 'Produzir Chama', classes: ['druid'], description: 'uma chama na palma ilumina ou é arremessada num alvo.' },
  { name: 'Raio de Fogo', classes: ['wizard', 'sorcerer'], description: 'lança um dardo de fogo que incendeia alvo ou objeto.' },
  { name: 'Raio de Gelo', classes: ['wizard', 'sorcerer'], description: 'um feixe gélido fere e reduz a velocidade do alvo.' },
  { name: 'Rajada Mística', classes: ['warlock'], description: 'feixe de energia crepitante dispara contra um alvo.' },
  { name: 'Resistência', classes: ['cleric', 'druid'], description: 'um toque divino dá um impulso extra ao próximo salvamento do aliado.' },
  { name: 'Taumaturgia', classes: ['cleric'], description: 'manifesta um pequeno prodígio divino: voz trovejante, chamas trêmulas, portas que batem.' },
  { name: 'Toque Chocante', classes: ['wizard', 'sorcerer'], description: 'descarga elétrica salta da mão e impede a reação do alvo.' },
  { name: 'Toque Gélido', classes: ['wizard', 'sorcerer', 'warlock'], description: 'mão esquelética fantasmagórica queima o alvo e o impede de se curar.' },
  { name: 'Truque Druídico', classes: ['druid'], description: 'pequenos sinais da natureza: prever o tempo, abrir uma flor, acender uma chama.' },
  { name: 'Zombaria Cruel', classes: ['bard'], description: 'insultos encantados ferem a mente e atrapalham o alvo.' },
]

// Classes conjuradoras COM truques: a lista materializa-se filtrando o catálogo por classe.
const CANTRIP_CLASSES = ['wizard', 'cleric', 'druid', 'bard', 'sorcerer', 'warlock'] as const

const freeClassSpells: SystemConfig['classSpells'] = {
  ...Object.fromEntries(
    CANTRIP_CLASSES.map((cls) => [
      cls,
      CANTRIP_CATALOG
        .filter((s) => s.classes.includes(cls))
        .map((s) => ({ name: s.name, level: 0, description: s.description })),
    ]),
  ),
  // Exceção (US-42): Paladino e Patrulheiro não têm truques → 2 magias de nível 1 fixas.
  paladin: [
    { name: 'Curar Ferimentos', level: 1, description: 'restaura vitalidade a uma criatura pelo toque.' },
    { name: 'Abençoar', level: 1, description: 'até três aliados ganham um impulso em ataques e salvamentos.' },
  ],
  ranger: [
    { name: 'Marca do Caçador', level: 1, description: 'marca uma presa, somando dano a cada golpe e facilitando rastreá-la.' }, // †
    { name: 'Curar Ferimentos', level: 1, description: 'restaura vitalidade a uma criatura pelo toque.' },
  ],
  // Não-conjuradores (guerreiro, bárbaro, monge, ladino) e classes custom → sem magias.
  default: [],
}

// Free: literais próprias (congeladas). NÃO referencia mais nada que o ingest substitui no D&D.
const freeConfig: SystemConfig = {
  attributes: freeAttributes,
  skills: freeSkills,
  proficiency: dnd5eProficiency,
  startingKits: dnd5eKits,
  classFeatures: freeClassFeatures,
  classSpells: freeClassSpells,
  pointBuy: { budget: 27 },
  initialAdventures: dnd5eInitialAdventures,
}

// D&D 5e SRD: os 4 campos SRD-derivados vêm do artefato (US-47); kits/point-buy/proficiência/
// aventuras são decisão de produto e seguem no seed. startingKits fica manual até a US-51.
//
// Lido em runtime (fs), NÃO por `import` de JSON: o artefato mora em scripts/srd/, fora de
// apps/api. Um import o traria para o programa do tsc, o rootDir inferido viraria a raiz do repo
// e o emit sairia em dist/apps/api/src/main.js — quebrando `nest start` (que roda dist/main).
const srd = JSON.parse(
  readFileSync(join(__dirname, '../../../scripts/srd/srd-5e.config.json'), 'utf8'),
) as Pick<SystemConfig, 'attributes' | 'skills' | 'classFeatures' | 'classSpells'>
const dnd5eConfig: SystemConfig = {
  ...srd,
  proficiency: dnd5eProficiency,
  startingKits: dnd5eKits,
  pointBuy: { budget: 27 },
  initialAdventures: dnd5eInitialAdventures,
}

async function main() {
  // Sistema "Free" — o AI DM narra livremente, sem seguir regras de um sistema oficial.
  // Ideal para quem quer jogar uma aventura sem se preocupar com mecânicas.
  await prisma.system.upsert({
    where: { id: 'system-free' },
    // update inclui version/name: re-seed num row existente também sincroniza esses campos
    // (senão um bump de version só valeria numa base nova). Ver US-47.
    update: { name: 'Free', version: '1.0', config: freeConfig },
    create: {
      id: 'system-free',
      name: 'Free',
      version: '1.0',
      sourceType: 'FREE',
      config: freeConfig,
    },
  })

  // Sistema D&D 5e SRD — regras abertas do Dungeons & Dragons 5ª edição.
  await prisma.system.upsert({
    where: { id: 'system-dnd5e' },
    update: { name: 'D&D 5e SRD', version: '5.2', config: dnd5eConfig },
    create: {
      id: 'system-dnd5e',
      name: 'D&D 5e SRD',
      version: '5.2',
      sourceType: 'SRD',
      config: dnd5eConfig,
    },
  })

  console.log('Sistemas criados: Free, D&D 5e SRD')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
