// US-232 — compara a autoria mundo-primeiro entre os arms 2 e 3 da escada:
// deepseek-v4-pro-0813 e deepseek-v4.1-flash. Standalone (não depende do git state do
// api/src): reproduz AUTHORING_SCHEMA + prompt + minting, valida contra GeneratedAdventureSchema.
//   npx dotenv-cli -e ../../.env -- node authoring-models-compare.mjs
import { generateObject } from 'ai'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveModel, CRAFT_CORE_SECTION, NPC_VOICE_BULLET, ONOMASTICS_SECTION } from './dist/index.js'
// NÃO importa GeneratedAdventureSchema de @ai-dm/shared: o dist da shared está no schema ANTIGO
// (tree em main, sem US-232). A forma já é validada pelo AUTHORING_SCHEMA no generateObject.

const PO = { openrouter: { reasoning: { enabled: false } } }
const ARMS = ['openrouter:deepseek/deepseek-v4-pro-0813', 'openrouter:deepseek/deepseek-v4.1-flash']
const FACTION_COUNT = 3
const COUNTS = { locations: 6, npcs: 7, challenges: 3, encounters: 3 }
const PROFILE = { className: 'druida (druid)', level: 3, characterStory: 'Cresceu num vilarejo de pântano que secou quando um lorde drenou o brejo para plantar; jurou nunca deixar outra terra viva morrer por ganância.' }

const AUTHORING_SCHEMA = z.object({
  world: z.object({ name: z.string().min(1), description: z.string().min(1), anchors: z.array(z.string()) }),
  summary: z.string().min(1),
  story: z.string().min(1),
  factions: z.array(z.object({ name: z.string().min(1), kind: z.string().min(1), want: z.string().min(1) })).min(1),
  npcs: z.array(z.object({ name: z.string().min(1), role: z.string().min(1), want: z.string().min(1), factionIndex: z.number().int().min(0).optional(), speech: z.string().optional() })).min(1),
  locations: z.array(z.object({ title: z.string().min(1), aspects: z.array(z.string()), boxedText: z.string().min(1), description: z.string().min(1), occupants: z.array(z.number().int().min(0)), factionIndex: z.number().int().min(0).optional(), vibe: z.enum(['combat', 'skill', 'social']) })).min(1),
  challenges: z.array(z.object({ locationIndex: z.number().int().min(0), test: z.string().min(1), situation: z.string().min(1), consequence: z.string().min(1) })).min(1),
  encounters: z.array(z.object({ locationIndex: z.number().int().min(0), npcIndices: z.array(z.number().int().min(0)), type: z.enum(['combat', 'skill', 'social']), fiction: z.string().min(1), behaviors: z.string().min(1), goal: z.string().min(1), complications: z.string().min(1), unlocks: z.string().min(1) })).min(1),
  objective: z.object({ description: z.string().min(1), reward: z.object({ name: z.string().min(1), effect: z.string().min(1) }), locationIndex: z.number().int().min(0) }),
  branchedResolution: z.array(z.object({ choice: z.string().min(1), consequence: z.string().min(1) })).min(1),
  start: z.string().min(1),
  followUps: z.array(z.string()).min(1),
})

function system() {
  return [
    'Você é um designer de aventuras de RPG de mesa (D&D 5e), no nível de um módulo publicado. Escreva uma aventura one-shot ORIGINAL e AUTORAL para UM único personagem.',
    '', 'INVENTE UM MUNDO NOVO — não use cenários de prateleira. O mundo é seu, específico e nomeado, com detalhe sensorial concreto.',
    '', 'PRIMEIRA AVENTURA — o personagem CHEGA NOVO a este mundo: NÃO existe história prévia jogada. Nenhum NPC já o conhece; não pressuponha eventos anteriores como fato; não ancore item/recompensa/lugar no passado dele; follow-ups introduzem ganchos NOVOS do mundo. O enredo nasce de um gancho que qualquer forasteiro receberia.',
    '', 'MECÂNICA: NÃO escreva número mecânico na prosa (CD, dano, HP, CA). Testes nomeados por perícia/atributo, sem CD. Sem statblocks.',
    '', 'FACÇÕES: invente as facções pedidas com desejos que COLIDEM — elas SÃO o antagonismo. Dissolva-as na story e nos npcs, mas preencha factions[]. NPC neutro tem want SEM factionIndex.',
    '', 'OBJETIVO E FECHO: objective tem meta + recompensa (item mágico nomeado, efeito em ficção, sem números) + local. branchedResolution é a escolha final RAMIFICADA — um rumo por facção, cada um com custo, nenhum "o certo". O último encontro amarra essa escolha.',
    '', 'LOCAIS: description fala SÓ do lugar e dos itens — NÃO cite NPCs (quem habita fica em occupants, por índice).',
    '', 'ENCONTROS: fiction é a NARRATIVA que o jogador lê; behaviors/goal/complications/unlocks são a decomposição. unlocks do encontro N faz o N+1 existir; o Final ecoa branchedResolution.',
    '', 'Responda SEMPRE em português do Brasil; nomes próprios seguem a Onomástica abaixo. Prosa densa e sensorial, sem placeholders.',
    '', `Barra de qualidade:\n${CRAFT_CORE_SECTION}\n${NPC_VOICE_BULLET}\n\n${ONOMASTICS_SECTION}`,
  ].join('\n')
}

function prompt() {
  return [
    `Personagem: ${PROFILE.className}, nível ${PROFILE.level}. (Contexto de escala — a aventura NÃO gira em torno dele.)`,
    `História do personagem (use SÓ como TOM, NUNCA como fato de plot): ${PROFILE.characterStory}`,
    '', 'Sem eixos de mundo fixados — você é livre em cenário/tom/tipo de área.',
    '', 'Contagens (respeite exatamente):',
    `- ${FACTION_COUNT} facções com desejos concorrentes`,
    `- ~${COUNTS.locations} locais`, `- ~${COUNTS.npcs} NPCs`,
    `- ${COUNTS.challenges} desafios NÃO-COMBATE (cada um preso a um local)`,
    `- ${COUNTS.encounters} encontros (inclua um Final que amarra o fecho ramificado)`,
    `- ${FACTION_COUNT} rumos em branchedResolution e ${FACTION_COUNT} followUps`,
    '', 'Emita na ordem: mundo → facções → conflito+fecho → objetivo+recompensa → locais/NPCs (com fala e o que cada um quer) → followUps → ficção dos encontros → desafios não-combate.',
  ].join('\n')
}

function mint(a, characterId) {
  const factions = a.factions.map((f, i) => ({ id: `faction-${i + 1}`, name: f.name, kind: f.kind, want: f.want }))
  const fid = (idx) => (idx !== undefined && idx >= 0 && idx < factions.length ? factions[idx].id : undefined)
  const npcs = a.npcs.map((n, i) => ({ id: `npc-${i + 1}`, name: n.name, role: n.role, want: n.want, ...(fid(n.factionIndex) ? { factionId: fid(n.factionIndex) } : {}), interactions: n.speech?.trim() ? [{ narrative: n.speech.trim() }] : [] }))
  const locations = a.locations.map((l, i) => ({ id: `loc-${i + 1}`, title: l.title, aspects: l.aspects, boxedText: l.boxedText, description: l.description, occupants: l.occupants.filter((x) => x < npcs.length).map((x) => npcs[x].id), ...(fid(l.factionIndex) ? { factionId: fid(l.factionIndex) } : {}), vibe: l.vibe }))
  const lid = (idx) => (idx >= 0 && idx < locations.length ? locations[idx].id : locations[0].id)
  const challenges = a.challenges.map((c, i) => ({ id: `challenge-${i + 1}`, locationId: lid(c.locationIndex), test: c.test, situation: c.situation, consequence: c.consequence }))
  const encounters = a.encounters.map((e, i) => ({ id: `encounter-${i + 1}`, locationId: lid(e.locationIndex), npcIds: e.npcIndices.filter((x) => x < npcs.length).map((x) => npcs[x].id), type: e.type, fiction: e.fiction, behaviors: e.behaviors, goal: e.goal, complications: e.complications, unlocks: e.unlocks }))
  const objective = { description: a.objective.description, reward: a.objective.reward, locationId: lid(a.objective.locationIndex) }
  const anchored = new Set([...encounters.map((e) => e.locationId), ...challenges.map((c) => c.locationId), objective.locationId, ...locations.filter((l) => l.occupants.length > 0).map((l) => l.id)])
  const occupied = new Set(locations.flatMap((l) => l.occupants))
  const free = npcs.filter((n) => !occupied.has(n.id))
  const pool = free.length > 0 ? free : npcs
  let rr = 0
  for (const loc of locations) { if (anchored.has(loc.id) || pool.length === 0) continue; loc.occupants = [...loc.occupants, pool[rr % pool.length].id]; rr++ }
  return { id: `${characterId}:1`, levelRange: { min: PROFILE.level, max: PROFILE.level }, registry: { setting: 'fantasy', tone: 'mystery', areaType: 'wilderness' }, summary: a.summary, world: a.world, story: a.story, factions, npcs, locations, challenges, encounters, start: a.start, objective, branchedResolution: a.branchedResolution, followUps: a.followUps }
}

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../evals/reports')
mkdirSync(dir, { recursive: true })

for (const slug of ARMS) {
  const short = slug.split('/').pop()
  process.stdout.write(`\n=== ${short} ===\n`)
  try {
    const t0 = Date.now()
    const { object, usage } = await generateObject({ model: resolveModel(slug), schema: AUTHORING_SCHEMA, system: system(), prompt: prompt(), maxTokens: 16000, providerOptions: PO, maxRetries: 2, abortSignal: AbortSignal.timeout(300000) })
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    const minted = mint(object, `compare-${short}`)
    const path = resolve(dir, `authoring-${short}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`)
    writeFileSync(path, JSON.stringify(minted, null, 2), 'utf8')
    console.log(`✅ gerado + mintado em ${secs}s | out=${usage?.completionTokens} tok`)
    console.log('Mundo:', minted.world.name)
    console.log('Facções:', minted.factions.map((f) => `${f.name} (${f.kind}) quer ${f.want}`).join(' | '))
    console.log('Objetivo:', minted.objective.description, '— recompensa:', minted.objective.reward.name)
    console.log('Contagens: locais', minted.locations.length, '| NPCs', minted.npcs.length, '| desafios', minted.challenges.length, '| encontros', minted.encounters.length)
    console.log('Fecho:', minted.branchedResolution.map((b) => b.choice).join(' / '))
    console.log('💾', path)
  } catch (e) {
    console.log('❌ falhou:', e?.message ?? e)
  }
}
