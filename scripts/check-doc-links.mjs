#!/usr/bin/env node
// Varredura de links relativos e de nomes de arquivo nos .md de docs/ e nos .md
// de contexto listados em SCANNED_MD (US-78 / US-79 / US-82 / US-90).
//
// Reproduz a taxonomia do Contexto da US-78 e serve de gate de CI:
//   depth   - profundidade errada, resolução única  (../../ -> ../../../)   -> US-79
//   code    - alvo não existe, aponta para código                          -> US-79
//   md      - alvo não existe, aponta para .md                             -> US-78
//   ambig   - >1 candidato ao corrigir profundidade: exige decisão humana
//
// E o gate de nome de arquivo (US-82):
//   nome           - espaço/não-ASCII no basename, ou US-*.md fora da convenção
//   isento-linkado - alguém de fora passou a linkar docs/prompts/, a isenção caiu
//
// E o gate de identificador (US-88), só nos .md normativos do SCANNED_MD:
//   ghost          - nome camelCase citado em prosa que não existe em fonte nenhum
//
// Uso:
//   node scripts/check-doc-links.mjs              # falha se houver QUALQUER quebrado
//   node scripts/check-doc-links.mjs --only-md    # falha só nos quebrados .md (aceite da US-78)
//   node scripts/check-doc-links.mjs --list       # imprime cada link quebrado
//   node scripts/check-doc-links.mjs --naive      # também mostra a contagem ingênua (sufixo :NN quebrado)
//   node scripts/check-doc-links.mjs --fix        # reescreve os do bucket `depth` (US-79)
//   node scripts/check-doc-links.mjs [arquivo...] # varre só esses .md, em vez de docs/ + raiz
//
// SEM --fix o script nunca escreve. O padrão precisa ser somente-leitura porque
// ele é passo de CI (US-80): um gate que edita arquivo sozinho não é gate.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, dirname, join, posix, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");

// US-79: os .md de contexto da raiz entram na varredura. Lista explícita, não
// glob de `*.md` na raiz: glob varreria qualquer rascunho solto ali e o gate de
// nome da US-82 (espaço/não-ASCII) reprovaria um arquivo que não é documentação.
// US-90: deixou de ser só a raiz (o README de evals entrou), daí o nome novo.
// Entradas sempre com `/`: `join()` normaliza na varredura e `rel()` normaliza na
// comparação, então nenhuma entrada futura depende do separador do sistema.
const SCANNED_MD = ["AGENTS.md", "CLAUDE.md", "README.md", "evals/README.md"];

// US-90: a lista é comparada com `relative(ROOT, abs)`, que no Windows devolve
// `evals\README.md` e nunca casaria com a entrada acima — o arquivo seria varrido
// mas ficaria fora do `isWritable`, e o --fix pararia de reescrevê-lo em silêncio.
const rel = (abs) => relative(ROOT, abs).split(sep).join(posix.sep);

// Só links inline: [texto](destino). Reference-style ([a]: url) não é usado no repo.
const LINK_RE = /\[(?:[^\]\\]|\\.)*\]\(\s*([^)\s]+)/g;

/**
 * Neutraliza code fence e code span, preservando a numeração de linha.
 * Um `[texto](caminho.md)` dentro de backticks é sintaxe ilustrada, não link:
 * as specs documentam o formato de link e não devem ser cobradas por isso.
 */
function stripCode(lines) {
  let inFence = false;
  return lines.map((line) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return "";
    }
    if (inFence) return "";
    return line.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));
  });
}

// Convenção file:line do CLAUDE.md — `kanban-server.js:88-91`, `ingest.mjs:122`.
const LINE_SUFFIX_RE = /:\d+(?:-\d+)?$/;

async function mdFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      out.push(...(await mdFiles(p)));
    } else if (e.name.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

/** Candidatos ao variar a profundidade de `../`, para diagnosticar path errado. */
function depthCandidates(fromDir, target) {
  const bare = target.replace(/^(?:\.\.\/)+/, "").replace(/^\.\//, "");
  const found = [];
  for (let up = 0; up <= 6; up++) {
    const cand = resolve(fromDir, "../".repeat(up) + bare);
    // Não sair do repo, e não aceitar o próprio caminho original como "correção".
    if (!cand.startsWith(ROOT + sep)) break;
    if (existsSync(cand)) found.push(cand);
  }
  return [...new Set(found)];
}

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

// Argumento posicional restringe a varredura a arquivos específicos. Existe para
// o teste de regressão do --fix poder rodar sobre uma fixture sem reescrever o
// repo inteiro; de quebra serve para checar um .md só.
const picked = argv.filter((a) => !a.startsWith("--")).map((a) => resolve(ROOT, a));
const files = picked.length
  ? picked.sort()
  : [...(await mdFiles(DOCS)), ...SCANNED_MD.map((f) => join(ROOT, f)).filter(existsSync)].sort();

// Fronteira do modo de escrita (US-79): docs/ + os nomes de SCANNED_MD. O resto
// do repo é varrível via posicional, mas nunca reescrito — nenhum código de
// produção é tocado, mesmo que alguém aponte o --fix para ele.
const isWritable = (abs) => abs.startsWith(DOCS + sep) || SCANNED_MD.includes(rel(abs));

// --- US-82: convenção de nome de arquivo -----------------------------------
// docs/prompts/ é isento (despejos de prompt ad-hoc, US-81 decidiu não arrumar).
// A isenção é contada no resumo e vigiada pelo trip-wire abaixo: ela se justifica
// por "ninguém linka aquilo", e o dia em que alguém linkar o gate avisa.
const isPrompts = (abs) => relative(DOCS, abs).startsWith(`prompts${sep}`);

// Exceções deliberadas (mesma razão do filtro em tools/kanban/kanban-server.js:50):
//   US-TEMPLATE.md          - maiúscula proposital, é template e não story
//   US-76-…extractOpening…  - camelCase é o nome real da função, achatar perde informação
const NAME_ALLOW = new Set([
  "US-TEMPLATE.md",
  "US-76-consertar-fake-teste-extractOpeningEntities.md",
]);
const US_NAME_RE = /^US-[0-9]+[a-z]?-[a-z0-9-]+\.md$/;

const nameHits = [];
for (const file of files) {
  if (isPrompts(file)) continue;
  const base = basename(file); // basename, não o path: o repo vive em ".../Desktop/AI DM/"
  if (NAME_ALLOW.has(base)) continue;
  const where = rel(file);
  // Fora de \x20-\x7E pega acento em NFC e a combining cedilla do NFD — não precisa normalizar.
  // O espaço (\x20) está *dentro* da faixa, por isso os dois testes.
  if (base.includes(" ") || /[^\x20-\x7E]/.test(base)) {
    nameHits.push({ where, rule: "regra 1: espaço ou byte não-ASCII no nome" });
  } else if (base.startsWith("US-") && !US_NAME_RE.test(base)) {
    nameHits.push({ where, rule: "regra 2: fora de ^US-[0-9]+[a-z]?-[a-z0-9-]+\\.md$" });
  }
}

// --- US-88: identificador citado em prosa que não existe no fonte ----------
// Roda só nos .md normativos do SCANNED_MD. No corpus `docs/`, 21% dos nomes
// cobrados não existem no fonte e quase todos são proposta legítima de US
// (medido em 28/07/2026) — gate ali reprovaria documento correto, e gate com
// falso positivo é gate que alguém desliga.
//
// Cláusula de morte (US-88, questão 1): se ao fim da Fase 1 este bucket nunca
// tiver acendido em CI, apague a checagem e o GHOST_ALLOW.
const SRC_DIRS = ["apps", "packages", "scripts", "evals"];
const SRC_EXT = /\.(?:tsx?|mjs|js|prisma|json|yaml)$/;
// dist/ é build do próprio src (só duplica) e apps/api/src/generated/prisma é
// código gerado com milhares de nomes: identificador que só existe lá não é API
// do projeto, e indexá-lo criaria falso-negativo silencioso.
const SRC_SKIP = new Set(["node_modules", "dist", "generated"]);

// camelCase com pelo menos uma maiúscula. A maiúscula obrigatória é o que mata o
// ruído: exclui `pnpm`, `tsc`, `nest`, `dotenv` e todo caminho/flag (têm `/`, `.`
// ou `-`). Nome PascalCase fica de fora de propósito — colide com tipo, componente
// e palavra em inglês (`WebSocket` no meio de prosa).
const CAMEL_RE = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/;

// US-88: nomes citados na doc justamente por NÃO existirem. Chave = identificador,
// valor = motivo. Entrada que voltar a existir no fonte vira aviso, não erro — por
// isso Map e não Set: o motivo precisa chegar ao relatório, comentário não chega.
const GHOST_ALLOW = new Map([
  ["rollDiceTool", "AGENTS.md :111 e :231 — tool morta apagada em 27/07/2026, citada como exemplo do defeito"],
  ["getRule", "AGENTS.md :227 — roadmap escrito no presente, declarado inexistente no próprio bloco"],
  ["advanceQuest", "AGENTS.md :227 — idem"],
  ["recallMemory", "AGENTS.md :227 — idem"],
  ["getCharacterState", "AGENTS.md :227 — idem"],
  ["addEventLog", "AGENTS.md :227 — idem"],
]);

// Este arquivo e o seu teste ficam fora do índice: os dois moram em `scripts/` e
// carregam identificador como DADO, não como API — as chaves do GHOST_ALLOW aqui,
// os nomes de fixture lá. Indexados, as 6 entradas deliberadas "existiriam no
// fonte" (aviso aceso sempre) e o nome inventado da fixture passaria no gate que
// ela existe para reprovar. Teto conhecido: identificador que só exista nestes
// dois arquivos é invisível ao gate.
const SRC_SELF = new Set([import.meta.filename, import.meta.filename.replace(/\.mjs$/, ".test.mjs")]);

/** Todo o fonte do projeto concatenado. A verificação é substring, não AST. */
async function srcIndex(dir) {
  const parts = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SRC_SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (SRC_SELF.has(p)) continue;
    if (e.isDirectory()) parts.push(await srcIndex(p));
    else if (SRC_EXT.test(e.name)) parts.push(readFileSync(p, "utf8"));
  }
  return parts.join("\n");
}

/**
 * Tokens em backtick simples, fora de fence — o inverso da máscara de stripCode().
 * Lá o que interessa é o que sobra (prosa); aqui é justamente o que ela descarta.
 */
function codeSpans(lines) {
  let inFence = false;
  const out = [];
  for (const [i, line] of lines.entries()) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) out.push({ lineNo: i + 1, token: m[1] });
  }
  return out;
}

// Posicional entra no escopo: é como o teste de regressão roda sobre uma fixture
// sem precisar de flag só-para-teste. `pnpm docs:links` não passa posicional, então
// o gate de CI continua vendo apenas SCANNED_MD.
const ghostScope = picked.length ? files : files.filter((f) => SCANNED_MD.includes(rel(f)));
const ghostHits = [];
const ghostStale = [];

if (ghostScope.length) {
  const src = (
    await Promise.all(SRC_DIRS.map((d) => join(ROOT, d)).filter(existsSync).map(srcIndex))
  ).join("\n");

  for (const file of ghostScope) {
    const where = rel(file);
    for (const { lineNo, token } of codeSpans(readFileSync(file, "utf8").split(/\r?\n/))) {
      if (!CAMEL_RE.test(token) || GHOST_ALLOW.has(token)) continue;
      if (!src.includes(token)) ghostHits.push({ where: `${where}:${lineNo}`, token });
    }
  }
  // Contra o mesmo índice já em memória: um filter no fim, sem reler o disco.
  for (const [nome, motivo] of GHOST_ALLOW) if (src.includes(nome)) ghostStale.push({ nome, motivo });
}

const exemptCount = files.filter(isPrompts).length;
const exemptLinked = [];

const buckets = { depth: [], code: [], md: [], ambig: [] };
const fixed = [];
let total = 0;
let naiveExtra = 0; // quebrados só porque o sufixo :NN foi tratado como parte do path

for (const file of files) {
  const dir = dirname(file);
  const content = readFileSync(file, "utf8");
  const rawLines = content.split(/\r?\n/);
  const lines = stripCode(rawLines);
  // Offset absoluto de cada linha, medido nas linhas ORIGINAIS: stripCode zera a
  // linha de fence e aí o comprimento deixa de bater. A máscara decide o que é
  // link; quem localiza no arquivo é isto. O EOL some no split, então avança 1 ou
  // 2 conforme o que estiver no conteúdo — CRLF sobrevive à reescrita.
  const lineStart = [];
  for (let i = 0, at = 0; i < rawLines.length; i++) {
    lineStart.push(at);
    at += rawLines[i].length + (content[at + rawLines[i].length] === "\r" ? 2 : 1);
  }
  const edits = [];

  for (const [lineNo, line] of lines.entries()) {
    for (const m of line.matchAll(LINK_RE)) {
      const raw = m[1];
      // Externos, âncoras internas, protocolos, root-absolute: fora de escopo.
      if (/^(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|#|\/)/i.test(raw)) continue;

      total++;
      const noAnchor = raw.split("#")[0];
      if (!noAnchor) continue;

      const target = decodeURIComponent(noAnchor);
      const stripped = target.replace(LINE_SUFFIX_RE, "");

      const abs = resolve(dir, stripped);
      if (existsSync(abs)) {
        if (stripped !== target) naiveExtra++; // válido só graças ao strip do :NN
        // Trip-wire da isenção: link de fora apontando para docs/prompts/.
        // O segundo teste evita acusar link interno da própria pasta isenta.
        if (isPrompts(abs) && !isPrompts(file)) {
          exemptLinked.push({
            where: `${rel(file)}:${lineNo + 1}`,
            raw,
            alvo: rel(abs),
          });
        }
        continue;
      }

      const where = `${rel(file)}:${lineNo + 1}`;
      const hit = { where, raw };
      const cands = depthCandidates(dir, stripped);

      if (cands.length > 1) {
        // Ambíguo nunca é reescrito: com >1 candidato a escolha é humana.
        buckets.ambig.push({ ...hit, cands: cands.length });
      } else if (cands.length === 1) {
        const rel = posix.join(...relative(dir, cands[0]).split(sep));
        // Sufixo :NN e âncora #secao voltam intactos ao fim do destino.
        const newRaw = (rel.startsWith("..") ? rel : `./${rel}`) + target.slice(stripped.length) + raw.slice(noAnchor.length);
        const canWrite = has("--fix") && isWritable(file) && !/\s/.test(newRaw);
        if (canWrite) {
          const start = lineStart[lineNo] + m.index + m[0].length - raw.length;
          edits.push({ start, end: start + raw.length, newRaw });
          fixed.push({ where, raw, fix: newRaw });
        } else {
          buckets.depth.push({ ...hit, fix: rel(cands[0]) });
        }
      } else if (stripped.endsWith(".md")) buckets.md.push(hit);
      else buckets.code.push(hit);
    }
  }

  // De trás para frente: reescrever o link N invalidaria os offsets de N-1.
  // Só o trecho do destino é trocado — corpo, indentação e EOL ficam byte a byte.
  if (edits.length) {
    let out = content;
    for (const e of edits.reverse()) out = out.slice(0, e.start) + e.newRaw + out.slice(e.end);
    writeFileSync(file, out);
  }
}

const broken = buckets.depth.length + buckets.code.length + buckets.md.length + buckets.ambig.length;

console.log(`docs/ + ${SCANNED_MD.join(", ")}: ${files.length} arquivos .md`);
if (has("--fix")) console.log(`Reescritos: ${fixed.length}`);
console.log(`Links relativos totais: ${total}`);
console.log(`Quebrados: ${broken}`);
console.log(`  profundidade errada, resolução única : ${String(buckets.depth.length).padStart(3)}  (US-79)`);
console.log(`  alvo não existe, aponta p/ código    : ${String(buckets.code.length).padStart(3)}  (US-79)`);
console.log(`  alvo não existe, aponta p/ .md       : ${String(buckets.md.length).padStart(3)}  (US-78)`);
console.log(`  ambíguos (>1 candidato)              : ${String(buckets.ambig.length).padStart(3)}`);
if (has("--naive")) console.log(`Contagem ingênua (sufixo :NN como path): ${broken + naiveExtra}  (= ${broken} + ${naiveExtra})`);
console.log(`Nome fora da convenção: ${nameHits.length}  (US-82)`);
console.log(`  linkados apesar de isentos           : ${String(exemptLinked.length).padStart(3)}  (US-82)`);
console.log(`  isentos (docs/prompts/)              : ${String(exemptCount).padStart(3)}  (fora do gate)`);
console.log(`Identificador inexistente no fonte: ${ghostHits.length}  (US-88, em ${ghostScope.length} arquivo(s))`);

// Aviso, não erro: a doc está certa, quem envelheceu foi o allowlist. Derrubar o
// CI por isto ensinaria a esvaziar o GHOST_ALLOW no susto — o oposto do que ele
// existe para fazer. Sai sempre, sem depender do --list.
if (ghostStale.length) {
  console.log(`\n[ghost-allow obsoleto] ${ghostStale.length} entrada(s) voltaram a existir no fonte — remova do GHOST_ALLOW:`);
  for (const i of ghostStale) console.log(`  ${i.nome}  (${i.motivo})`);
}

if (has("--list")) {
  if (fixed.length) {
    console.log("\n[reescritos]");
    for (const i of fixed) console.log(`  ${i.where}  ${i.raw}  -> ${i.fix}`);
  }
  for (const [name, items] of Object.entries(buckets)) {
    if (!items.length) continue;
    console.log(`\n[${name}]`);
    for (const i of items) {
      const extra = i.fix ? `  -> ${i.fix}` : i.cands ? `  (${i.cands} candidatos)` : "";
      console.log(`  ${i.where}  ${i.raw}${extra}`);
    }
  }
  // Hits de nome têm outra forma que os de link; bloco próprio sai mais barato
  // que generalizar a impressão acima.
  if (nameHits.length) {
    console.log("\n[nome]");
    for (const i of nameHits) console.log(`  ${i.where}  ${i.rule}`);
  }
  if (exemptLinked.length) {
    console.log("\n[isento-linkado]");
    for (const i of exemptLinked) console.log(`  ${i.where}  ${i.raw}  -> ${i.alvo}`);
  }
  if (ghostHits.length) {
    console.log("\n[ghost]");
    for (const i of ghostHits) console.log(`  ${i.where}  ${i.token}`);
  }
}

// Gate. --only-md = critério de aceite da US-78 (só links .md; nome fica de fora
// para não reescrever aquele aceite); default = US-79 + US-82.
const gate = has("--only-md")
  ? buckets.md.length + buckets.ambig.length
  : broken + nameHits.length + exemptLinked.length + ghostHits.length;
if (gate > 0) {
  if (has("--only-md")) console.error(`\nFALHA: ${gate} link(s) quebrado(s) no gate (.md + ambíguos).`);
  else {
    console.error(`\nFALHA: ${gate} problema(s) no gate.`);
    if (broken) console.error(`  ${broken} link(s) quebrado(s).`);
    if (nameHits.length) console.error(`  ${nameHits.length} arquivo(s) com nome fora da convenção (rode com --list).`);
    if (ghostHits.length) {
      console.error(
        `  ${ghostHits.length} identificador(es) citado(s) em .md normativo sem existir no fonte (rode com --list).\n` +
          `    Corrija a linha. Só allowliste em GHOST_ALLOW se a citação for deliberada — nome que a doc cita JUSTAMENTE por não existir.`,
      );
    }
    if (exemptLinked.length) {
      console.error(
        `  ${exemptLinked.length} link(s) para docs/prompts/: a isenção valia enquanto ninguém linkasse.\n` +
          `    Renomeie o alvo (US-78) e remova docs/prompts/ da isenção em ${posix.join("scripts", "check-doc-links.mjs")}.`,
      );
    }
  }
  process.exit(1);
}
console.log("\nOK");
