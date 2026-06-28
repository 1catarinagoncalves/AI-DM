# AI DM - Script de arranque
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host ""
Write-Host "  AI Dungeon Master" -ForegroundColor Yellow
Write-Host "  A iniciar..." -ForegroundColor Gray
Write-Host ""

# 1. Docker Desktop
$docker = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "  [1/3] A abrir Docker Desktop..." -ForegroundColor Cyan
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "       Aguarda 30 segundos para o Docker arrancar..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
} else {
    Write-Host "  [1/3] Docker Desktop ja esta a correr." -ForegroundColor Green
}

# 2. Base de dados
Write-Host "  [2/3] A iniciar base de dados..." -ForegroundColor Cyan
docker compose up -d 2>&1 | Out-Null
Start-Sleep -Seconds 3
Write-Host "       Base de dados pronta." -ForegroundColor Green

# 3. Carregar variaveis de ambiente
Write-Host "  [3/3] A iniciar API e frontend..." -ForegroundColor Cyan
$env:DATABASE_URL = 'postgresql://aidm:aidm_dev@localhost:5432/ai_dm'
$env:REDIS_URL = 'redis://localhost:6379'
$env:JWT_SECRET = 'ai_dm_dev_secret_troque_em_producao'
$env:PORT = '3001'
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001'

foreach ($line in Get-Content "$projectDir\.env") {
    if ($line -match "^GROQ_API_KEY=(.+)$") {
        $env:GROQ_API_KEY = $Matches[1] -replace '["]', ''
    }
    if ($line -match "^OPENROUTER_API_KEY=(.+)$") {
        $env:OPENROUTER_API_KEY = $Matches[1] -replace '["]', ''
    }
    if ($line -match "^NVIDIA_API_KEY=(.+)$") {
        $env:NVIDIA_API_KEY = $Matches[1] -replace '["]', ''
    }
}

Write-Host ""
Write-Host "  O browser vai abrir automaticamente quando estiver pronto." -ForegroundColor Gray
Write-Host "  Para fechar, fecha esta janela." -ForegroundColor Gray
Write-Host ""

# Abrir browser em background depois de 30 segundos
Start-Job -ScriptBlock { Start-Sleep -Seconds 30; Start-Process "http://localhost:3000" } | Out-Null

# Iniciar API e frontend na janela actual (pnpm dev inicia ambos em paralelo)
pnpm dev
