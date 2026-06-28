$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location "$projectDir\apps\api"

$env:DATABASE_URL = 'postgresql://aidm:aidm_dev@localhost:5432/ai_dm'
$env:REDIS_URL = 'redis://localhost:6379'
$env:JWT_SECRET = 'ai_dm_dev_secret_troque_em_producao'
$env:PORT = '3001'

# Ler chaves de API (OpenRouter para narração; Groq mantido por compatibilidade)
$envFile = "$projectDir\.env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
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
}

Write-Host "API a iniciar em http://localhost:3001" -ForegroundColor Yellow
pnpm dev
