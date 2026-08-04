// Teste de regressão do gate de string literal (US-102). `node --test scripts/`.
//
// A fixture nasce e morre em os.tmpdir(), NUNCA dentro de apps/web/src: ela é um
// .tsx de verdade e o corpus do gate é .tsx — uma fixture dentro do corpus seria
// varrida pela execução normal do gate e o CI reprovaria por causa do teste.
// (O gate da US-88 tem o defeito espelhado: lá o script se lia a si mesmo.)

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "scripts", "check-jsx-literals.mjs");

/** Roda o gate restrito aos arquivos dados. Devolve saída e código, sem lançar. */
function runGate(...paths) {
  const r = spawnSync(process.execPath, [SCRIPT, ...paths], { cwd: ROOT, encoding: "utf8" });
  return { out: r.stdout + r.stderr, code: r.status };
}

/** Escreve os arquivos num tmpdir, roda `fn`, e apaga a pasta aconteça o que acontecer. */
function withFixture(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "us102-"));
  try {
    return fn(Object.entries(files).map(([name, content]) => {
      const abs = join(dir, name);
      writeFileSync(abs, content);
      return abs;
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Tudo o que o gate TEM de reprovar, um por bucket (critérios de aceite da US-102).
const SUJO = `
export function Tela({ cond, cn, x, onDelete, setError }) {
  return (
    <div className="flex flex-col gap-2">
      <p>Texto novo em português</p>
      <button aria-label="Fechar" onClick={() => { if (window.confirm('Apagar isto?')) onDelete() }}>
        {cond ? 'A iniciar...' : 'Iniciar aventura'}
      </button>
      <span className={cn('flex gap-2', x)} onClick={() => setError('Erro ao salvar')} />
    </div>
  )
}
`;

// Tudo o que o gate NÃO pode reprovar: dicionário, utilitário Tailwind, token curto,
// separador de pontuação e o alt="" de imagem decorativa.
const LIMPO = `
export function Tela({ t, cn, x, items, scene }) {
  return (
    <div className="flex flex-col gap-2" data-variant="primary">
      <p>{t('home.titulo')}</p>
      <img src={scene} alt="" aria-hidden />
      <span className={cn('flex gap-2', x)}>{items.join(' · ')}</span>
      <span aria-label={t('home.fechar')}>{' — '}</span>
    </div>
  )
}
`;

test("reprova texto em JSX, atributo visível, prosa em {…} e literal da periferia", () => {
  withFixture({ "Tela.tsx": SUJO }, ([abs]) => {
    const { out, code } = runGate(abs);
    assert.equal(code, 1, `esperava exit 1, veio ${code}:\n${out}`);
    assert.match(out, /jsx-text.+Texto novo em português/);
    assert.match(out, /atributo.+Fechar/);
    assert.match(out, /expressão.+Iniciar aventura/);
    assert.match(out, /periferia.+Apagar isto\?/);
    assert.match(out, /periferia.+Erro ao salvar/);
  });
});

test("não reprova className, token curto, separador, alt vazio nem t('chave')", () => {
  withFixture({ "Tela.tsx": LIMPO }, ([abs]) => {
    const { out, code } = runGate(abs);
    assert.equal(code, 0, `esperava exit 0, veio ${code}:\n${out}`);
    assert.match(out, /Achados: 0/);
  });
});

// O corpus da periferia inclui .ts, onde não há JSX nenhum: é o que cobre o
// window.confirm, o setError e o generateMetadata fora de componente.
test("literal de interface em .ts também reprova, no bucket periferia", () => {
  withFixture({ "meta.ts": `export const metadata = { title: 'Ficha do personagem' }\n` }, ([abs]) => {
    const { out, code } = runGate(abs);
    assert.equal(code, 1, out);
    assert.match(out, /periferia.+Ficha do personagem/);
  });
});

// Chave, caminho e mensagem de log NÃO são texto de interface: sem espaço interno
// (ou sem letra) o literal não é prosa, e é isto que segura o bucket periferia.
test("literal sem espaço interno não é prosa e não entra na periferia", () => {
  withFixture({ "api.ts": `export const url = '/api/characters'\nexport const k = 'setup.review.attributes'\n` }, ([abs]) => {
    const { out, code } = runGate(abs);
    assert.equal(code, 0, out);
    assert.match(out, /Achados: 0/);
  });
});

// O corpus de verdade: a US-102 liga com zero e é isso que o CI cobra.
test("o corpus do repo está a zero", () => {
  const { out, code } = runGate();
  assert.equal(code, 0, out);
  assert.match(out, /Achados: 0/);
});
