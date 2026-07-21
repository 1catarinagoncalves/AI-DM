#!/usr/bin/env bash
#
# Registra os MCP servers (Neon, Render, Vercel) no Claude Code para o projeto AI DM.
#
# Segredos vêm de variáveis de ambiente, NUNCA hardcoded neste arquivo (versionado).
# Rodar numa sessão de terminal interativa: o OAuth (Vercel/Neon) exige navegador
# e NÃO funciona headless.
#
# Uso:
#   export NEON_API_KEY=napi_xxx      # opcional (Neon tem caminho OAuth)
#   export RENDER_API_KEY=rnd_xxx     # obrigatório p/ Render
#   ./scripts/mcp/setup-mcp.sh [neon|render|vercel|all]   # default: all
#
# Verificar depois:  claude mcp list   (ou /mcp numa sessão interativa)

set -euo pipefail

SERVICE="${1:-all}"

command -v claude >/dev/null 2>&1 || {
  echo "CLI 'claude' não encontrada no PATH. Instale o Claude Code antes." >&2
  exit 1
}

add_neon() {
  echo "== Neon =="
  if [ -n "${NEON_API_KEY:-}" ]; then
    echo "NEON_API_KEY detectada -> MCP local com key (Caminho B)."
    claude mcp add neon --env "NEON_API_KEY=${NEON_API_KEY}" -- npx -y @neondatabase/mcp-server-neon start
  else
    echo "Sem NEON_API_KEY -> MCP remoto com OAuth (Caminho A)."
    claude mcp add --transport http neon https://mcp.neon.tech/mcp
    echo "  Falta autorizar: Claude interativo -> /mcp -> neon -> Authenticate."
  fi
}

add_render() {
  echo "== Render =="
  if [ -z "${RENDER_API_KEY:-}" ]; then
    echo "  RENDER_API_KEY não definida (Render Dashboard -> Account Settings -> API Keys). Pulando Render." >&2
    return
  fi
  claude mcp add --transport http render https://mcp.render.com/mcp \
    --header "Authorization: Bearer ${RENDER_API_KEY}"
}

add_vercel() {
  echo "== Vercel =="
  claude mcp add --transport http vercel https://mcp.vercel.com
  echo "  Vercel é OAuth: Claude interativo -> /mcp -> vercel -> Authenticate (escolha o time do AI DM)."
  echo "  Alternativa headless: VERCEL_TOKEN + Vercel CLI (ver US-64, Caminho C)."
}

case "$SERVICE" in
  neon)   add_neon ;;
  render) add_render ;;
  vercel) add_vercel ;;
  all)    add_neon; add_render; add_vercel ;;
  *)      echo "Serviço inválido: $SERVICE (use neon|render|vercel|all)" >&2; exit 1 ;;
esac

echo
echo "Pronto. Verifique:  claude mcp list"
echo "OAuth pendente (Neon remoto / Vercel): finalize com /mcp numa sessão interativa."
