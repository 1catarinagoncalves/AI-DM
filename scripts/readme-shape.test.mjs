// Guard de drift da forma do sistema (US-83, camada 3).
//
// O gate de links (`pnpm docs:links`) pega o fato que MORREU: a afirmação
// continua no README e o arquivo sumiu de baixo dela. Ele não pega o fato que
// ficou INCOMPLETO — um módulo novo em apps/api/src/, uma pasta de topo nova,
// um pacote novo. Todos os caminhos do README continuam existindo e o diagrama
// de Arquitetura passa a mentir por omissão. Foi assim que o README anterior
// apodreceu por um mês inteiro sem nada no repo avisar.
//
// Const hardcoded (não snapshot): snapshot convida ao reflexo `-u`, que regrava
// sem ninguém olhar — e "olhar" é o produto inteiro deste teste. Colar o hash
// novo À MÃO É o ato de ter reolhado a seção Arquitetura. Mesmo idioma do
// packages/ai-engine/src/rubric-drift.test.ts (US-36).
//
// Hasheia FORMA, nunca conteúdo de arquivo: conteúdo muda toda semana e treina
// a pessoa a colar hash no automático, que é o fracasso do mecanismo.
//
// Ao mudar a forma de propósito:
//   1. revise a seção "Arquitetura" do README.md (diagrama, parágrafo por
//      componente, tabela "Onde o estado vive");
//   2. cole o hash novo (a mensagem de erro o imprime) em REVIEWED_SHAPE_HASH.
// Revisado em 29/07/2026 (US-91): a forma mudou por UMA entrada — a pasta de topo
// `graphify-out/`, que entrou com a instalação do graphify. Não é componente de
// runtime (não roda nada em produção, é grafo derivado reconstruído pelo hook de
// post-commit), então o diagrama de Arquitetura NÃO ganhou nó: pôr artefato de
// build num flowchart de componentes é outra mentira. Ganhou uma linha no
// *Mapa de leitura* do README, que é onde mora ferramenta de navegação.
// Revisado em 2026-08-22: `apps/api/src` ganhou `adventure-generation` — o motor
// determinístico (LGMRD: registro/conteúdo/orçamento de encontro) que
// `adventure.service.ts` já intercalava com as chamadas de IA desde a US-147/US-150,
// sem que o hash tivesse sido atualizado então (drift acumulado, achado ao mexer na
// US-169). A seção Arquitetura ganhou uma frase no bullet de `apps/api` citando a
// pasta; sem nó novo no diagrama (é módulo interno do Game Server, não um serviço à
// parte) e sem linha nova na tabela "Onde o estado vive" (não é dono de tabela
// própria — persiste em `Adventure`/`Quest`, já cobertos ali).
const REVIEWED_SHAPE_HASH = '2c1c8f7ba03f5075ef867bdf23278431e79eef34507154d39385638ead3304a0'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

/** Nomes ordenados dentro de `rel`, ou `(ausente)` se a pasta não existe. */
function entries(rel, { dirsOnly = false, skip = [] } = {}) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return '(ausente)'
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => !dirsOnly || e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.') && n !== 'node_modules' && !skip.includes(n))
    .sort()
    .join(' ')
}

function shape() {
  return [
    // Pastas de topo: o diagrama de componentes desenha apps/ e packages/, e o
    // mapa de leitura aponta para docs/ e evals/.
    `raiz: ${entries('.', { dirsOnly: true })}`,
    `apps: ${entries('apps', { dirsOnly: true })}`,
    `packages: ${entries('packages', { dirsOnly: true })}`,
    // Módulos do Game Server = os nós do diagrama. `generated` é o client do
    // Prisma: gitignored e criado pelo `prisma generate`, então entra e sai
    // conforme a máquina — incluí-lo faria o teste falhar por motivo errado.
    `apps/api/src: ${entries('apps/api/src', { dirsOnly: true, skip: ['generated'] })}`,
    // Apagada em 27/07/2026 (só tinha código morto). Se voltar, o README precisa
    // dizer por que uma tool passou a viver fora da API.
    `packages/ai-engine/src/tools: ${entries('packages/ai-engine/src/tools')}`,
  ].join('\n')
}

test('a forma do sistema não mudou sem revisão da seção Arquitetura do README', () => {
  const cur = createHash('sha256').update(shape()).digest('hex')
  assert.equal(
    cur,
    REVIEWED_SHAPE_HASH,
    `A forma do sistema mudou:\n\n${shape()}\n\n` +
      `Revise a seção "Arquitetura" do README.md e cole o hash novo em ` +
      `scripts/readme-shape.test.mjs → REVIEWED_SHAPE_HASH: ${cur}`,
  )
})
