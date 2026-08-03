import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import type { Locale, SystemConfig } from '@ai-dm/shared'
import { buildFreeClassFeatures, buildFreeClassSpells } from './free-catalog'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
})

// === Sistema Free — HERDA O SRD POR SELEÇÃO DE CHAVES (US-106) ===================================
// A US-47 congelou literais `free*` para o Free não herdar o SRD POR ACIDENTE (antes, ele
// referenciava os mesmos objetos do D&D). O acidente evitado virou política, e o preço apareceu na
// US-100: sem chave e sem base EN, a ficha do Free nunca acompanhava o idioma. A ADR 004 §3.1
// reviu a decisão 6 — o texto do que é SRD vem do artefato, a CURADORIA continua do Free
// (free-catalog.ts), e o que não é SRD tem entrada própria declarada.
//
// `attributes` e `skills` saíram daqui e passaram a vir do artefato: medido em 02/08/2026, os
// literais eram idênticos ao artefato pt-BR (6/6 e 18/18, mesmas chaves, rótulos e âncoras), então
// herdar é no-op em pt-BR e ganho puro em en-US. Regressão guardada em free-catalog.test.ts.
// Faixa 10–18, default 10 (point-buy 5e, US-26) segue no artefato, vinda do ingest.

// Nível 1: escolhe 2 proficientes, cada uma soma +2 ao modificador do atributo.
const dnd5eProficiency: SystemConfig['proficiency'] = { choices: 2, bonus: 2 }

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

// Features de classe de NÍVEL 1 (US-41) e magias por classe (US-42) do Free: a CURADORIA (quais
// entradas) e as entradas próprias vivem em free-catalog.ts; o TEXTO vem do artefato do locale
// (US-106). Awareness read-only: o mestre oferece/narra; usos/custo/efeito são outra camada.
// Classes cuja única feature de nível 1 depende de subclasse (Clérigo→domínio, Feiticeiro→origem,
// Bruxo→patrono) seguem de fora (YAGNI, sem escolha de subclasse na Fase 1): caem no default [] e
// o personagem fica sem features (sem crash, sem seção). O mesmo vale para não-conjurador em
// `classSpells`. A chave canônica de classe é a mesma do inventário (ver getClassFeatures).


// D&D 5e SRD: os campos SRD-derivados vêm do artefato (US-47); point-buy/proficiência/
// aventuras são decisão de produto e seguem no seed.
//
// US-51: `startingKits` MUDOU DE LADO — passou a ser derivado (opção A da tabela de traços da
// classe, no mesmo Open5e CC-BY). Enquanto era autoral ele vivia em dnd5eProductFields, o mesmo
// objeto nos dois locales, e o config en-US servia kit em português.
//
// Lido em runtime (fs), NÃO por `import` de JSON: o artefato mora em scripts/srd/, fora de
// apps/api. Um import o traria para o programa do tsc, o rootDir inferido viraria a raiz do repo
// e o emit sairia em dist/apps/api/src/main.js — quebrando `nest start` (que roda dist/main).
//
// US-99: são DOIS artefatos, um por locale. O mesmo caminho de leitura serve os dois.
// US-100: `retiredFeatures`/`retiredSpells` entram no Pick — é o que faz a ficha de quem tinha
// conteúdo retirado por um bump continuar resolvendo. Ausentes do arquivo enquanto nada foi
// aposentado (o ingest só os emite quando há o que transportar).
function readSrdArtifact(locale: string) {
  return JSON.parse(
    readFileSync(join(__dirname, `../../../scripts/srd/srd-5e.config.${locale}.json`), 'utf8'),
  ) as Pick<SystemConfig, 'attributes' | 'skills' | 'races' | 'classes' | 'classFeatures' | 'classSpells' | 'startingKits' | 'retiredFeatures' | 'retiredSpells'>
}

// Os campos de produto que SOBRARAM são os mesmos nos dois locales: point-buy, proficiência e
// ganchos de aventura seguem em PT (US-99 "Fora do escopo"; os ganchos são a US-101).
const dnd5eProductFields = {
  proficiency: dnd5eProficiency,
  pointBuy: { budget: 27 },
  initialAdventures: dnd5eInitialAdventures,
}
const dnd5eConfig: SystemConfig = { ...readSrdArtifact('en-US'), ...dnd5eProductFields }
const dnd5eConfigPtBr: SystemConfig = { ...readSrdArtifact('pt-BR'), ...dnd5eProductFields }

// US-106: o config do Free é o artefato do locale FILTRADO pela curadoria dele. `attributes`,
// `skills`, `races` e `classes` entram inteiros (o Free sempre ofereceu os mesmos); features e
// magias passam pela seleção de chaves + entradas próprias do free-catalog.ts. O `retired*` do
// artefato entra inteiro pelo `...srd` (US-100): é rede de LEITURA de ficha antiga, e filtrá-lo
// pela curadoria só apagaria o texto de quem já tem a chave gravada.
//
// A US-105 tinha dado ao Free os catálogos de raça e classe herdando o artefato **pt-BR** dentro
// da coluna da base EN — remendo consciente, porque o Free ainda não tinha `configLocales` e um
// catálogo EN deixaria os selects em inglês para todo mundo. Agora tem, e a herança é a normal.
function buildFreeConfig(locale: Locale): SystemConfig {
  const srd = readSrdArtifact(locale)
  return {
    ...srd,
    classFeatures: buildFreeClassFeatures(srd, locale),
    classSpells: buildFreeClassSpells(srd, locale),
    // Ganchos, point-buy e proficiência são decisão de PRODUTO, não regra de SRD (ADR 004,
    // decisões 4 e 6c). Seguem os do D&D.
    //
    // US-51: o kit NÃO está mais nesta lista — ele vem do `...srd` acima. A versão anterior
    // desta linha dizia que os kits do SRD eram OGL e por isso ficavam fora da fronteira CC;
    // eram, na fonte que a story previa (5e-database). O Open5e traz o mesmo dado sob CC-BY,
    // então o kit é conteúdo herdável como os outros (ADR 004 §3.1).
    ...dnd5eProductFields,
  }
}

const freeConfig = buildFreeConfig('en-US')
const freeConfigPtBr = buildFreeConfig('pt-BR')

async function main() {
  // Sistema "Free" — o AI DM narra livremente, sem seguir regras de um sistema oficial.
  // Ideal para quem quer jogar uma aventura sem se preocupar com mecânicas.
  //
  // US-99 dizia aqui que o Free era um snapshot PT sem base EN de onde sair, e por isso ficava
  // sem `configLocales` — a leitura caía no `?? config` e servia PT nos dois locales. A ADR 004
  // §3.1 tirou o motivo do lugar: o Free herda o artefato por chave, então a base EN existe.
  // `config` = en-US, `configLocales['pt-BR']` = a MESMA seleção em português, igual ao D&D.
  //
  // `version: '1.0'` descreve a CURADORIA, não o conteúdo (ADR 004, decisão 6g): um bump do
  // dataset muda o texto herdado sem mexer aqui. Quem audita procedência lê o `source` da
  // entrada e o NOTICE. `update` inclui version/name porque re-seed num row existente também
  // precisa sincronizar esses campos (senão um bump só valeria numa base nova, US-47).
  await prisma.system.upsert({
    where: { id: 'system-free' },
    update: { name: 'Free', version: '1.0', config: freeConfig, configLocales: { 'pt-BR': freeConfigPtBr } },
    create: {
      id: 'system-free',
      name: 'Free',
      version: '1.0',
      sourceType: 'FREE',
      config: freeConfig,
      configLocales: { 'pt-BR': freeConfigPtBr },
    },
  })

  // Sistema D&D 5e SRD — regras abertas do Dungeons & Dragons 5ª edição.
  // US-99: `config` é a base EN; o pt-BR vive em `configLocales` (ADR 005 D3).
  await prisma.system.upsert({
    where: { id: 'system-dnd5e' },
    update: { name: 'D&D 5e SRD', version: '5.2', config: dnd5eConfig, configLocales: { 'pt-BR': dnd5eConfigPtBr } },
    create: {
      id: 'system-dnd5e',
      name: 'D&D 5e SRD',
      version: '5.2',
      sourceType: 'SRD',
      config: dnd5eConfig,
      configLocales: { 'pt-BR': dnd5eConfigPtBr },
    },
  })

  console.log('Sistemas criados: Free, D&D 5e SRD')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
