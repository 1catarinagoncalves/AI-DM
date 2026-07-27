#!/usr/bin/env node
// Varredura de links relativos e de nomes de arquivo nos .md de docs/ e nos três
// .md de contexto da raiz (US-78 / US-79 / US-82).
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
const ROOT_MD = ["AGENTS.md", "CLAUDE.md", "README.md"];

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
  : [...(await mdFiles(DOCS)), ...ROOT_MD.map((f) => join(ROOT, f)).filter(existsSync)].sort();

// Fronteira do modo de escrita (US-79): docs/ + os três nomes de ROOT_MD. O resto
// do repo é varrível via posicional, mas nunca reescrito — nenhum código de
// produção é tocado, mesmo que alguém aponte o --fix para ele.
const isWritable = (abs) => abs.startsWith(DOCS + sep) || ROOT_MD.includes(relative(ROOT, abs));

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
  const where = posix.join(...relative(ROOT, file).split(sep));
  // Fora de \x20-\x7E pega acento em NFC e a combining cedilla do NFD — não precisa normalizar.
  // O espaço (\x20) está *dentro* da faixa, por isso os dois testes.
  if (base.includes(" ") || /[^\x20-\x7E]/.test(base)) {
    nameHits.push({ where, rule: "regra 1: espaço ou byte não-ASCII no nome" });
  } else if (base.startsWith("US-") && !US_NAME_RE.test(base)) {
    nameHits.push({ where, rule: "regra 2: fora de ^US-[0-9]+[a-z]?-[a-z0-9-]+\\.md$" });
  }
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
            where: `${posix.join(...relative(ROOT, file).split(sep))}:${lineNo + 1}`,
            raw,
            alvo: posix.join(...relative(ROOT, abs).split(sep)),
          });
        }
        continue;
      }

      const where = `${posix.join(...relative(ROOT, file).split(sep))}:${lineNo + 1}`;
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
          buckets.depth.push({ ...hit, fix: posix.join(...relative(ROOT, cands[0]).split(sep)) });
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

console.log(`docs/ + ${ROOT_MD.join(", ")}: ${files.length} arquivos .md`);
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
}

// Gate. --only-md = critério de aceite da US-78 (só links .md; nome fica de fora
// para não reescrever aquele aceite); default = US-79 + US-82.
const gate = has("--only-md")
  ? buckets.md.length + buckets.ambig.length
  : broken + nameHits.length + exemptLinked.length;
if (gate > 0) {
  if (has("--only-md")) console.error(`\nFALHA: ${gate} link(s) quebrado(s) no gate (.md + ambíguos).`);
  else {
    console.error(`\nFALHA: ${gate} problema(s) no gate.`);
    if (broken) console.error(`  ${broken} link(s) quebrado(s).`);
    if (nameHits.length) console.error(`  ${nameHits.length} arquivo(s) com nome fora da convenção (rode com --list).`);
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
