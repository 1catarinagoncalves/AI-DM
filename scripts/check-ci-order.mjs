#!/usr/bin/env node
// Guard de ordem de steps do CI — regressão do bug de 07/09/2026: "Sync do
// dataset SRD" rodava DEPOIS de "Gate de docs", e checkout limpo sempre batia
// ENOENT nos links de US-203/US-207/US-211/US-215 pra scripts/srd/_data/
// (gitignored). Sem parser de YAML de propósito: só a ORDEM dos `- name:`
// interessa, e regex aqui é mais barato que puxar uma dep só pra isto.
//
// Toda entrada em CONSTRAINTS precisa do motivo ao lado, senão vira depósito
// (mesmo espírito do knip.jsonc, US-89).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CI_YML = resolve(import.meta.dirname, "..", ".github", "workflows", "ci.yml");

const CONSTRAINTS = [
  {
    before: "Sync do dataset SRD",
    after: "Gate de docs",
    reason:
      "scripts/srd/_data/ é gitignored; US-203/US-207/US-211/US-215 linkam direto " +
      "pros JSON de lá. Sem o sync antes, checkout limpo quebra esses links.",
  },
];

const text = readFileSync(CI_YML, "utf8");
const stepNames = [...text.matchAll(/^\s*-\s*name:\s*(.+)$/gm)].map((m) => m[1].trim());

const problems = [];
for (const { before, after, reason } of CONSTRAINTS) {
  const beforeIdx = stepNames.indexOf(before);
  const afterIdx = stepNames.indexOf(after);
  if (beforeIdx === -1 || afterIdx === -1) {
    problems.push(`step não encontrado: "${beforeIdx === -1 ? before : after}" (renomeado?)`);
    continue;
  }
  if (beforeIdx > afterIdx) {
    problems.push(`"${before}" precisa vir ANTES de "${after}" — ${reason}`);
  }
}

if (problems.length) {
  console.error(`FALHA: ${problems.length} problema(s) de ordem em .github/workflows/ci.yml.`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(`OK: ${CONSTRAINTS.length} restrição(ões) de ordem satisfeita(s).`);
