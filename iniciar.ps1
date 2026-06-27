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

# 3. Ler chave Groq do ficheiro .env
$groqKey = ""
$envFile = Join-Path $projectDir ".env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^GROQ_API_KEY=(.+)$") {
            $groqKey = $Matches[1] -replace '["]', ''
            break
        }
    }
}

# 4. Iniciar API e frontend em janelas separadas
Write-Host "  [3/3] A iniciar API e frontend..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $projectDir "scripts\start-api.ps1"), "-ProjectDir", $projectDir, "-GroqKey", $groqKey

Start-Sleep -Seconds 5

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $projectDir "scripts\start-web.ps1"), "-ProjectDir", $projectDir

Write-Host ""
Write-Host "  Tudo iniciado!" -ForegroundColor Green
Write-Host "  A abrir o browser em 20 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 20
Start-Process "http://localhost:3000"
