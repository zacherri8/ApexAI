param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000,
    [string]$BackendHost = "127.0.0.1",
    [string]$FrontendHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$backendPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$backendApp = Join-Path $backendDir "app\main.py"
$frontendNpm = Join-Path ${env:ProgramFiles} "nodejs\npm.cmd"
$runtimeDir = Join-Path $root "tmp\dev-runtime"
$pidFile = Join-Path $runtimeDir "apexai-dev-processes.json"

function Require-Path {
    param(
        [string]$PathValue,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $PathValue)) {
        throw "$Label not found: $PathValue"
    }
}

function Get-CommandPath {
    param([string]$CommandName)

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    return $null
}

function Test-PortAvailable {
    param(
        [string]$HostName,
        [int]$Port
    )

    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($HostName), $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 | Out-Null
            return $true
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }

    return $false
}

function Stop-ExistingLauncher {
    param([string]$PidFilePath)

    if (-not (Test-Path -LiteralPath $PidFilePath)) {
        return
    }

    try {
        $state = Get-Content -LiteralPath $PidFilePath -Raw | ConvertFrom-Json
        foreach ($procId in @($state.backend_shell_pid, $state.frontend_shell_pid)) {
            if ($procId) {
                taskkill /PID $procId /T /F 2>$null | Out-Null
            }
        }
    }
    catch {
    }
    finally {
        Remove-Item -LiteralPath $PidFilePath -Force -ErrorAction SilentlyContinue
    }
}

Require-Path -PathValue $backendDir -Label "Backend directory"
Require-Path -PathValue $frontendDir -Label "Frontend directory"
Require-Path -PathValue $backendPython -Label "Backend virtualenv Python"
Require-Path -PathValue $backendApp -Label "Backend app entrypoint"

if (-not (Test-Path -LiteralPath $frontendNpm)) {
    $frontendNpm = Get-CommandPath -CommandName "npm.cmd"
}
if (-not $frontendNpm) {
    throw "npm.cmd not found. Install Node.js or add it to PATH."
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Stop-ExistingLauncher -PidFilePath $pidFile

if (-not (Test-PortAvailable -HostName $BackendHost -Port $BackendPort)) {
    throw "Backend port $BackendPort is already in use on $BackendHost. Stop the existing process or rerun with different ports."
}
if (-not (Test-PortAvailable -HostName $FrontendHost -Port $FrontendPort)) {
    throw "Frontend port $FrontendPort is already in use on $FrontendHost. Stop the existing process or rerun with different ports."
}

$backendCommand = "Set-Location '$backendDir'; & '$backendPython' -m uvicorn app.main:app --host $BackendHost --port $BackendPort"
$frontendCommand = "`$env:Path='$(Split-Path -Parent $frontendNpm);' + `$env:Path; Set-Location '$frontendDir'; & '$frontendNpm' run dev -- --hostname $FrontendHost --port $FrontendPort"

$backendShell = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoExit", "-Command", $backendCommand) `
    -WindowStyle Minimized `
    -PassThru

$frontendShell = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoExit", "-Command", $frontendCommand) `
    -WindowStyle Minimized `
    -PassThru

$state = [PSCustomObject]@{
    backend_shell_pid = $backendShell.Id
    frontend_shell_pid = $frontendShell.Id
    backend_url = "http://${BackendHost}:${BackendPort}"
    frontend_url = "http://${FrontendHost}:${FrontendPort}"
    health_url = "http://${BackendHost}:${BackendPort}/api/v1/health"
    started_at = (Get-Date).ToString("s")
}
$state | ConvertTo-Json | Set-Content -LiteralPath $pidFile

Write-Host ""
Write-Host "Starting ApexAI..." -ForegroundColor Cyan
Write-Host "Backend:  $($state.backend_url)" -ForegroundColor Gray
Write-Host "Frontend: $($state.frontend_url)" -ForegroundColor Gray
Write-Host "Health:   $($state.health_url)" -ForegroundColor Gray
Write-Host ""

$backendReady = Wait-ForHttp -Url $state.health_url -TimeoutSeconds 45
$frontendReady = Wait-ForHttp -Url $state.frontend_url -TimeoutSeconds 120

if ($backendReady -and $frontendReady) {
    Write-Host "ApexAI is running." -ForegroundColor Green
    Write-Host "Use npm run stop from the project root to stop both services." -ForegroundColor Green
}
elseif ($backendReady) {
    Write-Host "Backend is running, but frontend did not report ready within the timeout window." -ForegroundColor Yellow
    Write-Host "Check the minimized frontend PowerShell window." -ForegroundColor Yellow
}
else {
    Write-Host "Startup did not complete cleanly. Check the minimized backend and frontend PowerShell windows." -ForegroundColor Yellow
}
