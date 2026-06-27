param($ProjectDir, $GroqKey)

Set-Location "$ProjectDir\apps\api"
$env:DATABASE_URL = 'postgresql://aidm:aidm_dev@localhost:5432/ai_dm'
$env:REDIS_URL = 'redis://localhost:6379'
$env:JWT_SECRET = 'ai_dm_dev_secret_troque_em_producao'
$env:PORT = '3001'
$env:GROQ_API_KEY = $GroqKey

Write-Host "API a iniciar em http://localhost:3001" -ForegroundColor Yellow
npx @nestjs/cli start
