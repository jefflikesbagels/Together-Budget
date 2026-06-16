# Together Budget — start shared server (use if node works in PowerShell)
Set-Location $PSScriptRoot

$node = (Get-Command node -ErrorAction SilentlyContinue)?.Source
if (-not $node -and (Test-Path "${env:ProgramFiles}\nodejs\node.exe")) {
  $node = "${env:ProgramFiles}\nodejs\node.exe"
}

if (-not $node) {
  Write-Error "Node.js not found. Install from https://nodejs.org"
  exit 1
}

Write-Host "Using: $node"
Write-Host "Open http://localhost:3000"
& $node server.js
