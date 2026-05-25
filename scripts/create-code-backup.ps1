param(
  [string]$BackendDir = "C:\Users\USUARIO\Desktop\Software del colegio\backend---Colegio-Harvard-main",
  [string]$FrontendDir = "C:\Users\USUARIO\Desktop\frontend---Colegio-Harvard"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackendDir)) {
  throw "No existe la carpeta del backend: $BackendDir"
}

if (-not (Test-Path $FrontendDir)) {
  throw "No existe la carpeta del frontend: $FrontendDir"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $BackendDir "backups"
$workDir = Join-Path $backupDir "tmp-code-backup-$stamp"
$backendCopy = Join-Path $workDir "backend---Colegio-Harvard-main"
$frontendCopy = Join-Path $workDir "frontend---Colegio-Harvard"
$backendZip = Join-Path $backupDir "backend-colegio-harvard-$stamp.zip"
$frontendZip = Join-Path $backupDir "frontend-colegio-harvard-$stamp.zip"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

try {
  robocopy $BackendDir $backendCopy /E /XD node_modules .git dist build backups .frontend-deploy-git /XF *.zip | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "Error copiando backend. Codigo robocopy: $LASTEXITCODE" }

  robocopy $FrontendDir $frontendCopy /E /XD node_modules .git dist build /XF *.zip | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "Error copiando frontend. Codigo robocopy: $LASTEXITCODE" }

  Compress-Archive -Path $backendCopy -DestinationPath $backendZip -Force
  Compress-Archive -Path $frontendCopy -DestinationPath $frontendZip -Force

  Write-Host ""
  Write-Host "Backup creado correctamente:"
  Get-Item $backendZip, $frontendZip | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize
} finally {
  if (Test-Path $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
