# Redstone World one-click launcher (PowerShell)
# Usage: right-click -> Run with PowerShell, or run ./start.ps1 in a terminal
$ErrorActionPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot
$port = 8000
$url  = "http://localhost:$port"

function Have($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "Redstone World · Launching  ->  $url" -ForegroundColor Green
Start-Process $url

if (Have python)  { python -m http.server $port }
elseif (Have py)  { py -m http.server $port }
elseif (Have npx) { npx --yes http-server -p $port -c-1 }
else {
  Write-Host "Python or Node not found. Please install one of them." -ForegroundColor Red
  Write-Host "Python: https://www.python.org/downloads/"
  Write-Host "Node:   https://nodejs.org/"
  Read-Host "Press Enter to exit"
}
