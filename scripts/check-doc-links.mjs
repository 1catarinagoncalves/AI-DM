#!/usr/bin/env node
// Varredura de links relativos nos .md de docs/ (US-78 / US-79).
//
// Reproduz a taxonomia do Contexto da US-78 e serve de gate de CI:
//   depth   - profundidade errada, resolução única  (../../ -> ../../../)   -> US-79
//   code    - alvo não existe, aponta para código                          -> US-79
//   md      - alvo não existe, aponta para .md                             -> US-78
//   ambig   - >1 candidato ao corrigir profundidade: exige decisão humana
//
// Uso:
//   node scripts/check-doc-links.mjs              # falha se houver QUALQUER quebrado
//   node scripts/check-doc-links.mjs --only-md    # falha só nos quebrados .md (aceite da US-78)
//   node scripts/check-doc-links.mjs --list       # imprime cada link quebrado
//   node scripts/check-doc-links.mjs --naive      # também mostra a contagem ingênua (sufixo :NN quebrado)

import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, posix, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DOCS = join(ROOT, "docs");

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

const files = (await mdFiles(DOCS)).sort();
const buckets = { depth: [], code: [], md: [], ambig: [] };
let total = 0;
let naiveExtra = 0; // quebrados só porque o sufixo :NN foi tratado como parte do path

for (const file of files) {
  const dir = dirname(file);
  const lines = stripCode(readFileSync(file, "utf8").split(/\r?\n/));

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

      if (existsSync(resolve(dir, stripped))) {
        if (stripped !== target) naiveExtra++; // válido só graças ao strip do :NN
        continue;
      }

      const where = `${posix.join(...relative(ROOT, file).split(sep))}:${lineNo + 1}`;
      const hit = { where, raw };
      const cands = depthCandidates(dir, stripped);

      if (cands.length > 1) buckets.ambig.push({ ...hit, cands: cands.length });
      else if (cands.length === 1) buckets.depth.push({ ...hit, fix: posix.join(...relative(ROOT, cands[0]).split(sep)) });
      else if (stripped.endsWith(".md")) buckets.md.push(hit);
      else buckets.code.push(hit);
    }
  }
}

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const broken = buckets.depth.length + buckets.code.length + buckets.md.length + buckets.ambig.length;

console.log(`docs/: ${files.length} arquivos .md`);
console.log(`Links relativos totais: ${total}`);
console.log(`Quebrados: ${broken}`);
console.log(`  profundidade errada, resolução única : ${String(buckets.depth.length).padStart(3)}  (US-79)`);
console.log(`  alvo não existe, aponta p/ código    : ${String(buckets.code.length).padStart(3)}  (US-79)`);
console.log(`  alvo não existe, aponta p/ .md       : ${String(buckets.md.length).padStart(3)}  (US-78)`);
console.log(`  ambíguos (>1 candidato)              : ${String(buckets.ambig.length).padStart(3)}`);
if (has("--naive")) console.log(`Contagem ingênua (sufixo :NN como path): ${broken + naiveExtra}  (= ${broken} + ${naiveExtra})`);

if (has("--list")) {
  for (const [name, items] of Object.entries(buckets)) {
    if (!items.length) continue;
    console.log(`\n[${name}]`);
    for (const i of items) {
      const extra = i.fix ? `  -> ${i.fix}` : i.cands ? `  (${i.cands} candidatos)` : "";
      console.log(`  ${i.where}  ${i.raw}${extra}`);
    }
  }
}

// Gate. --only-md = critério de aceite da US-78; default = US-79 (zero quebrados).
const gate = has("--only-md") ? buckets.md.length + buckets.ambig.length : broken;
if (gate > 0) {
  console.error(`\nFALHA: ${gate} link(s) quebrado(s) no gate${has("--only-md") ? " (.md + ambíguos)" : ""}.`);
  process.exit(1);
}
console.log("\nOK");
