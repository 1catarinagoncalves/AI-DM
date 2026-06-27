# AI DM — Script de arranque
# Duplo clique para iniciar tudo

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host ""
Write-Host "  ⚔  AI Dungeon Master" -ForegroundColor Yellow
Write-Host "  A iniciar..." -ForegroundColor Gray
Write-Host ""

# 1. Verificar se o Docker Desktop está a correr
$docker = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "  [1/3] A abrir Docker Desktop..." -ForegroundColor Cyan
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "       Aguarda 30 segundos para o Docker arrancar..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
} else {
    Write-Host "  [1/3] Docker Desktop já está a correr." -ForegroundColor Green
}

# 2. Iniciar os containers (base de dados + redis)
Write-Host "  [2/3] A iniciar base de dados..." -ForegroundColor Cyan
docker compose up -d 2>&1 | Out-Null
Start-Sleep -Seconds 5
Write-Host "       Base de dados pronta." -ForegroundColor Green

# 3. Carregar variáveis de ambiente
if (Test-Path ".env") {
    Get-Content ".env" | Where-Object { $_ -match "^[A-Z]" -and $_ -notmatch "^#" } | ForEach-Object {
        $parts = $_ -split "=", 2
        $name = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

$env:PORT = "3001"
$env:NEXT_PUBLIC_API_URL = "http://localhost:3001"

# 4. Iniciar o servidor da API numa janela separada
Write-Host "  [3/3] A iniciar servidor da API e frontend..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  Set-Location '$projectDir\apps\api'
  `$env:DATABASE_URL='postgresql://aidm:aidm_dev@localhost:5432/ai_dm'
  `$env:REDIS_URL='redis://localhost:6379'
  `$env:JWT_SECRET='ai_dm_dev_secret_troque_em_producao'
  `$env:PORT='3001'
  Get-Content '$projectDir\.env' | Where-Object { `$_ -match '^GROQ_API_KEY' } | ForEach-Object { `$v = (`$_ -split '=',2)[1].Trim().Trim('`"'); `$env:GROQ_API_KEY=`$v }
  Write-Host 'API a iniciar em http://localhost:3001' -ForegroundColor Yellow
  npx @nestjs/cli start
"@

Start-Sleep -Seconds 5

# 5. Iniciar o frontend numa janela separada
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  Set-Location '$projectDir\apps\web'
  `$env:NEXT_PUBLIC_API_URL='http://localhost:3001'
  Write-Host 'Frontend a iniciar em http://localhost:3000' -ForegroundColor Yellow
  npx next dev --port 3000
"@

Write-Host ""
Write-Host "  Tudo iniciado!" -ForegroundColor Green
Write-Host ""
Write-Host "  Aguarda ~15 segundos e abre o browser em:" -ForegroundColor White
Write-Host "  http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

# Abrir o browser automaticamente após 18 segundos
Write-Host "  A abrir o browser em 18 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 18
Start-Process "http://localhost:3000"
