param(
  [Parameter(Mandatory = $true)][string]$RainMakerPython,
  [Parameter(Mandatory = $true)][string]$RainMakerSession,
  [Parameter(Mandatory = $true)][string]$DeviceLinks,
  [int]$Port = 5501,
  [switch]$EnableCommands
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$env:DIGIFLOVV_RAINMAKER_PYTHON = (Resolve-Path -LiteralPath $RainMakerPython).Path
$env:RM_USER_CONFIG_DIR = (Resolve-Path -LiteralPath $RainMakerSession).Path
$env:DIGIFLOVV_DEVICE_LINKS = (Resolve-Path -LiteralPath $DeviceLinks).Path
$env:DIGIFLOVV_DEVICE_WRITES = if ($EnableCommands) { '1' } else { '0' }
$publicConfig = [System.IO.File]::ReadAllText((Join-Path $projectRoot 'dist/auth-config.js'))
$keyMatch = [regex]::Match($publicConfig, 'publishableKey:\s*"(sb_publishable_[A-Za-z0-9_-]+)"')
if (!$keyMatch.Success) { throw 'Public authentication configuration missing.' }
$env:DIGIFLOVV_SUPABASE_PUBLIC_KEY = $keyMatch.Groups[1].Value
Write-Host "Local connection check: http://127.0.0.1:$Port/integration-account.html"
& node (Join-Path $PSScriptRoot 'serve.cjs') --port $Port
exit $LASTEXITCODE
