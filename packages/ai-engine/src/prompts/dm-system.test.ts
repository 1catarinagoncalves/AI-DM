import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildDmSystemPrompt,
  buildTurnStateBlock,
  SCENE_BLOCK,
  ENTITIES_BLOCK,
  INVENTORY_BLOCK,
  SKILLS_LINE,
  type DmCharacterSheet,
} from './dm-system'

const baseSheet: DmCharacterSheet = {
  level: 3,
  hp: 8,
  maxHp: 24,
  attributes: { strength: 16, dexterity: 12 },
  conditions: ['envenenado'],
}

function build(overrides: Partial<Parameters<typeof buildDmSystemPrompt>[0]> = {}) {
  return buildDmSystemPrompt({
    systemName: 'D&D 5e',
    characterName: 'Aria',
    characterGender: 'feminino',
    characterClass: 'guerreiro',
    characterRace: 'humana',
    sheet: baseSheet,
    ...overrides,
  })
}

function buildState(overrides: Partial<Parameters<typeof buildTurnStateBlock>[0]> = {}) {
  return buildTurnStateBlock({
    sheet: baseSheet,
    activeQuests: [],
    inventory: [],
    ...overrides,
  })
}

describe('buildDmSystemPrompt — ficha constante (US-23 / camada 2)', () => {
  it('inclui nível e atributos da ficha (constante por personagem)', () => {
    const p = build()
    expect(p).toMatch(/Level:\s*3/)
    expect(p).toMatch(/16/)
    expect(p).toMatch(/12/)
  })

  it('marca a seção da ficha como read-only / fonte de verdade', () => {
    expect(build().toLowerCase()).toMatch(/character sheet \(read-only/)
  })

  it('renderiza atributos iterando o map — um atributo novo aparece sem editar o builder', () => {
    const p = build({ sheet: { ...baseSheet, attributes: { ...baseSheet.attributes, sorte: 7 } } })
    expect(p).toMatch(/sorte/i)
    expect(p).toMatch(/7/)
  })

  it('usa o label do config quando presente e cai na chave crua sem crashar quando ausente', () => {
    const withLabels = build({ attributeLabels: { strength: 'FOR', dexterity: 'DES' } })
    expect(withLabels).toMatch(/FOR 16/)
    expect(withLabels).toMatch(/DES 12/)

    const noLabels = build() // sem attributeLabels → chave crua, sem crash
    expect(noLabels).toMatch(/strength 16/)
  })

  it('não quebra com atributos vazios', () => {
    const p = build({ sheet: { level: 1, hp: 10, maxHp: 10, attributes: {}, conditions: [] } })
    expect(p).toMatch(/Level:\s*1/)
    expect(typeof p).toBe('string')
  })
})

describe('buildDmSystemPrompt — background narrativo (US-39)', () => {
  const background = {
    story: 'Nobre menor que perdeu a família para um culto demoníaco',
    ideals: ['Justiça acima de tudo', 'A Luz protege os inocentes'],
    bonds: ['Jurou vingança contra o culto que matou sua família'],
    flaws: ['Código de honra rígido: não mente, não abandona inocentes'],
  }

  it('inclui story, ideais, vínculos e fraquezas quando presentes', () => {
    const p = build({ background })
    expect(p).toMatch(/Nobre menor que perdeu a família/)
    expect(p).toMatch(/Justiça acima de tudo/)
    expect(p).toMatch(/Jurou vingança contra o culto/)
    expect(p).toMatch(/Código de honra rígido/)
  })

  it('junta as listas (ideais/vínculos/fraquezas) numa linha', () => {
    const p = build({ background })
    expect(p).toMatch(/Justiça acima de tudo; A Luz protege os inocentes/)
  })

  it('marca a seção como read-only / roleplay guidance e instrui o USO de cada eixo', () => {
    const p = build({ background })
    expect(p.toLowerCase()).toMatch(/character identity \(read-only/)
    // a redação default (US-39 §3): condicional + papel de cada traço.
    // US-77 — âncoras por conceito (evals/PROMPT-ANCHORS.md). O `/fraqueza/` anterior
    // casava a linha de DADO "- Fraquezas: …" injetada pelo fixture: sobrevivia à
    // remoção da regra e provava só que o background tem o campo.
    expect(p.toLowerCase()).toMatch(/(flaw|fraqueza)s?[^.]{0,60}(dilemma|dilema)/)
    expect(p.toLowerCase()).toMatch(/\b(not|never|não|nunca)\s+for[çc][ae]r?\b[^.]{0,60}(scene|cena)/)
  })

  it('sem background → não gera a seção nem quebra', () => {
    const p = build()
    expect(p).not.toMatch(/Character identity/i)
    expect(typeof p).toBe('string')
  })

  it('background vazio ({}) ou campos vazios → sem seção, sem crash', () => {
    expect(build({ background: {} })).not.toMatch(/Character identity/i)
    const p = build({ background: { story: '', ideals: [], flaws: ['   '] } })
    expect(p).not.toMatch(/Character identity/i)
  })

  it('renderiza só os campos preenchidos (vínculo ausente não vira linha vazia)', () => {
    const p = build({ background: { story: 'Um andarilho solitário' } })
    expect(p).toMatch(/Character identity/i)
    expect(p).toMatch(/Um andarilho solitário/)
    expect(p).not.toMatch(/Vínculos:/)
  })
})

describe('buildDmSystemPrompt — sem estado volátil no system (US-56 / camadas 1+2 só)', () => {
  const scene = {
    local: 'Praça da vila ao anoitecer',
    ambiente: 'externo' as const,
    periodo: 'anoitecer',
    presentes: ['prefeito'],
    objetos_em_cena: [],
    atualizadoEm: '',
  }

  it('NÃO emite nenhum campo volátil (HP, condições, cena, quests, inventário, resumo)', () => {
    const p = build()
    // Camada 3 saiu inteira do system: nenhum cabeçalho de estado do turno aparece aqui.
    expect(p).not.toMatch(/## Estado atual/)
    expect(p).not.toMatch(/- HP:/)
    expect(p).not.toMatch(/- Conditions:/)
    expect(p).not.toMatch(/## Cena atual/)
    expect(p).not.toMatch(/## Main quest/)
    expect(p).not.toMatch(/## Active quests/)
    expect(p).not.toMatch(/## Current inventory/)
    expect(p).not.toMatch(/## A história até agora/)
    // Mesmo passando dados voláteis herdados, nada vaza (a assinatura já nem os aceita,
    // mas o valor do personagem — envenenado — não deve reaparecer via outra rota).
    expect(p).not.toMatch(/envenenado/)
  })

  it('mantém level/atributos (constante) no system', () => {
    const p = build()
    expect(p.indexOf('- Level:')).toBeLessThan(p.indexOf('- Attributes:'))
    expect(p).toMatch(/Level:\s*3/)
  })

  it('não perde regras semânticas (rolagens, gênero, craft, continuidade, ordem do turno)', () => {
    const p = build()
    expect(p).toMatch(/rollDice/)
    // US-77: ancorado no campo + no valor do enum (ambos do código), não no cabeçalho
    // "### 8. Gender Agreement" — cabeçalho é prosa autoral e já foi renomeado antes (US-71).
    // As aspas em "feminino" são obrigatórias: sem elas a regex casa a linha
    // `- Gender: ${characterGender}` da ficha (:365) e sobrevive à deleção da regra.
    expect(p).toMatch(/gender[^.]{0,40}"feminino"/i)
    expect(p).toMatch(/Narrative craft/)
    expect(p).toMatch(/SCENE CONTINUITY & OPTIONS/)
    expect(p).toMatch(/TURN RESOLUTION ORDER/)
  })

  it('inclui a subseção de onomástica (US-68/US-36): steering positivo, ancora sonoridade, paleta aberta', () => {
    const p = build()
    expect(p).toMatch(/Onomastics/)
    // US-36: a barra NÃO nomeia mais os slop names (nomeá-los PRIMAVA o modelo a
    // usá-los — "elefante rosa"). O enforcement da lista fechada é o guardrail
    // determinístico detectSlopName; aqui o prompt só faz steering POSITIVO.
    // assertiva NEGATIVA ancora em literal fechado (evals/PROMPT-ANCHORS.md): regex
    // tolerante aqui produziria falso VERMELHO, não falso verde.
    expect(p).not.toMatch(/Elara/)
    expect(p).not.toMatch(/Kael/)
    // US-77 — as 4 positivas eram frases inteiras da seção reescrita em e0a6817.
    // Agora: conceito + conceito preso na mesma frase.
    expect(p).toMatch(/invent[^.]{0,60}(from scratch|fresh|do zero)/i)
    // `(generic|genérico)[^.]{0,40}(default|name)` seria falso verde: casa
    // "a generic AND a named-skill version" da regra de rolagem (dm-system.ts:273).
    expect(p).toMatch(/(generic|genérico)[^.]{0,30}(default|fallback|off-the-shelf|padrão)/i)
    // paleta aberta = INVENTAR um registro que a cheat-sheet não lista (não a frase
    // "OPEN PALETTE"); `invent … register` sozinho casaria o passo 2 e sobreviveria
    // à deleção do parágrafo.
    expect(p).toMatch(/invent[^.]{0,80}(coherent register|register of its own|registro (próprio|coerente))/i)
    // cobre pessoas/lugares/coisas, não só NPCs
    expect(p).toMatch(/\b(everything|all|tudo)\b[^.]{0,60}proper name/i)
  })

  it('a regra em-dash/opções aparece UMA vez (sem a duplicata "ABSOLUTE RULE")', () => {
    const p = build()
    expect(p).not.toMatch(/ABSOLUTE RULE/)
    expect(p.split('Choice Options').length - 1).toBe(1)
  })

  // guard: a cena não volta ao system nem quando um caller antigo tentaria passá-la.
  it('cena estruturada nunca aparece no system', () => {
    const p = build()
    expect(p).not.toContain(scene.local)
  })
})

describe('buildTurnStateBlock — estado volátil na mensagem (US-56 / camada 3)', () => {
  const scene = {
    local: 'Praça da vila ao anoitecer',
    ambiente: 'externo' as const,
    periodo: 'anoitecer',
    presentes: ['prefeito'],
    objetos_em_cena: [],
    atualizadoEm: '',
  }

  it('inclui HP/HP máx e condições da ficha', () => {
    const s = buildState()
    expect(s).toMatch(/## Estado atual/)
    expect(s).toMatch(/HP:\s*8\/24/)
    expect(s).toMatch(/envenenado/)
  })

  it('cabeçalho forte de fonte-de-verdade: declara-se ground truth do sistema, não fala do jogador, com precedência', () => {
    const s = buildState()
    // O risco principal da US: lido como fala do usuário, o estado precisa dobrar a
    // linguagem de precedência para não perder força de instrução.
    // US-77 — o contrato é PRECEDÊNCIA sobre a prosa + "isto não é fala do jogador";
    // as três eram frases do preâmbulo (evals/PROMPT-ANCHORS.md). O mesmo contrato é
    // testado em evals/cases/us-23-dm-ciente-da-ficha.ts — reancorado igual lá.
    // `/authoritative/` sozinho seria falso verde: a seção de inventário também o diz.
    expect(s.toLowerCase()).toMatch(/(precedence|precedência)[^.]{0,80}(infer|prose|prosa)/)
    expect(s.toLowerCase()).toMatch(/\b(not|não)\s+(the\s+)?(player|jogador)[^.]{0,30}(speak|talk|fala|input|voice)/)
    // `source of truth` fica FORA da alternação de propósito: a seção "## Estado atual"
    // (:401) também o diz, então a assertiva sobreviveria à deleção do preâmbulo.
    expect(s.toLowerCase()).toMatch(/(authoritative|ground truth|fonte de verdade)[^.]{0,80}(this turn|deste turno|game server)/)
  })

  it('inclui cena, main quest, active quests, inventário e resumo quando presentes', () => {
    const s = buildState({
      sceneState: scene,
      mainQuest: 'Salvar a vila',
      activeQuests: ['Encontrar o ferreiro'],
      inventory: ['Espada', 'Poção (2)'],
      memorySummary: 'A vila foi atacada por goblins na noite anterior.',
    })
    expect(s).toMatch(/## Cena atual/)
    expect(s).toContain('Praça da vila ao anoitecer')
    expect(s).toMatch(/## Main quest/)
    expect(s).toContain('Salvar a vila')
    expect(s).toMatch(/## Active quests/)
    expect(s).toContain('Encontrar o ferreiro')
    expect(s).toMatch(/## Current inventory/)
    expect(s).toContain('Espada')
    expect(s).toMatch(/## A história até agora/)
    expect(s).toContain('atacada por goblins')
  })

  it('o resumo refere as mensagens recentes como estando ACIMA (history fica antes do bloco)', () => {
    const s = buildState({ memorySummary: 'Algo aconteceu.' })
    // US-77 — o par positivo/negativo É o ponto do teste (a preposição já inverteu uma vez).
    // Positiva: só "mensagens + acima", isolado do resto da frase. Negativa: literal fechado,
    // por regra (evals/PROMPT-ANCHORS.md) — tolerância aqui daria falso vermelho.
    expect(s).toMatch(/messages[^.]{0,20}\babove\b/i)
    expect(s).not.toMatch(/recent messages below/i)
  })

  it('campos ausentes → sem cena/resumo, placeholders para quest/inventário, sem crash', () => {
    const s = buildState()
    expect(s).not.toMatch(/## Cena atual/)
    expect(s).not.toMatch(/## A história até agora/)
    expect(s).toMatch(/No main quest set yet/)
    expect(s).toMatch(/No secondary quests yet/)
    expect(s).toMatch(/- Empty\./)
    expect(typeof s).toBe('string')
  })

  it('injeta o bloco de Entidades do mundo como FONTE DE VERDADE quando há entidades', () => {
    const s = buildState({
      entities: [
        { nome: 'Vigia', tipo: 'npc', local: 'sala secreta', estado: 'neutra', nota: 'guardiã da bacia', atualizadoEm: '' },
      ],
    })
    expect(s).toMatch(/## Entidades do mundo/)
    expect(s).toContain('Vigia')
    expect(s).toContain('sala secreta')
  })

  // US-87 — este caso afirmava o OPOSTO (`not.toMatch`): a seção sumia com ledger vazio
  // enquanto a camada 2 mandava confiar nela "every turn". Agora o cabeçalho é
  // incondicional e o corpo vazio vira gatilho da tool.
  it('sem entidades → o bloco de Entidades é emitido mesmo assim, apontando para recordEntity', () => {
    const s = buildState()
    expect(s).toMatch(/## Entidades do mundo/)
    expect(s).toContain('recordEntity')
    // Os gates da US-75 governam entradas que não existem — emiti-los aqui é prosa morta.
    expect(s).not.toMatch(/KNOWLEDGE GATES/)
  })

  // US-71: sinal de continuidade estrutural — emitido só quando há `local`, afirma que a
  // personagem JÁ está lá e que a chegada já foi narrada (substitui a prosa "Arrival happens ONCE").
  it('emite o sinal de continuidade com o local quando há cena com `local`', () => {
    const s = buildState({ sceneState: scene })
    // US-77 — as 3 eram frases longas da área que a própria US-71 reescreveu.
    // Âncora: o local do fixture entre «» (marcador estrutural, só a linha de
    // continuidade os usa — formatSceneState renderiza "- local: X") + conceito.
    expect(s).toMatch(/(already|já)[^.]{0,20}«Praça da vila ao anoitecer»/i)
    expect(s).toMatch(/(arrival|chegada)[^.]{0,60}(earlier turns|turnos anteriores|já (foi )?narrad)/i)
    expect(s).toMatch(/\b(not|never|não|nunca)\b[^.]{0,20}re-narrat/i)
  })

  // 2026-07-28 (emenda à US-71): regressão real de sessão local. O jogador escolheu
  // "voltar para a vila e contar ao NPC" e o Mestre respondeu redescrevendo o local
  // ATUAL e repetindo as mesmas opções — `finishReason=stop`, ou seja, ele julgou o
  // turno completo (não foi corte nem falha de provedor). Causa: a linha tinha TRÊS
  // proibições duras (não re-narrar trajeto/chegada/cumprimento) contra UMA cláusula
  // final macia autorizando mover, e a ação pedida era exatamente trajeto+chegada+
  // cumprimento. O deslocamento PEDIDO agora vence o anti-replay explicitamente.
  it('autoriza a viagem que o jogador PEDIU, sobrepondo o anti-replay', () => {
    const s = buildState({ sceneState: scene })
    // Âncoras de conceito (não de frase): move novo × precedência; retorno a lugar já
    // visitado é o caso que falhou; proibição de responder um deslocamento repetindo opções.
    expect(s).toMatch(/(NEW move|novo deslocamento)[^.]{0,60}(overrides|sobrepõe)/i)
    expect(s).toMatch(/(returning|voltar)[^.]{0,60}(already visited|já visitad)/i)
    expect(s).toMatch(/\b(never|nunca)\b[^.]{0,120}(same options|mesmas opções)/i)
  })

  it('sem `local` na cena → nenhum sinal de continuidade', () => {
    const s = buildState({ sceneState: { ...scene, local: '' } })
    expect(s).not.toMatch(/is ALREADY at/)
  })

  // US-71 Q2: entidade que está em `presentes` não repete "— em {local}" (posição dela = cena).
  it('suprime "em {local}" de NPC presente no bloco de Entidades', () => {
    const s = buildState({
      sceneState: { ...scene, presentes: ['Hélio'] },
      entities: [{ nome: 'Hélio', tipo: 'npc', local: 'forja de Hélio', estado: 'ocupado', atualizadoEm: '' }],
    })
    expect(s).toContain('[NPC] Hélio — ocupado')
    expect(s).not.toContain('em forja de Hélio')
  })
})

// US-84: o PAR é o teste. A camada 2 (system, estático e cacheado) manda o Mestre confiar
// num bloco que a camada 3 (turn-state, outra mensagem desde a US-56) emite. Com o nome
// escrito à mão dos dois lados, renomear um lado deixava o prompt apontando para um bloco
// fantasma sem quebrar teste, typecheck ou log. Estas assertivas ancoram na CONSTANTE, não
// no literal: o alvo é o identificador compartilhado por dois emissores, não o conteúdo da
// regra (a distinção que a US-77 fez ao rejeitar constantes para regras — evals/PROMPT-ANCHORS.md).
describe('US-84 — nome de bloco: emissor e citação saem da mesma constante', () => {
  const fullState = () =>
    buildTurnStateBlock({
      sheet: baseSheet,
      sceneState: {
        local: 'Praça da vila ao anoitecer',
        ambiente: 'externo' as const,
        periodo: 'anoitecer',
        presentes: [],
        objetos_em_cena: [],
        atualizadoEm: '',
      },
      entities: [{ nome: 'Vigia', tipo: 'npc' as const, estado: 'neutra', atualizadoEm: '' }],
      activeQuests: [],
      inventory: ['Espada'],
    })

  it.each([SCENE_BLOCK, ENTITIES_BLOCK, INVENTORY_BLOCK])(
    '«%s» é emitido como cabeçalho no turn-state E citado com o mesmo nome na prosa do system',
    (name) => {
      expect(fullState()).toContain(`## ${name}`)
      expect(build()).toContain(`"${name}"`)
    },
  )

  // US-87: o par acima roda sobre um turn-state CHEIO, então passava verde enquanto o bloco
  // sumia com ledger vazio — que é exatamente o turno em que a citação da camada 2 ("re-shown
  // in full EVERY turn") ficava órfã. A citação é incondicional; a emissão tem de ser também.
  it(`«${ENTITIES_BLOCK}» é emitido e citado TAMBÉM no turno de ledger vazio`, () => {
    expect(buildState({ entities: [] })).toContain(`## ${ENTITIES_BLOCK}`)
    expect(build()).toContain(`"${ENTITIES_BLOCK}"`)
  })

  // O par acima prova que a constante ESTÁ ligada nas duas pontas, mas não que ela seja a
  // ÚNICA fonte: com DUAS citações do mesmo nome, uma interpolada e outra escrita à mão,
  // ele passa verde (verificado por mutação ao escrever esta US). Este aqui é o grep de
  // aceite automatizado, e pega o deslize realista: alguém copiar o nome do bloco para
  // uma prosa nova em vez de interpolar → a contagem vai a 2 → vermelho.
  // LIMITE conhecido: um rename que DESinterpole uma citação passa, porque o teste só
  // conhece o valor ATUAL da constante, nunca o antigo. Contra isso o que vale é a
  // estrutura (um literal só, interpolado), não a vigilância.
  // A sétima citação (`apps/api/.../ai.service.ts`) não é varrida daqui: lá o literal veio
  // embora pela import da constante, e import quebrada é erro de typecheck, não silêncio.
  it('o literal de cada nome existe UMA vez no fonte — a declaração da constante', () => {
    // cwd = raiz do pacote (o vitest roda por pacote). Arquivo ausente → readFileSync
    // ESTOURA, que é o que se quer: um guard que não achou o fonte não pode passar verde.
    const source = readFileSync(resolve(process.cwd(), 'src/prompts/dm-system.ts'), 'utf8')
    for (const name of [SCENE_BLOCK, ENTITIES_BLOCK, INVENTORY_BLOCK, SKILLS_LINE]) {
      const occurrences = source.split(`'${name}'`).length - 1
      expect(`${name}: ${occurrences}`).toBe(`${name}: 1`)
      // Reintrodução como texto cru num cabeçalho ou na prosa (`## Cena atual`, `"Cena atual"`)
      // não fica em aspas simples — daí a segunda contagem, sobre o nome nu.
      const raw = source.split(name).length - 1
      expect(`${name} cru: ${raw}`).toBe(`${name} cru: 1`)
    }
  })

  // A linha de perícias não é um bloco `## `, mas tem o mesmo acoplamento: `rollDice`
  // exige o nome EXATO da linha, e o repo é bilíngue (ADR 005) — renomear para "Perícias"
  // quebraria a instrução em silêncio.
  it(`«${SKILLS_LINE}» é a linha emitida na ficha E o nome que a regra de rollDice exige`, () => {
    const p = build({ sheet: { ...baseSheet, skills: [{ label: 'Percepção', modifier: 5, proficient: true }] } })
    expect(p).toContain(`- ${SKILLS_LINE} (`)
    expect(p).toContain(`"${SKILLS_LINE}"`)
  })
})

// US-85 — guard de CONJUNTO da fronteira do ADR 007 (regra 2), que falha FECHADO.
// O guard de campo volátil (`:139`) é uma lista de proibições nomeadas uma a uma; contra
// bloco que ainda não tem nome ele falha ABERTO: um `## Clima atual` novo no turn-state,
// citado na prosa da camada 2 com um literal fresco, passa por `pnpm test`, `pnpm typecheck`
// e `pnpm eval` sem um vermelho — e nasce dessincronizável no mesmo dia. E a US-84 conserta
// os acoplamentos que EXISTEM sem impedir o próximo. Aqui a asserção é invertida: extrai
// TODOS os cabeçalhos do bloco renderizado e exige que cada um esteja declarado. Uma
// asserção por nome conhecido voltaria a falhar aberto — é o formato que este teste substitui.
//
// LIMITE, registrado de propósito: o guard conta CABEÇALHOS, não bytes. Prosa acrescentada
// a bloco JÁ existente (o que a emenda de 2026-07-28 à `continuityLine` fez: +541 chars)
// passa incólume, e está certo que passe — a fronteira protegida aqui é a de acoplamento
// por literal, não a de volume. Verde aqui NÃO é aval de que a camada 3 não engordou; esse
// sinal é o tamanho renderizado do bloco, medido pelo `DM_CACHE_SPIKE` (US-85, Questão #1).
describe('US-85 — fronteira das camadas: todo bloco da camada 3 é declarado', () => {
  // Cabeçalhos que a prosa da camada 2 NÃO cita. Sem segundo escritor não são acoplamento,
  // e por isso ficam FORA do registro de nomes da US-84 de propósito (`dm-system.ts:13`).
  // São cabeçalhos emitidos mesmo assim, então o guard precisa conhecê-los para distinguir
  // "bloco que já existe" de "bloco novo".
  const UNCITED_TURN_STATE_BLOCKS = ['Estado atual', 'Main quest', 'Active quests', 'A história até agora']
  const DECLARED = [SCENE_BLOCK, ENTITIES_BLOCK, INVENTORY_BLOCK, ...UNCITED_TURN_STATE_BLOCKS]

  // Fixture CHEIO: `sceneSection` e `summarySection` são `''` quando vazios
  // (`dm-system.ts:440`, `:485`); com fixture pela metade o guard veria metade dos
  // cabeçalhos e passaria por engano. O caso ausente-vazio já é coberto em `:272`.
  const emittedBlockNames = () => {
    const rendered = buildState({
      sceneState: {
        local: 'Praça da vila ao anoitecer',
        ambiente: 'externo' as const,
        periodo: 'anoitecer',
        presentes: [],
        objetos_em_cena: [],
        atualizadoEm: '',
      },
      entities: [{ nome: 'Vigia', tipo: 'npc' as const, estado: 'neutra', atualizadoEm: '' }],
      mainQuest: 'Salvar a vila',
      activeQuests: ['Encontrar o ferreiro'],
      inventory: ['Espada'],
      memorySummary: 'A vila foi atacada por goblins na noite anterior.',
    })
    // O nome do bloco é o cabeçalho SEM o qualificador entre parênteses ("(read-only — …)",
    // "(secondary)"): o qualificador é redação, o nome é o que a camada 2 cita.
    return [...rendered.matchAll(/^## (.+)$/gm)].map((m) => m[1].replace(/\s*\(.*$/, '').trim())
  }

  it('nenhum cabeçalho órfão (bloco novo sem declaração = vermelho)', () => {
    const orphans = emittedBlockNames().filter((name) => !DECLARED.includes(name))
    expect(
      orphans,
      `Cabeçalho novo na camada 3 sem declaração: ${orphans.map((o) => `"${o}"`).join(', ')}. ` +
        `A prosa da camada 2 (buildDmSystemPrompt) cita este bloco pelo nome? Declare uma constante ` +
        `em dm-system.ts junto de SCENE_BLOCK e interpole nos DOIS lados (ADR 007, regra 2). ` +
        `Não cita? Acrescente o nome a UNCITED_TURN_STATE_BLOCKS neste arquivo. Esperado: ${DECLARED.join(' | ')}`,
    ).toEqual([])
  })

  // A metade simétrica: sem ela, um fixture que parasse de preencher uma seção (ou uma regex
  // quebrada, devolvendo lista vazia) deixaria o guard acima verde vendo cabeçalho nenhum.
  it('o fixture do guard emite TODOS os blocos declarados', () => {
    const emitted = emittedBlockNames()
    for (const name of DECLARED) {
      expect(emitted, `bloco declarado "${name}" não saiu do fixture — preencha a seção que o produz`).toContain(name)
    }
  })
})
