$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root "tmp\dev-runtime\apexai-dev-processes.json"

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Host "No ApexAI dev runtime file found. Nothing to stop." -ForegroundColor Yellow
    exit 0
}

try {
    $state = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    foreach ($procId in @($state.backend_shell_pid, $state.frontend_shell_pid)) {
        if ($procId) {
            taskkill /PID $procId /T /F 2>$null | Out-Null
        }
    }
    Write-Host "Stopped ApexAI dev services." -ForegroundColor Green
}
finally {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}
