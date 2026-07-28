// Teste de regressão do modo de escrita (US-79). `node --test scripts/`.
//
// A fixture nasce e morre dentro de docs/: depthCandidates() só aceita candidato
// sob a raiz do repo, então uma fixture em tmp não teria alvo para resolver. Por
// isso o script ganhou argumento posicional — sem ele, este teste reescreveria
// os 743 links do repo em vez do arquivo de mentira.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "scripts", "check-doc-links.mjs");

/** Roda o checker restrito a `relPath` e devolve o stdout. */
function runChecker(relPath, ...flags) {
  return execFileSync(process.execPath, [SCRIPT, relPath, ...flags], { cwd: ROOT, encoding: "utf8" });
}

/** Cria a fixture, roda `fn`, e apaga o arquivo aconteça o que acontecer. */
function withFixture(relPath, content, fn) {
  const abs = join(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  try {
    return fn(abs);
  } finally {
    rmSync(abs, { force: true });
  }
}

/**
 * Corpo da fixture com o prefixo `../` dado. As 3 ocorrências são iguais de
 * propósito: só a primeira é link de verdade — as outras duas cobrem a máscara
 * de fence e de code span, que é o caso que a própria US-79 dispara.
 * CRLF de propósito: o teste do EOL depende disso.
 */
const corpo = (prefixo) =>
  [
    "# fixture",
    "",
    `Link quebrado: [api.ts](${prefixo}apps/web/src/lib/api.ts)`,
    "",
    "```",
    `[api.ts](${prefixo}apps/web/src/lib/api.ts)`,
    "```",
    "",
    `Code span: \`[api.ts](${prefixo}apps/web/src/lib/api.ts)\``,
    "",
  ].join("\r\n");

// Três níveis abaixo da raiz: é a profundidade que gerou os 82 quebrados da US-79.
const FIXTURE = "docs/sdlc/01-requisitos/zz-fixture-us79-fix.md";
const ANTES = corpo("../../");
const DEPOIS = corpo("../../../");

test("--fix reescreve só a profundidade do link, sem tocar no resto do arquivo", () => {
  withFixture(FIXTURE, ANTES, (abs) => {
    const out = runChecker(FIXTURE, "--fix");
    assert.match(out, /Reescritos: 1/);
    assert.match(out, /profundidade errada, resolução única :\s+0/);

    const depois = readFileSync(abs, "utf8");
    // `String.replace` com string troca só a PRIMEIRA ocorrência — que é
    // exatamente o esperado: as cópias no fence e no code span continuam
    // `../../`. Comparar o corpo inteiro prova as duas coisas de uma vez.
    assert.equal(depois, ANTES.replace("../../apps", "../../../apps"));
    assert.ok(!/[^\r]\n/.test(depois), "EOL CRLF virou LF");
  });
});

test("sem --fix o script não escreve nada", () => {
  withFixture(FIXTURE, ANTES, (abs) => {
    assert.throws(() => runChecker(FIXTURE), /Command failed/); // gate falha: 1 quebrado
    assert.equal(readFileSync(abs, "utf8"), ANTES);
  });
});

// --- US-88: gate de identificador inexistente -------------------------------
// A fixture entra no escopo por ser posicional (em produção o gate só vê ROOT_MD).
const GHOST_FIXTURE = "docs/sdlc/01-requisitos/zz-fixture-us88-ghost.md";

test("identificador camelCase que não existe em fonte nenhum reprova o gate", () => {
  const corpo = ["# fixture", "", "Chame `naoExisteEmLugarNenhum` antes de narrar.", ""].join("\n");
  withFixture(GHOST_FIXTURE, corpo, () => {
    assert.throws(() => runChecker(GHOST_FIXTURE, "--list"), (err) => {
      assert.match(err.stdout, /Identificador inexistente no fonte: 1/);
      assert.match(err.stdout, /zz-fixture-us88-ghost\.md:3\s+naoExisteEmLugarNenhum/);
      return true;
    });
  });
});

test("identificador real, entrada do GHOST_ALLOW e nome dentro de fence passam", () => {
  const corpo = [
    "# fixture",
    "",
    "Estado local em `useState`, e `advanceQuest` está no GHOST_ALLOW.",
    "",
    "```ts",
    "const x = naoExisteEmLugarNenhum()",
    "```",
    "",
    // Sem maiúscula e com ponto/traço: fora da regex de propósito.
    "Nada disto é cobrado: `pnpm`, `apps/web`, `package.json`, `@ai-sdk/react`.",
    "",
  ].join("\n");
  withFixture(GHOST_FIXTURE, corpo, () => {
    const out = runChecker(GHOST_FIXTURE, "--list");
    assert.match(out, /Identificador inexistente no fonte: 0/);
    assert.match(out, /\nOK/);
  });
});

test("entrada do GHOST_ALLOW que voltou a existir no fonte vira aviso, não erro", () => {
  // Fixture de FONTE, não de doc: é o índice que precisa passar a conter o nome.
  const revivida = "scripts/zz-fixture-us88-revivida.mjs";
  withFixture(revivida, "export const advanceQuest = () => {}\n", () => {
    withFixture(GHOST_FIXTURE, "# fixture\n", () => {
      const out = runChecker(GHOST_FIXTURE);
      assert.match(out, /\[ghost-allow obsoleto\] 1 entrada/);
      assert.match(out, /advanceQuest/);
      assert.match(out, /\nOK/); // a doc está certa: quem envelheceu foi o allowlist
    });
  });
});

test("--fix não escreve fora de docs/ e dos três .md da raiz", () => {
  // A fronteira do modo de escrita da US-79. packages/shared/ está dois níveis
  // abaixo da raiz, então aqui quem quebra é `../../../` — a mesma fixture com o
  // prefixo certo para esta profundidade. Se o guard cair, o teste acusa.
  const fora = "packages/shared/zz-fixture-us79-fora.md";
  withFixture(fora, DEPOIS, (abs) => {
    assert.throws(() => runChecker(fora, "--fix"), /Command failed/);
    assert.equal(readFileSync(abs, "utf8"), DEPOIS, "arquivo fora de docs/ foi reescrito");
  });
});
