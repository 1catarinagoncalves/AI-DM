#!/usr/bin/env node
// Gate de string literal de interface no front (US-102).
//
// Reprova texto visível escrito direto no código em vez de passar pelo dicionário
// da US-98. Quatro buckets, todos medidos na baseline de 31/07 e 04/08/2026:
//   jsx-text   - <p>Criar personagem</p>
//   atributo   - aria-label="Fechar", placeholder, title, alt, label
//   expressão  - {cond ? 'A iniciar...' : 'Iniciar aventura'}
//   periferia  - window.confirm('…'), setError('…'), metadata.title — fora do JSX
//
// Uso:
//   node scripts/check-jsx-literals.mjs                # varre apps/web/src, falha se houver achado
//   node scripts/check-jsx-literals.mjs [arquivo...]   # varre só esses, para o teste de regressão
//
// NUNCA escreve: extrair string exige inventar nome de chave e editar dois
// dicionários (US-79, bucket "reportar, não reescrever"). Passo de CI que edita
// arquivo sozinho não é gate.
//
// Parser, não regex: comentário nunca dispara (não é nó de texto), className nunca
// dispara (atributo fora da lista), e o gate pega os DOIS idiomas — depois da US-98
// o defeito a barrar é literal em qualquer língua, não só acento português.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const ROOT = resolve(import.meta.dirname, "..");
const WEB = join(ROOT, "apps", "web", "src");

// US-102: atributos que o jogador LÊ. className/href/key/id/type/role/data-*
// ficam de fora — são contrato de código, não texto de interface.
const VISIBLE_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label"]);

// O dicionário é o lugar onde o texto DEVE estar: 166 dos 168 literais de prosa do
// front vivem nestes dois arquivos. Exclusão por caminho, não por allowlist.
const DICT_DIR = join(WEB, "messages") + sep;

// Exceção deliberada, no padrão do GHOST_ALLOW da US-88: chave = texto, valor =
// motivo. Por texto e não por linha — chave por linha quebra na primeira edição
// acima dela. Entrada que deixar de casar vira aviso, não erro (ver o fim).
const LITERAL_ALLOW = new Map([
  ["AUTH_SECRET ausente no web", "apps/web/src/auth.ts:22 — mensagem de throw para quem opera, nunca renderizada"],
]);

/** Prosa é o que tem letra. Descarta os 15 separadores da baseline (·, —, /) e o alt="". */
const hasLetter = (text) => /\p{L}/u.test(text);

// Forma de lista de utilitário Tailwind: minúsculas/dígitos/-/:/[]/ com pelo menos
// um `-` ou `:`. São 48 na baseline, e é o filtro que decide se o gate sobrevive —
// gate com falso positivo é gate que alguém desliga.
// `_ ( ) ,` entram por causa do valor arbitrário — `shadow-[inset_0_0_0_1px_var(--primary)]`
// (dm.tsx:33) e `bg-[right_0.75rem_center]` (SetupWizard.tsx:211) — e de quebra cobrem a
// media query `(prefers-color-scheme: dark)` (ThemeProvider.tsx:12), que é da mesma família:
// formato de máquina que tem letra e espaço.
// TETO CONHECIDO: prosa inglesa toda em minúsculas, sem acento e com um hífen
// ("well-known system uploaded") casa esta forma e escapa. Prosa de interface real começa
// com maiúscula ou traz acento/pontuação, e cair para "qualquer literal com espaço" traria
// os 48 falsos positivos de Tailwind da baseline de volta.
const TAILWIND_TOKEN = /^[a-z0-9\-:[\]/.%!_(),]+$/;
const isTailwind = (text) => /[-:]/.test(text) && text.trim().split(/\s+/).every((t) => TAILWIND_TOKEN.test(t));

// Data URI é formato de máquina, não prosa: o SVG inline do select (SetupWizard.tsx:41)
// tem letra e espaço por acidente de sintaxe. Filtro estrutural em vez de entrada de
// allowlist — a chave seria a URI inteira e fossilizaria no primeiro ajuste do ícone.
const isDataUri = (text) => /^url\(|^data:/.test(text.trim());

/** Prosa de interface: letra, espaço interno, e nem Tailwind nem data URI. */
function isProse(text) {
  return hasLetter(text) && /\s/.test(text.trim()) && !isTailwind(text) && !isDataUri(text);
}

/**
 * Sobe do literal até o primeiro ancestral que decide o bucket. Subir é o que evita
 * contar o mesmo nó duas vezes: o mesmo StringLiteral aparece em `{cn(...)}` de
 * className e em `{cond ? 'a' : 'b'}` de conteúdo, e a primeira medição desta
 * baseline inflou 411 contra 117 reais por não fazer isso.
 */
function bucketOf(node, src) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return VISIBLE_ATTRS.has(p.name.getText(src)) ? "atributo" : null;
    if (ts.isJsxExpression(p) && p.parent && (ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent))) return "expressão";
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) return "periferia";
    if (ts.isExpressionStatement(p)) return null; // diretiva de módulo: 'use client'
  }
  return "periferia";
}

/** O bucket `atributo` cobra letra; os outros três cobram prosa (letra + espaço). */
function isCharged(bucket, text) {
  if (bucket === "atributo") return hasLetter(text);
  return isProse(text);
}

function scan(file, hits) {
  const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const at = (node) => src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
  const push = (bucket, node, text) => {
    if (!bucket || !isCharged(bucket, text) || LITERAL_ALLOW.has(text.trim())) return;
    hits.push({ where: `${rel(file)}:${at(node)}`, bucket, text: text.trim().replace(/\s+/g, " ") });
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) push("jsx-text", node, node.text);
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      push(bucketOf(node, src), node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

const rel = (abs) => (abs.startsWith(ROOT + sep) ? relative(ROOT, abs) : abs);

/** `.ts` e `.tsx` de apps/web/src, menos os testes e menos o dicionário. */
function corpus(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules") out.push(...corpus(p));
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !p.startsWith(DICT_DIR)) {
      out.push(p);
    }
  }
  return out;
}

const picked = process.argv.slice(2).map((a) => resolve(ROOT, a));
const files = (picked.length ? picked : corpus(WEB)).filter(existsSync).sort();

const hits = [];
for (const file of files) scan(file, hits);

console.log(`${files.length} arquivo(s) em apps/web/src (.tsx + .ts, sem *.test.* e sem messages/)`);
console.log(`Achados: ${hits.length}`);
for (const bucket of ["jsx-text", "atributo", "expressão", "periferia"]) {
  const n = hits.filter((h) => h.bucket === bucket).length;
  console.log(`  ${bucket.padEnd(10)}: ${String(n).padStart(3)}`);
}
for (const h of hits) console.log(`\n  ${h.where}  [${h.bucket}]  ${h.text.slice(0, 120)}`);

// Aviso, não erro: a tela está certa, quem envelheceu foi o allowlist. Derrubar o CI
// por isto ensinaria a esvaziar o LITERAL_ALLOW no susto (mesma escolha da US-88).
// Só na varredura completa — com posicional nenhuma entrada casaria, e o teste de
// regressão acenderia o aviso a cada execução.
if (!picked.length) {
  const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const fossil = [...LITERAL_ALLOW].filter(([texto]) => !src.includes(texto));
  if (fossil.length) {
    console.log(`\n[literal-allow obsoleto] ${fossil.length} entrada(s) não casam mais — remova do LITERAL_ALLOW:`);
    for (const [texto, motivo] of fossil) console.log(`  ${JSON.stringify(texto)}  (${motivo})`);
  }
}

if (hits.length) {
  console.log("\nTexto de interface vive no dicionário (apps/web/src/messages/), não no código. Use t('chave').");
  process.exit(1);
}
