// Teste de regressão do `pnpm dev:token` (US-201). `node --test scripts/`.
//
// Roda o script de verdade (spawn), contra um servidor HTTP falso que faz as
// vezes do `/auth/sync` da API — não sobe Nest nem Postgres aqui, isso é papel da
// suíte de integração (`apps/api/src/auth/auth.service.int.test.ts`). O que este
// teste prova é o formato do TOKEN que sai em stdout e o comportamento com a API
// fora do ar, que é o que a US-201 pede como critério de aceite.

import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = resolve(ROOT, "scripts", "dev-token.mjs");
const SECRET = "segredo-teste-us201";

/** Mesma verificação que apps/api/src/auth/jwt.ts faz, local e sem dependência nova. */
function verify(token, secret) {
  const [header, body, sig] = token.split(".");
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  if (sig !== expected) throw new Error("assinatura inválida");
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
}

/** Sobe um /auth/sync falso numa porta efêmera; devolve a base URL e um `close()`. */
function withFakeSync(fn) {
  return new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      if (req.method === "POST" && req.url === "/api/v1/auth/sync") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: "user_dev_teste", email: "dev@ai-dm.invalid", name: "Agente de desenvolvimento", locale: "pt-BR" }));
        return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      Promise.resolve(fn(`http://127.0.0.1:${port}`))
        .then((v) => server.close(() => resolvePromise(v)))
        .catch((err) => server.close(() => reject(err)));
    });
  });
}

// `spawn` assíncrono, não `spawnSync`: o teste do sucesso roda um servidor HTTP NO
// MESMO processo para fazer de /auth/sync, e `spawnSync` bloqueia o event loop do
// processo pai inteiro até o filho sair — o servidor nunca chegaria a aceitar a
// conexão do script, e o request morreria só no timeout de 5s do próprio script.
function runScript(env) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [SCRIPT], { cwd: ROOT, env: { PATH: process.env.PATH, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
  });
}

test("imprime só o token em stdout, válido contra o mesmo segredo e rejeitado com outro", async () => {
  await withFakeSync(async (API_URL) => {
    const r = await runScript({ AUTH_SECRET: SECRET, API_URL });
    assert.equal(r.status, 0, r.stderr);

    const lines = r.stdout.split("\n").filter(Boolean);
    assert.equal(lines.length, 1, `esperava 1 linha em stdout, veio:\n${r.stdout}`);

    const token = lines[0];
    assert.match(token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
    assert.doesNotThrow(() => verify(token, SECRET));
    assert.throws(() => verify(token, "outro-segredo"));

    const payload = verify(token, SECRET);
    assert.equal(payload.sub, "user_dev_teste");
    assert.equal(payload.email, "dev@ai-dm.invalid");
  });
});

/** Porta livre que RECUSA conexão de imediato (servidor aberto e fechado na hora). */
async function closedPort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((err) => (err ? reject(err) : resolvePromise(port)));
    });
  });
}

test("com a API fora do ar, falha com mensagem amigável e sem stack trace em stdout", async () => {
  const port = await closedPort();
  const r = await runScript({ AUTH_SECRET: SECRET, API_URL: `http://127.0.0.1:${port}` });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /suba a API/);
  assert.doesNotMatch(r.stderr, /at .*dev-token\.mjs/);
});

test("sem AUTH_SECRET, falha sem imprimir token", async () => {
  const port = await closedPort();
  const r = await runScript({ API_URL: `http://127.0.0.1:${port}` });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /AUTH_SECRET ausente/);
});
