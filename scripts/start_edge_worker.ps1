$ErrorActionPreference = "Stop"
$ProjectDir = "D:\PrivacyDriveEdge"
$Python = Join-Path $ProjectDir ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Edge virtual environment not found at $Python"
}

$env:PRIVACYDRIVE_TIER = "edge"
$env:PRIVACYDRIVE_WORKER_ID = "trusted-windows-edge"
$env:PRIVACYDRIVE_THREADS = "6"
$env:PRIVACYDRIVE_BATCH_SIZE = "8"
$env:HF_HOME = Join-Path $ProjectDir "model-cache"

Set-Location $ProjectDir
Write-Host "Starting PrivacyDrive edge worker on loopback port 8001..."
Write-Host "Keep this window open during the demonstration."
& $Python -m uvicorn privacydrive.worker_api:app --host 127.0.0.1 --port 8001
