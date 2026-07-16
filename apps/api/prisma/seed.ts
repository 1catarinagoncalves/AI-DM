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
      id: 'barbaro-furia-antiga', classKey: 'barbarian', title: 'O Chamado da Fúria Antiga',
      pitch: 'Um sinal ancestral desperta e exige que {characterName} prove o que sua fúria significa.',
      primaryQuestTitle: 'Descobrir a origem do chamado ancestral',
      primaryQuestDescription: 'Seguir o sinal do clã e decidir se a fúria de {characterName} é maldição ou proteção.',
      openingNarration: 'O chão treme baixo, como um coração antigo. Uma marca do teu clã arde na tua pele e algo além das colinas responde ao teu nome, {characterName}.',
      tags: ['fúria', 'ancestral', 'origem'],
    },
    {
      id: 'bardo-cancao-proibida', classKey: 'bard', title: 'A Canção Que Ninguém Devia Ouvir',
      pitch: 'Uma apresentação de {characterName} revela uma verdade escondida.',
      primaryQuestTitle: 'Desvendar o segredo por trás da canção',
      primaryQuestDescription: 'Descobrir a verdade que a canção revelou antes que fama e perigo cobrem seu preço.',
      openingNarration: 'A última nota ainda flutua no ar quando percebes o silêncio errado da plateia. Alguém ouviu o que não devia — e agora olha para ti, {characterName}.',
      tags: ['segredo', 'música', 'perigo'],
    },
    {
      id: 'clerigo-reliquia-sem-voz', classKey: 'cleric', title: 'A Relíquia Sem Voz',
      pitch: 'Um símbolo sagrado cala-se ou chama por {characterName}.',
      primaryQuestTitle: 'Investigar o silêncio da relíquia',
      primaryQuestDescription: 'Descobrir por que a relíquia perdeu a voz e o que ela pede de {characterName}.',
      openingNarration: 'A prece de sempre volta oca. O símbolo sagrado nas tuas mãos esfria e, pela primeira vez, não responde. No fundo do silêncio, algo espera por ti, {characterName}.',
      tags: ['fé', 'mistério', 'sagrado'],
    },
    {
      id: 'druida-raiz-envenenada', classKey: 'druid', title: 'A Raiz Envenenada',
      pitch: 'Um desequilíbrio na natureza reconhece {characterName} como mediador.',
      primaryQuestTitle: 'Estancar a corrupção na natureza',
      primaryQuestDescription: 'Encontrar a origem da corrupção e restaurar o equilíbrio antes que se espalhe.',
      openingNarration: 'As folhas escurecem por dentro, veias negras subindo do solo. A floresta vira-se para ti como quem pede socorro, {characterName}, e chama-te pelo teu nome.',
      tags: ['natureza', 'corrupção', 'equilíbrio'],
    },
    {
      id: 'guerreiro-contrato-que-sangra', classKey: 'fighter', title: 'O Contrato Que Sangra',
      pitch: 'Um trabalho simples testa a honra e a técnica de {characterName}.',
      primaryQuestTitle: 'Cumprir o contrato e desmascarar o inimigo',
      primaryQuestDescription: 'Levar o contrato até ao fim quando o verdadeiro inimigo se revela — sem trair a própria honra.',
      openingNarration: 'O pagamento era bom demais para a tarefa. Agora, com o aço já na mão, percebes que quem te contratou omitiu quem realmente esperava por ti, {characterName}.',
      tags: ['honra', 'contrato', 'combate'],
    },
    {
      id: 'monge-ultimo-selo', classKey: 'monk', title: 'O Último Selo do Mosteiro',
      pitch: 'Um juramento do treinamento de {characterName} retorna para cobrar disciplina.',
      primaryQuestTitle: 'Honrar o último selo do mosteiro',
      primaryQuestDescription: 'Enfrentar o que o treinamento deixou por resolver e provar o propósito de {characterName}.',
      openingNarration: 'Uma respiração, e o mundo aquieta. Mas o sino do mosteiro toca fora de hora — o selo que juraste guardar foi rompido, {characterName}, e o teu nome está no que resta dele.',
      tags: ['disciplina', 'juramento', 'propósito'],
    },
    {
      id: 'paladino-primeira-quebra', classKey: 'paladin', title: 'A Primeira Quebra do Juramento',
      pitch: 'Uma injustiça força {characterName} a agir antes de estar pronto.',
      primaryQuestTitle: 'Reparar a injustiça sem quebrar o juramento',
      primaryQuestDescription: 'Agir contra a injustiça diante de ti mantendo intacta a convicção que te define.',
      openingNarration: 'A cena diante de ti não espera pela tua certeza. A injustiça acontece agora, e o teu juramento pesa como nunca antes, {characterName}.',
      tags: ['juramento', 'justiça', 'convicção'],
    },
    {
      id: 'patrulheiro-rastros-fora-do-mapa', classKey: 'ranger', title: 'Rastros Fora do Mapa',
      pitch: 'Uma trilha impossível revela uma ameaça que só {characterName} consegue seguir.',
      primaryQuestTitle: 'Seguir os rastros fora do mapa',
      primaryQuestDescription: 'Rastrear a ameaça que atravessa território conhecido antes que ela chegue às pessoas.',
      openingNarration: 'As pegadas não deviam existir — atravessam o riacho sem molhar a margem. Só os teus olhos as veem, {characterName}, e elas seguem para onde nenhum mapa alcança.',
      tags: ['rastro', 'território', 'ameaça'],
    },
    {
      id: 'ladino-divida-da-sombra', classKey: 'rogue', title: 'A Dívida da Sombra',
      pitch: 'Um favor antigo cobra o seu preço de {characterName}.',
      primaryQuestTitle: 'Saldar a dívida da sombra',
      primaryQuestDescription: 'Decidir em quem confiar enquanto um segredo antigo cobra o que {characterName} deve.',
      openingNarration: 'Um bilhete sem assinatura aparece no teu bolso — letra que reconheces de um passado que preferias esquecer. A dívida venceu, {characterName}, e alguém veio receber.',
      tags: ['dívida', 'confiança', 'segredo'],
    },
    {
      id: 'feiticeiro-sangue-desperta', classKey: 'sorcerer', title: 'O Sangue Desperta',
      pitch: 'O poder inato de {characterName} reage a um fenômeno perigoso.',
      primaryQuestTitle: 'Entender o que despertou no teu sangue',
      primaryQuestDescription: 'Investigar o fenômeno que acordou teu poder antes que interessados demais te alcancem.',
      openingNarration: 'Sem que o chamasses, o poder acordou nas tuas veias e o ar crepitou à tua volta. Olhares atentos viraram-se na tua direção, {characterName} — cedo demais.',
      tags: ['sangue', 'poder', 'origem'],
    },
    {
      id: 'bruxo-preco-do-pacto', classKey: 'warlock', title: 'O Preço do Pacto',
      pitch: 'O patrono de {characterName} cobra a primeira consequência concreta.',
      primaryQuestTitle: 'Pagar a primeira cobrança do pacto',
      primaryQuestDescription: 'Cumprir o que o patrono exige sem entender ainda todas as regras do pacto.',
      openingNarration: 'A marca do pacto aquece contra a tua pele, e uma voz que não é tua sussurra uma única palavra: agora. O preço venceu, {characterName}, e o teu patrono não explica.',
      tags: ['pacto', 'patrono', 'consequência'],
    },
    {
      id: 'mago-arquivo-que-sussurra', classKey: 'wizard', title: 'O Arquivo Que Sussurra',
      pitch: 'Um conhecimento proibido reconhece {characterName}.',
      primaryQuestTitle: 'Descobrir por que o arquivo conhece o teu nome',
      primaryQuestDescription: 'Investigar a origem do grimório e impedir que o seu segredo caia em mãos perigosas.',
      openingNarration: 'A vela da escrivaninha curva-se sozinha quando te aproximas. Na lombada do grimório, letras novas surgem: o teu nome, {characterName}.',
      tags: ['mistério', 'conhecimento', 'origem'],
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
