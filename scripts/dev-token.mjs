#!/usr/bin/env node
// Emite um Bearer de dev para agentes exercitarem a API/telas sem OAuth do Google (US-201).
//
// Passos (espelha o que o web faz no primeiro login, apps/web/src/auth.ts):
//   1. assina um token de bootstrap { email, name } com o AUTH_SECRET da raiz
//   2. chama POST /auth/sync com ele — upsert da conta de dev, devolve o `id`
//   3. assina o token final { sub, email }, exp curto, e imprime SÓ ele em stdout
//
// Sem dependência nova: HS256 à mão com node:crypto, o mesmo formato que
// apps/api/src/auth/jwt.ts verifica (base64url(header).base64url(payload).base64url(hmac)).
// Não importa Prisma nem toca o banco — o upsert é o /auth/sync existente (US-201, decisão 2).
//
// Uso: pnpm dev:token   (precisa da API de pé; lê AUTH_SECRET do .env da raiz via dotenv -e .env)

import { createHmac } from "node:crypto";

const API_URL = process.env.API_URL ?? "http://localhost:3001";
const DEV_EMAIL = "dev@ai-dm.invalid";
const DEV_NAME = "Agente de desenvolvimento";
// Horas, não semanas: token de bancada circulando em terminal/transcript de agente.
const BOOTSTRAP_TTL_SECONDS = 5 * 60;
const FINAL_TTL_SECONDS = 4 * 60 * 60;

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function withExp(payload, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  return { ...payload, iat: now, exp: now + ttlSeconds };
}

async function syncDevAccount(secret) {
  const bootstrap = sign(withExp({ email: DEV_EMAIL, name: DEV_NAME }, BOOTSTRAP_TTL_SECONDS), secret);

  let res;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bootstrap}` },
      body: JSON.stringify({}),
      // Uma porta que não responde nada (firewall, host errado) não pode travar o
      // comando para sempre — 5s é folga de sobra para localhost.
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error(`API não respondeu em ${API_URL} — suba a API (pnpm dev) antes de rodar pnpm dev:token`);
  }
  if (!res.ok) {
    throw new Error(`POST /auth/sync devolveu ${res.status} — suba a API (pnpm dev) antes de rodar pnpm dev:token`);
  }
  return res.json();
}

async function main() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET ausente — rode via `pnpm dev:token` (carrega o .env da raiz)");
  }

  const user = await syncDevAccount(secret);
  const token = sign(withExp({ sub: user.id, email: user.email }, FINAL_TTL_SECONDS), secret);
  console.log(token);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
