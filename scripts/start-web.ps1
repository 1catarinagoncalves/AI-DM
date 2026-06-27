$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location "$projectDir\apps\web"

$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001'

Write-Host "Frontend a iniciar em http://localhost:3000" -ForegroundColor Yellow
pnpm dev
