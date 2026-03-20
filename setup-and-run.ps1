param(
  [switch]$BackendOnly,
  [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

function Test-Command($name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not $BackendOnly -and -not $FrontendOnly) {
  # both
} elseif ($BackendOnly -and $FrontendOnly) {
  throw "Use only one of -BackendOnly or -FrontendOnly."
}

if (-not (Test-Command "python")) {
  throw "Python not found in PATH. Install Python first."
}

if (-not $BackendOnly -and -not (Test-Command "npm")) {
  throw "npm not found in PATH. Install Node.js first."
}

Write-Host "Project root: $RootDir"

$backendProc = $null

$npmExe = (Get-Command npm -ErrorAction Stop).Source

try {
  if (-not $FrontendOnly) {
    Write-Host "---- Backend setup ----"
    # Use `venv` folder by default (created by this repo/scripts in Windows)
    $venvDir = Join-Path $BackendDir "venv"
    $venvPython = Join-Path $venvDir "Scripts\python.exe"
    $venvPip = Join-Path $venvDir "Scripts\pip.exe"

    if (-not (Test-Path $venvDir)) {
      Write-Host "Creating backend venv..."
      python -m venv $venvDir
    }

    if (-not (Test-Path $venvPython)) {
      throw "Backend venv python not found at: $venvPython"
    }

    & $venvPip install --upgrade pip
    & $venvPip install -r (Join-Path $BackendDir "requirements.txt")

    Write-Host "---- Starting backend (FastAPI) ----"
    if ($BackendOnly) {
      Push-Location $BackendDir
      try {
        & $venvPython -m uvicorn "app.main:app" --host "0.0.0.0" --port 8000 --reload
      } finally {
        Pop-Location
      }
      return
    } else {
      $backendProc = Start-Process -FilePath $venvPython -ArgumentList @(
        "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload"
      ) -WorkingDirectory $BackendDir -PassThru

      Write-Host "Backend PID: $($backendProc.Id) (http://localhost:8000)"
    }
  }

  if (-not $BackendOnly) {
    Write-Host "---- Frontend setup ----"
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
      Write-Host "Installing frontend dependencies (npm install)..."
    } else {
      Write-Host "Frontend node_modules already exists; running npm install anyway..."
    }

    Push-Location $FrontendDir
    try { & $npmExe install } finally { Pop-Location }

    Write-Host "---- Starting frontend (Vite) ----"
    Push-Location $FrontendDir
    try {
      & $npmExe run dev
    } finally {
      Pop-Location
    }
  }
}
finally {
  if ($backendProc -ne $null -and -not $backendProc.HasExited) {
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
  }
}

