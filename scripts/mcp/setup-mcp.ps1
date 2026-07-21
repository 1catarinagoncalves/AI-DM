<#
.SYNOPSIS
  Registra os MCP servers (Neon, Render, Vercel) no Claude Code para o projeto AI DM.

.DESCRIPTION
  Roda `claude mcp add` para cada serviço. Segredos vêm de variáveis de ambiente,
  NUNCA hardcoded neste arquivo (que é versionado). Rodar numa sessão de terminal
  interativa: o passo de OAuth (Vercel/Neon) exige navegador e NÃO funciona headless.

.PARAMETER Service
  Qual configurar: neon | render | vercel | all (default: all).

.EXAMPLE
  # Definir os segredos só na sessão atual (não persistem, não vazam pra history se usar Read-Host):
  $env:NEON_API_KEY   = "napi_xxx"      # opcional (Neon tem caminho OAuth)
  $env:RENDER_API_KEY = "rnd_xxx"       # obrigatório p/ Render
  ./scripts/mcp/setup-mcp.ps1 -Service all

.NOTES
  Verificar depois com:  claude mcp list   (ou /mcp numa sessão interativa)
#>
param(
  [ValidateSet('neon','render','vercel','all')]
  [string]$Service = 'all'
)

$ErrorActionPreference = 'Stop'

function Test-ClaudeCli {
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    throw "CLI 'claude' não encontrada no PATH. Instale o Claude Code antes de rodar este script."
  }
}

function Add-Neon {
  Write-Host "== Neon ==" -ForegroundColor Cyan
  if ($env:NEON_API_KEY) {
    Write-Host "NEON_API_KEY detectada -> MCP local com key (Caminho B)."
    claude mcp add neon --env "NEON_API_KEY=$($env:NEON_API_KEY)" -- npx -y '@neondatabase/mcp-server-neon' start
  } else {
    Write-Host "Sem NEON_API_KEY -> MCP remoto com OAuth (Caminho A)."
    claude mcp add --transport http neon https://mcp.neon.tech/mcp
    Write-Host "  Falta autorizar: abra o Claude interativo -> /mcp -> neon -> Authenticate." -ForegroundColor Yellow
  }
}

function Add-Render {
  Write-Host "== Render ==" -ForegroundColor Cyan
  if (-not $env:RENDER_API_KEY) {
    Write-Warning "RENDER_API_KEY não definida. Pegue em: Render Dashboard -> Account Settings -> API Keys. Pulando Render."
    return
  }
  claude mcp add --transport http render https://mcp.render.com/mcp --header "Authorization: Bearer $($env:RENDER_API_KEY)"
}

function Add-Vercel {
  Write-Host "== Vercel ==" -ForegroundColor Cyan
  claude mcp add --transport http vercel https://mcp.vercel.com
  Write-Host "  Vercel é OAuth: abra o Claude interativo -> /mcp -> vercel -> Authenticate (escolha o time do AI DM)." -ForegroundColor Yellow
  Write-Host "  Alternativa headless: usar VERCEL_TOKEN + Vercel CLI (ver US-64, Caminho C)."
}

Test-ClaudeCli

switch ($Service) {
  'neon'   { Add-Neon }
  'render' { Add-Render }
  'vercel' { Add-Vercel }
  'all'    { Add-Neon; Add-Render; Add-Vercel }
}

Write-Host "`nPronto. Verifique:  claude mcp list" -ForegroundColor Green
Write-Host "OAuth pendente (Neon remoto / Vercel): finalize com /mcp numa sessão interativa." -ForegroundColor Green
