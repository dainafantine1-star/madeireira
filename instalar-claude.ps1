$ErrorActionPreference = 'Stop'
$baseUrl = 'https://claudeinfinity.iadigital.site/api/public'

# Informe um identificador aceito pelo seu provedor.
$model = Read-Host 'Modelo do provedor (Enter para claude-haiku-4-5)'
if ([string]::IsNullOrWhiteSpace($model)) { $model = 'claude-haiku-4-5' }
$model = $model.Trim()

$secureKey = Read-Host 'Cole a NOVA chave do provedor (entrada oculta)' -AsSecureString
$apiKey = [System.Net.NetworkCredential]::new('', $secureKey).Password
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw 'A chave esta vazia.' }

$settingsDir = Join-Path $env:USERPROFILE '.claude'
$settingsPath = Join-Path $settingsDir 'settings.json'
$settings = [pscustomobject]@{}
if (Test-Path -LiteralPath $settingsPath) {
    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    if ($null -eq $settings -or $settings -isnot [pscustomobject]) {
        throw 'settings.json deve conter um objeto JSON. Arquivo preservado.'
    }
}

# Confere o modelo e a chave antes de alterar as configuracoes.
$headers = @{
    Authorization = "Bearer $apiKey"
    'anthropic-version' = '2023-06-01'
}
$body = @{
    model = $model
    max_tokens = 1024
    messages = @(@{ role = 'user'; content = 'Responda somente OK' })
} | ConvertTo-Json -Depth 5

Write-Host 'Testando a chave e o modelo no provedor...'
$result = Invoke-RestMethod -Method Post -Uri "$baseUrl/v1/messages" `
    -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 60
if (-not $result.id -or -not $result.content) {
    throw 'O provedor nao retornou uma resposta de mensagem valida.'
}

$claudePath = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
if (-not (Test-Path -LiteralPath $claudePath)) {
    Write-Host 'Instalando o Claude Code...'
    Invoke-RestMethod 'https://claude.ai/install.ps1' | Invoke-Expression
}
if (-not (Test-Path -LiteralPath $claudePath)) {
    throw 'Instalador nao criou .local\bin\claude.exe. Confira a mensagem da instalacao.'
}
& $claudePath --version
if ($LASTEXITCODE -ne 0) { throw 'Falha ao executar o Claude Code.' }

New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null
if (Test-Path -LiteralPath $settingsPath) {
    $backupPath = "$settingsPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$([guid]::NewGuid().ToString('N'))"
    Copy-Item -LiteralPath $settingsPath -Destination $backupPath
    Write-Host "Backup das configuracoes: $backupPath"
}

$envProperty = $settings.PSObject.Properties['env']
if ($null -eq $envProperty -or $null -eq $envProperty.Value) {
    $settings | Add-Member -NotePropertyName env -NotePropertyValue ([pscustomobject]@{}) -Force
}
if ($settings.env -isnot [pscustomobject]) {
    throw 'O campo env de settings.json deve ser um objeto JSON. Arquivo preservado.'
}

# Usa o modelo testado em todas as selecoes, evitando aliases nao verificados.
$values = @{
    ANTHROPIC_BASE_URL = $baseUrl
    ANTHROPIC_AUTH_TOKEN = $apiKey
    ANTHROPIC_MODEL = $model
    ANTHROPIC_DEFAULT_OPUS_MODEL = $model
    ANTHROPIC_DEFAULT_SONNET_MODEL = $model
    ANTHROPIC_DEFAULT_HAIKU_MODEL = $model
}
$settings.env.PSObject.Properties.Remove('ANTHROPIC_API_KEY')
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
foreach ($name in $values.Keys) {
    $settings.env | Add-Member -NotePropertyName $name -NotePropertyValue $values[$name] -Force
    [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
}
$settings | Add-Member -NotePropertyName model -NotePropertyValue $model -Force
$json = $settings | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($settingsPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host 'CONFIGURACAO SALVA E TESTE DO PROVEDOR CONCLUIDO' -ForegroundColor Green
& $claudePath --model $model
