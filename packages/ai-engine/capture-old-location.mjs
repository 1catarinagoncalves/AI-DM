// Captura o baseline ANTIGO (pré-US-71): roda com o dist construído a partir de HEAD
// (antes das edições da US-71) e grava `system` + `turnState` da cena de replay em
// location-old.snapshot.json, o braço ANTIGO do A/B. Mesmo papel do old-system.snapshot.txt.
// Uso (pasta packages/ai-engine, com o dist pré-US-71 buildado):
//   node capture-old-location.mjs
import { buildDmSystemPrompt, buildTurnStateBlock } from './dist/index.js'
import { writeFileSync } from 'node:fs'
import { SCENE } from './location-scene.mjs'

const system = buildDmSystemPrompt(SCENE.character)
const turnState = buildTurnStateBlock(SCENE.turnStateArgs)
writeFileSync(SCENE.oldSnapshotPath, JSON.stringify({ system, turnState }, null, 2), 'utf8')
console.log(`OLD snapshot: ${SCENE.oldSnapshotPath} (system ${system.length}c, turnState ${turnState.length}c)`)
