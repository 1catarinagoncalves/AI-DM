import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import type { Locale, SystemConfig } from '@ai-dm/shared'
import { buildFreeClassFeatures, buildFreeClassSpells } from './free-catalog'
import { initialAdventuresByLocale } from './initial-adventures'

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

// Catálogos de registro da aventura (US-156): tom, cenário e tipo de área. Sem fonte SRD
// (não vêm do artefato/ingest) — copiados literalmente de `dhorions/DnDGenerate`
// (CampaignTones.json/Settings.json/areaType.json, MPL-2.0), rótulo pt-BR por tradução
// direta. `key` em kebab-case, mesmo padrão de sleight-of-hand/land-vehicle.
const registryTones: SystemConfig['tones'] = [
  { key: 'heroic', label: 'Heroic' },
  { key: 'grimdark', label: 'Grimdark' },
  { key: 'mystery', label: 'Mystery' },
  { key: 'comedic', label: 'Comedic' },
  { key: 'epic', label: 'Epic' },
  { key: 'romantic', label: 'Romantic' },
  { key: 'horror', label: 'Horror' },
  { key: 'political-intrigue', label: 'Political Intrigue' },
  { key: 'survival', label: 'Survival' },
  { key: 'slice-of-life', label: 'Slice of Life' },
]
const registryTonesPtBr: SystemConfig['tones'] = [
  { key: 'heroic', label: 'Heroico' },
  { key: 'grimdark', label: 'Sombrio' },
  { key: 'mystery', label: 'Mistério' },
  { key: 'comedic', label: 'Cômico' },
  { key: 'epic', label: 'Épico' },
  { key: 'romantic', label: 'Romântico' },
  { key: 'horror', label: 'Terror' },
  { key: 'political-intrigue', label: 'Intriga Política' },
  { key: 'survival', label: 'Sobrevivência' },
  { key: 'slice-of-life', label: 'Cotidiano' },
]
const registrySettings: SystemConfig['settings'] = [
  { key: 'high-fantasy', label: 'High Fantasy' },
  { key: 'dark-fantasy', label: 'Dark Fantasy' },
  { key: 'steampunk', label: 'Steampunk' },
  { key: 'urban-fantasy', label: 'Urban Fantasy' },
  { key: 'post-apocalyptic', label: 'Post-Apocalyptic' },
  { key: 'historical-fiction', label: 'Historical Fiction' },
  { key: 'sci-fi-space-opera', label: 'Sci-Fi Space Opera' },
  { key: 'mythological', label: 'Mythological' },
  { key: 'alternate-reality', label: 'Alternate Reality' },
  { key: 'cyberpunk', label: 'Cyberpunk' },
]
const registrySettingsPtBr: SystemConfig['settings'] = [
  { key: 'high-fantasy', label: 'Alta Fantasia' },
  { key: 'dark-fantasy', label: 'Fantasia Sombria' },
  { key: 'steampunk', label: 'Steampunk' },
  { key: 'urban-fantasy', label: 'Fantasia Urbana' },
  { key: 'post-apocalyptic', label: 'Pós-Apocalíptico' },
  { key: 'historical-fiction', label: 'Ficção Histórica' },
  { key: 'sci-fi-space-opera', label: 'Ópera Espacial' },
  { key: 'mythological', label: 'Mitológico' },
  { key: 'alternate-reality', label: 'Realidade Alternativa' },
  { key: 'cyberpunk', label: 'Cyberpunk' },
]
const registryAreaTypes: SystemConfig['areaTypes'] = [
  { key: 'city', label: 'City' },
  { key: 'forest', label: 'Forest' },
  { key: 'mountain-range', label: 'Mountain Range' },
  { key: 'underground-caves', label: 'Underground Caves' },
  { key: 'desert', label: 'Desert' },
  { key: 'coastal-area', label: 'Coastal Area' },
  { key: 'swamp', label: 'Swamp' },
  { key: 'plains', label: 'Plains' },
  { key: 'magical-realm', label: 'Magical Realm' },
  { key: 'ruins', label: 'Ruins' },
]
const registryAreaTypesPtBr: SystemConfig['areaTypes'] = [
  { key: 'city', label: 'Cidade' },
  { key: 'forest', label: 'Floresta' },
  { key: 'mountain-range', label: 'Cordilheira' },
  { key: 'underground-caves', label: 'Cavernas Subterrâneas' },
  { key: 'desert', label: 'Deserto' },
  { key: 'coastal-area', label: 'Região Costeira' },
  { key: 'swamp', label: 'Pântano' },
  { key: 'plains', label: 'Planícies' },
  { key: 'magical-realm', label: 'Reino Mágico' },
  { key: 'ruins', label: 'Ruínas' },
]

// Os campos de produto não vêm do artefato, mas nem todos são iguais nos dois locales: point-buy e
// proficiência são NÚMERO (mesmo objeto serve os dois), os ganchos são TEXTO e desdobraram por
// locale na US-101 — até lá seguiam em PT dentro do config en-US (US-99 "Fora do escopo").
function dnd5eProductFields(locale: Locale) {
  return {
    proficiency: dnd5eProficiency,
    pointBuy: { budget: 27 },
    initialAdventures: initialAdventuresByLocale[locale],
    tones: locale === 'pt-BR' ? registryTonesPtBr : registryTones,
    settings: locale === 'pt-BR' ? registrySettingsPtBr : registrySettings,
    areaTypes: locale === 'pt-BR' ? registryAreaTypesPtBr : registryAreaTypes,
  }
}
const dnd5eConfig: SystemConfig = { ...readSrdArtifact('en-US'), ...dnd5eProductFields('en-US') }
const dnd5eConfigPtBr: SystemConfig = { ...readSrdArtifact('pt-BR'), ...dnd5eProductFields('pt-BR') }

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
    //
    // US-101: os ganchos passaram a ter versão por idioma, e o Free herda a do MESMO locale que
    // ele está montando — senão o Free en-US voltaria a servir o convite em português.
    ...dnd5eProductFields(locale),
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
    update: { name: 'D&D 5e SRD', version: '5.1', config: dnd5eConfig, configLocales: { 'pt-BR': dnd5eConfigPtBr } },
    create: {
      id: 'system-dnd5e',
      name: 'D&D 5e SRD',
      version: '5.1',
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
