import type { Locale, SystemConfig } from '@ai-dm/shared'

// `initialAdventures` é opcional no SystemConfig (nem todo sistema tem gancho); aqui não é —
// o mapa por locale só existe porque os dois existem, e o `NonNullable` poupa `?.` em quem lê.
type InitialAdventures = NonNullable<SystemConfig['initialAdventures']>

// Catálogo de aventuras iniciais por classe (US-28). classKey é a chave canônica da classe
// (EN desde a US-54), resolvida a partir do texto livre de Character.class pelo mesmo match
// tolerante do inventário (CLASS_SYNONYMS, ver resolveInitialHook); `default` cobre classes
// desconhecidas/custom. Os `id` seguem em PT: são identificadores de gancho, não de classe.
//
// US-101: saiu de dentro do seed.ts para cá quando ganhou a segunda coluna. Não é só tamanho
// (o seed dobraria) — o seed.ts chama `main()` no import, então nada que viva lá dentro pode
// ser afirmado por um teste. Mesmo arranjo do free-catalog.ts, que já mora aqui ao lado.
//
// O que atravessa os idiomas SEM mudar: `id`, `classKey` e `tags` (chaves, não texto — traduzir
// o `id` quebraria resolveInitialHook) e os nomes próprios inventados (Solane, Corvane), que são
// nomes e não palavras. Os 3 campos de texto são a versão inglesa da mesma cena, não tradução
// literal: mesma premissa, prosa escrita em inglês. A quest primária NÃO é um deles — vem do
// artefato de aventura gerado (US-153), não mais do hook fixo (US-155).

const dnd5eInitialAdventuresPtBr: InitialAdventures = {
  hooks: [
    {
      id: 'barbaro-ascensao-na-tribo', classKey: 'barbarian', title: 'A Ascensão na Tribo',
      pitch: 'Nascido e criado na tribo, {characterName} recebe a primeira prova que separa os guerreiros comuns dos que um dia lideram.',
      openingNarration: 'A fogueira central crepita no meio do acampamento, e os olhos da tribo estão em você. Você cresceu aqui, entre lanças e cantos de guerra, e hoje os anciãos pronunciam o seu nome, {characterName}, diante de todos — chegou a sua vez de provar do que é feito. O posto que você almeja não se pede: se conquista. E a primeira prova já espera para além da luz do fogo.',
      tags: ['tribo', 'fúria', 'ascensão'],
    },
    {
      id: 'bardo-baile-dos-feericos', classKey: 'bard', title: 'O Baile dos Feéricos',
      pitch: 'Um convite impossível de recusar leva {characterName} a uma corte feérica, onde uma chave cobiçada só se ganha vencendo os fey no seu próprio jogo de charme e astúcia.',
      openingNarration: 'A música chega antes do salão: harpas que tocam sozinhas, risadas que se afinam demais para serem humanas. Você atravessa um arco de flores que não existiam há um instante e entra no baile — os Eladrin viram-se para você com sorrisos bonitos e olhos que não prometem nada bom. Um deles ergue uma taça e uma chave brilha pendurada em seu pescoço, a mesma que abre o baú que você veio buscar. "Dance conosco, {characterName}", diz a voz, doce como mel e afiada como lâmina. "Mas cuidado com o que promete aqui." As regras deste lugar ninguém te explicou. Terá de descobri-las falando.',
      tags: ['feérico', 'charme', 'astúcia'],
    },
    {
      id: 'clerigo-deus-da-chama', classKey: 'cleric', title: 'O Deus da Chama Desapareceu',
      pitch: 'Nenhuma chama arde dentro da cidade, e os boatos dizem que o Deus da Chama morreu — cabe a {characterName}, servo dos deuses, descobrir a verdade antes que a escuridão a devore.',
      openingNarration: 'Você raspa o isqueiro pela terceira vez e nada — nem uma faísca pega. Ao seu redor, a cidade inteira sofre do mesmo mal: tochas apagadas, fornos frios, cozinhas mudas. Dentro destes muros, o fogo simplesmente se recusa a nascer, e nem a chama sagrada que você invocou mil vezes responde ao seu chamado. Nas ruas correm os mesmos sussurros: o Deus da Chama morreu. Mas do lado de fora dos portões, dizem, uma fogueira ainda arde normalmente — e essa única verdade contradiz tudo. Ao longe, algo grande e faminto se move na penumbra que já não se pode afastar com luz. Eles vieram até você, {characterName}: se alguém pode ler a vontade dos deuses neste silêncio, é você.',
      tags: ['fé', 'mistério', 'fogo'],
    },
    {
      id: 'druida-equilibrio-quebrado', classKey: 'druid', title: 'O Equilíbrio Rompido',
      pitch: 'As feras de uma mata selvagem se voltaram contra tudo, e {characterName} é chamado para descobrir o que quebrou o equilíbrio — e consertar isso, seja curando, seja caçando.',
      openingNarration: 'Tem algo errado nessa mata, e você percebe antes mesmo de ver. Os pássaros não param de gritar, um veado passa correndo por você com os olhos brancos de pavor, e no ar paira um cheiro que não é daqui. Você conhece essa terra, conhece o ritmo dela — e esse ritmo se quebrou. Os bichos que deveriam respeitar a mata agora rosnam na sua direção, dominados por um medo que não tem nada de natural. Seja lá o que entrou aqui, {characterName}, está escondido em algum lugar no meio das árvores. E a natureza está esperando pra ver o que você vai fazer.',
      tags: ['natureza', 'equilíbrio', 'investigação'],
    },
    {
      id: 'guerreiro-travessia-do-campo', classKey: 'fighter', title: 'A Travessia do Campo',
      pitch: 'Com um batalhão sob seu comando, {characterName} precisa cruzar um campo aberto tomado por monstros para alcançar a fortaleza do outro lado.',
      openingNarration: 'Você está parado na beira de um campo aberto, o capim alto ondulando até onde a vista alcança. Lá longe, recortada contra o céu, ergue-se a fortaleza — é até lá que você precisa levar seus soldados. No papel, é simples: uma linha reta de um lado ao outro. Só que o campo entre você e ela está infestado de monstros, e não há uma única árvore ou muro para se esconder no caminho. Atrás de você, o batalhão aguarda a ordem: cansados, assustados, mas seus. Não dá pra correr às cegas nem enfrentar tudo de peito aberto — cada avanço vai custar, e é você quem decide quem marcha na frente, quem cobre e quem sangra. A fortaleza não vai chegar mais perto sozinha, {characterName}. A ordem para avançar é sua.',
      tags: ['tática', 'comando', 'batalha'],
    },
    {
      id: 'monge-cacada-nos-telhados', classKey: 'monk', title: 'A Caçada nos Telhados',
      pitch: 'Um assassino comete o seu crime diante de {characterName} e foge pelos telhados da cidade — e só a agilidade de um monge é rápida o bastante para alcançá-lo.',
      openingNarration: 'A lâmina cintila, o alvo cai, e antes que o grito da multidão se forme o assassino já corre — rápido, rápido demais para um homem comum. Mas você não é comum, {characterName}. Ele salta para uma pilha de caixotes, alcança uma sacada e some por cima de um telhado, achando que a cidade o esconde. Ele não sabe com quem está lidando. Seu corpo já se move antes do pensamento: o beco, o muro, o salto. Lá em cima, entre as chaminés e a roupa estendida a secar, é onde essa caçada vai se decidir. Ele é veloz — mas você treinou a vida inteira para ser mais veloz ainda.',
      tags: ['perseguição', 'agilidade', 'urbano'],
    },
    {
      id: 'paladino-mal-oculto', classKey: 'paladin', title: 'O Mal Oculto',
      pitch: 'Um demônio capaz de assumir qualquer rosto se infiltrou numa vila, e cabe a {characterName} descobrir quem ele é antes que o seu plano se complete.',
      openingNarration: 'A vila parece tranquila demais para o que trouxe você até aqui. Foi avisado de que um demônio se esconde entre estas pessoas — não uma fera de garras à mostra, mas algo que veste o rosto de um vizinho, de um amigo, de qualquer um. Enquanto caminha pela praça, sua fé formiga na pele: em algum lugar por perto, sob pele humana, arde uma presença que não deveria existir. As pessoas sorriem, oferecem pão, trocam boas-vindas — e uma dessas faces é uma mentira. Você não sabe ainda qual, {characterName}. Mas sabe que, se demorar, o veneno que esse ser espalha vai cobrar a vila inteira. A caçada começa com uma conversa.',
      tags: ['investigação', 'sagrado', 'engano'],
    },
    {
      id: 'patrulheiro-coisas-do-ceu', classKey: 'ranger', title: 'Coisas Que Caem do Céu',
      pitch: 'Cinco cometas caíram na região selvagem, e um deles transformou uma aldeia goblin em algo novo e perigoso — cabe a {characterName} rastrear os fragmentos e conter o estrago.',
      openingNarration: 'Você viu o céu rasgar-se cinco vezes na semana passada — riscos de fogo caindo além das colinas, cada um num ponto diferente da mata que só você conhece de cor. Um deles caiu perto, e a floresta ao redor mudou: o cheiro está errado, as trilhas dos goblins agora seguem padrões cerrados demais para bichos que sempre viveram na desordem, e à noite se ouvem vozes falando juntas, como uma só. Na sua mão pesa o artefato que lhe confiaram — a única coisa capaz de conter o que caiu do céu. Para usá-lo, você vai ter que entrar bem no meio deles, {characterName}. E quando terminar, ainda restam quatro pontos no mapa onde o céu tocou o chão — e ninguém sabe o que despertou lá.',
      tags: ['exploração', 'rastro', 'ameaça'],
    },
    {
      id: 'ladino-gema-da-torre', classKey: 'rogue', title: 'A Lágrima de Solane',
      pitch: 'A Lágrima de Solane, a gema mais cobiçada da cidade, repousa no topo da torre trancada de Mestre Corvane — exatamente o tipo de impossível que {characterName} adora provar que é possível.',
      openingNarration: 'Lá está ela: uma agulha de pedra escura furando o céu, a torre de Mestre Corvane, o colecionador que nunca vende o que guarda. No último andar, atrás de vidro e de tudo o que o ouro pode comprar, brilha a Lágrima de Solane — a gema que você veio buscar. A entrada da frente tem os guardas de Corvane trocando de turno em intervalos que você já cronometrou. As janelas mais baixas escondem trincos, e cada degrau lá dentro pode esconder uma armadilha que separa os espertos dos mortos. Ninguém sobe essa torre pela força, {characterName} — sobe por quem sabe onde pisar, o que abrir e quando desaparecer. A noite é sua. A Lágrima, ainda não. Por enquanto.',
      tags: ['furto', 'infiltração', 'armadilha'],
    },
    {
      id: 'feiticeiro-farol-apagado', classKey: 'sorcerer', title: 'O Farol Apagado',
      pitch: 'O farol mais antigo da costa se apagou, seu guardião sumiu, e só alguém com magia no sangue como {characterName} pode reacender a luz antes que a tragédia chegue pelo mar.',
      openingNarration: 'A praia range de cacos sob suas botas — pedaços grandes de vidro grosso, do tipo que só se acha no alto de um farol. E é para o farol que você olha: o mais antigo desta costa, escuro pela primeira vez em gerações, o feixe morto no topo. Do faroleiro, nem sinal. Você sobe e encontra o pior: a redoma de vidro que cercava a luz está despedaçada por dentro, como se algo tivesse rompido para fora. A magia ainda formiga no ar, e o seu próprio sangue responde a ela — seja lá o que ardia aqui, era parente do que arde em você, {characterName}. Faltam três dias para um navio cheio de gente cruzar essas pedras, e no horizonte a tempestade já se junta. Sem essa luz, eles não vão ver o perigo a tempo.',
      tags: ['fogo', 'mistério', 'resgate'],
    },
    {
      id: 'bruxo-noite-no-arboreto', classKey: 'warlock', title: 'Noite no Arboreto',
      pitch: 'O patrono de {characterName} exige a Sangue-de-Lua, uma erva rara guardada num arboreto — mas sob a lua cheia, as plantas acordam com fome.',
      openingNarration: 'A fechadura cede fácil demais, como se o lugar quisesse te deixar entrar. Lá dentro, o arboreto se estende em fileiras de vasos e estufas de vidro, e o ar é doce, pesado, quase vivo. Em algum canto cresce a Sangue-de-Lua, a erva que o seu patrono cobra — a voz na sua cabeça não te deixa esquecer dela. Você avança entre os canteiros, e é então que a lua cheia sobe o bastante para derramar sua luz pelas claraboias. Onde o luar toca, as folhas estremecem. Gavinhas se desenrolam devagar na sua direção, flores se abrem como bocas, e algo no chão sob seus pés começa a se mover. Você não está sozinho aqui, {characterName} — e o jardim inteiro acabou de acordar com fome.',
      tags: ['pacto', 'furto', 'sobrenatural'],
    },
    {
      id: 'mago-preso-no-tomo', classKey: 'wizard', title: 'O Tomo Que Devora',
      pitch: 'Um livro que {characterName} nunca deveria ter aberto o puxa para dentro de um reino mágico, e só a inteligência vai encontrar a saída.',
      openingNarration: 'A última coisa que você lembra é ter aberto o livro. As letras começaram a se mexer na página, a tinta escorreu como se fosse água, e o mundo se enrolou para dentro dele. Quando você deu por si, estava de pé num lugar que não faz o menor sentido: escadas que sobem para os lados, um céu da cor de tinta velha, portas boiando no ar sem nenhuma parede em volta. Mas não é um sonho. O ar tem peso, o frio morde de verdade, e dá pra sentir que este lugar segue algum tipo de regra — estranha, mas real. Foi o tomo que te trouxe aqui, {characterName}, e alguma coisa te diz que é ele também que guarda a saída. Aqui, força não serve de nada. Só a sua cabeça vai te tirar desse lugar — desde que você descubra como ele funciona antes que ele acabe com você.',
      tags: ['arcano', 'enigma', 'sobrevivência'],
    },
    {
      id: 'default-primeiro-sinal', classKey: 'default', title: 'O Primeiro Sinal de {characterClass}',
      pitch: 'Algo no mundo reconhece a vocação de {characterName}.',
      openingNarration: 'Antes que a estrada decida o teu rumo, alguém pronuncia a tua vocação como se fosse uma chave: {characterClass}. E olha para ti, {characterName}, à espera do que farás com ela.',
      tags: ['origem', 'chamado'],
    },
  ],
}

const dnd5eInitialAdventuresEnUs: InitialAdventures = {
  hooks: [
    {
      id: 'barbaro-ascensao-na-tribo', classKey: 'barbarian', title: 'Rise Among the Tribe',
      pitch: 'Born and raised among the tents, {characterName} is handed the first trial that separates ordinary warriors from the ones who one day lead.',
      openingNarration: 'The great fire snaps in the middle of camp, and every eye in the tribe is on you. You grew up here, among spears and war-songs, and tonight the elders speak your name aloud, {characterName}, in front of all of them — your turn has come to show what you are made of. The rank you want is not asked for; it is taken. And the first trial is already waiting out past the firelight.',
      tags: ['tribo', 'fúria', 'ascensão'],
    },
    {
      id: 'bardo-baile-dos-feericos', classKey: 'bard', title: 'The Ball of the Fey',
      pitch: 'An invitation nobody refuses draws {characterName} into a fey court, where a coveted key is won only by beating the fey at their own game of charm and cunning.',
      openingNarration: 'The music reaches you before the hall does: harps that play themselves, laughter pitched a little too perfectly to be human. You step through an arch of flowers that was not there a moment ago, and the whole ball turns to look at you — the Eladrin, smiling beautifully, their eyes promising nothing good. One of them lifts a glass, and a key glints on a chain at their throat: the key to the chest you came for. "Dance with us, {characterName}," the voice says, sweet as honey and every bit as sticky. "But mind what you promise here." Nobody explained the rules of this place to you. You will have to learn them by talking.',
      tags: ['feérico', 'charme', 'astúcia'],
    },
    {
      id: 'clerigo-deus-da-chama', classKey: 'cleric', title: 'The God of Flame Is Gone',
      pitch: 'No flame will burn inside the city walls, and the rumor says the God of Flame is dead — it falls to {characterName}, servant of the gods, to find the truth before the dark eats the city.',
      openingNarration: 'You strike the tinderbox a third time and nothing — not one spark takes. All around you the city suffers the same illness: torches cold, ovens dead, kitchens silent. Inside these walls fire simply refuses to be born, and even the holy flame you have called a thousand times will not answer you. The same whisper runs the streets: the God of Flame is dead. Yet outside the gates, they say, a campfire still burns exactly as it always has — and that one fact contradicts everything. Off in the gloom that no light will push back, something big and hungry is moving. They came to you, {characterName}: if anyone can read the will of the gods in this silence, it is you.',
      tags: ['fé', 'mistério', 'fogo'],
    },
    {
      id: 'druida-equilibrio-quebrado', classKey: 'druid', title: 'The Broken Balance',
      pitch: 'The beasts of a wild wood have turned on everything, and {characterName} is called to find what broke the balance — and to set it right, by healing or by hunting.',
      openingNarration: 'Something is wrong in this wood, and you feel it before you see it. The birds will not stop screaming, a deer bolts past you with its eyes rolled white, and there is a smell in the air that does not belong here. You know this land, you know its rhythm — and the rhythm has broken. Animals that should give the wood its due now snarl in your direction, ridden by a fear with nothing natural in it. Whatever came in, {characterName}, it is hiding somewhere among the trees. And the wild is waiting to see what you do about it.',
      tags: ['natureza', 'equilíbrio', 'investigação'],
    },
    {
      id: 'guerreiro-travessia-do-campo', classKey: 'fighter', title: 'The Long Field',
      pitch: 'With a battalion under command, {characterName} has to cross an open field crawling with monsters to reach the fortress on the far side.',
      openingNarration: 'You stand at the edge of an open field, tall grass rolling as far as you can see. Far off, cut against the sky, stands the fortress — that is where your soldiers have to end up. On paper it is simple: a straight line from one side to the other. Except the ground between is infested with monsters, and there is not a single tree or wall to hide behind on the way. Behind you the battalion waits on your word: tired, frightened, and yours. You cannot run it blind and you cannot meet all of it head-on — every advance will cost, and you are the one who decides who marches first, who covers, and who bleeds. The fortress will not come any closer on its own, {characterName}. The order to move is yours.',
      tags: ['tática', 'comando', 'batalha'],
    },
    {
      id: 'monge-cacada-nos-telhados', classKey: 'monk', title: 'The Rooftop Chase',
      pitch: 'A killer strikes in plain sight of {characterName} and runs for the rooftops — and only a monk moves fast enough to catch him.',
      openingNarration: 'The blade flashes, the mark drops, and before the crowd can find its scream the killer is already running — fast, far too fast for an ordinary man. But you are not ordinary, {characterName}. He vaults a stack of crates, catches a balcony rail and disappears over a roofline, certain the city will swallow him. He has no idea what is coming after him. Your body moves before the thought does: the alley, the wall, the jump. Up there, among the chimneys and the washing hung out to dry, is where this gets settled. He is fast — but you have trained your whole life to be faster.',
      tags: ['perseguição', 'agilidade', 'urbano'],
    },
    {
      id: 'paladino-mal-oculto', classKey: 'paladin', title: 'The Hidden Evil',
      pitch: 'A demon that can wear any face has slipped into a village, and it falls to {characterName} to work out whose face it is before the plan is finished.',
      openingNarration: 'The village looks far too peaceful for what brought you here. You were warned that a demon hides among these people — not a beast with its claws out, but something wearing the face of a neighbor, a friend, anyone at all. As you cross the square your faith prickles under your skin: somewhere close by, under human skin, burns a presence that has no right to exist. People smile, offer bread, wish you well — and one of those faces is a lie. You do not know which one yet, {characterName}. But you know that if you take too long, whatever this thing is spreading will come due on the whole village. The hunt starts with a conversation.',
      tags: ['investigação', 'sagrado', 'engano'],
    },
    {
      id: 'patrulheiro-coisas-do-ceu', classKey: 'ranger', title: 'Things That Fall From the Sky',
      pitch: 'Five comets came down in the wild country, and one of them turned a goblin village into something new and dangerous — {characterName} has to track the fragments and contain the damage.',
      openingNarration: 'You watched the sky tear open five times last week — streaks of fire coming down beyond the hills, each one in a different corner of woodland you know by heart. One fell close, and the forest around it has changed: the smell is wrong, goblin trails now run in patterns far too tight for creatures that have always lived in disorder, and at night you hear voices speaking together, as one. The artifact they trusted you with sits heavy in your hand — the only thing that can hold whatever fell out of the sky. To use it you will have to walk right into the middle of them, {characterName}. And when that is done, four points on the map still mark where the sky touched the ground, and nobody knows what woke up there.',
      tags: ['exploração', 'rastro', 'ameaça'],
    },
    {
      id: 'ladino-gema-da-torre', classKey: 'rogue', title: 'Solane\'s Tear',
      pitch: 'Solane\'s Tear, the most coveted gem in the city, sits at the top of Master Corvane\'s locked tower — exactly the kind of impossible {characterName} loves to disprove.',
      openingNarration: 'There it is: a needle of dark stone punched into the sky, the tower of Master Corvane, the collector who never sells what he keeps. On the top floor, behind glass and everything else gold can buy, sits Solane\'s Tear — the gem you came for. The front door has Corvane\'s guards changing shift at intervals you have already timed. The lower windows hide latches, and every stair inside might hide the kind of trap that sorts the clever from the dead. Nobody takes this tower by force, {characterName} — it goes to whoever knows where to step, what to open, and when to vanish. The night is yours. The Tear is not. Not yet.',
      tags: ['furto', 'infiltração', 'armadilha'],
    },
    {
      id: 'feiticeiro-farol-apagado', classKey: 'sorcerer', title: 'The Lighthouse Gone Dark',
      pitch: 'The oldest lighthouse on the coast has gone dark and its keeper has vanished — only someone with magic in the blood like {characterName} can relight it before the sea brings disaster in.',
      openingNarration: 'The beach crunches under your boots — big pieces of thick glass, the kind you only find at the top of a lighthouse. And it is the lighthouse you are looking at: the oldest on this coast, dark for the first time in generations, the beam dead at its crown. Of the keeper there is no sign. You climb, and find worse: the glass housing that ringed the light is shattered outward, as though something broke its way free. Magic still prickles in the air, and your own blood answers it — whatever burned up here, {characterName}, was kin to what burns in you. Three days until a ship full of people passes these rocks, and the storm is already gathering on the horizon. Without that light, they will not see the danger in time.',
      tags: ['fogo', 'mistério', 'resgate'],
    },
    {
      id: 'bruxo-noite-no-arboreto', classKey: 'warlock', title: 'Night in the Arboretum',
      pitch: 'The patron of {characterName} demands Moonsblood, a rare herb kept in an arboretum — but under a full moon, the plants wake up hungry.',
      openingNarration: 'The lock gives far too easily, as though the place wants you inside. Beyond it the arboretum runs away in rows of pots and glass houses, and the air is sweet, heavy, very nearly alive. Somewhere in here the Moonsblood grows, the herb your patron is owed — the voice in your head will not let you forget it. You move between the beds, and that is when the full moon climbs high enough to pour through the skylights. Where the light lands, leaves shiver. Tendrils unroll slowly toward you, flowers open like mouths, and something under the floor begins to shift beneath your feet. You are not alone in here, {characterName} — the whole garden just woke up hungry.',
      tags: ['pacto', 'furto', 'sobrenatural'],
    },
    {
      id: 'mago-preso-no-tomo', classKey: 'wizard', title: 'The Tome That Devours',
      pitch: 'A book {characterName} should never have opened pulls its reader into a realm of its own, and only wit will find the way out.',
      openingNarration: 'The last thing you remember is opening the book. The letters started shifting on the page, the ink ran like water, and the world folded itself inside. When you came to, you were standing somewhere that makes no sense at all: stairs that climb sideways, a sky the color of old ink, doors floating with no walls around them. But it is not a dream. The air has weight, the cold bites for real, and you can feel that this place follows some kind of rule — a strange one, but a real one. The tome brought you here, {characterName}, and something tells you the tome is also where the way out is kept. Strength is worth nothing in this place. Only your head gets you out — provided you work out how it runs before it is done with you.',
      tags: ['arcano', 'enigma', 'sobrevivência'],
    },
    {
      id: 'default-primeiro-sinal', classKey: 'default', title: 'The First Sign of {characterClass}',
      pitch: 'Something in the world recognizes what {characterName} is.',
      openingNarration: 'Before the road decides anything for you, someone says your calling aloud like a key turning: {characterClass}. And then looks at you, {characterName}, waiting to see what you do with it.',
      tags: ['origem', 'chamado'],
    },
  ],
}

export const initialAdventuresByLocale: Record<Locale, InitialAdventures> = {
  'en-US': dnd5eInitialAdventuresEnUs,
  'pt-BR': dnd5eInitialAdventuresPtBr,
}
