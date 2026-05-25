param(
  [string]$FrontendDir = "C:\Users\USUARIO\Desktop\frontend---Colegio-Harvard",
  [switch]$Publish
)

$ErrorActionPreference = "Stop"

function Read-Text($Path) {
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-Text($Path, $Content) {
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function New-AccentText([int[]]$Codes) {
  return -join ($Codes | ForEach-Object { [char]$_ })
}

function Repair-MojibakeLine($Line) {
  if ($Line -notmatch "[ÃÂ]") { return $Line }
  try {
    $bytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($Line)
    $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
    if ($fixed -notmatch [char]0xFFFD) { return $fixed }
  } catch {
    return $Line
  }
  return $Line
}

$srcDir = Join-Path $FrontendDir "src"
if (!(Test-Path $srcDir)) {
  throw "No se encontro la carpeta src del frontend en $srcDir"
}

$a = [char]0x00E1
$e = [char]0x00E9
$i = [char]0x00ED
$o = [char]0x00F3
$u = [char]0x00FA
$n = [char]0x00F1
$A = [char]0x00C1
$E = [char]0x00C9
$I = [char]0x00CD
$O = [char]0x00D3
$U = [char]0x00DA
$N = [char]0x00D1

function Replace-VisibleText($Text) {
  $pairs = @(
    @("'Auditoria'", "'Auditor$($i)a'"),
    @("""Auditoria""", """Auditor$($i)a"""),
    @(">Auditoria<", ">Auditor$($i)a<"),
    @("Auditoria exportada", "Auditor$($i)a exportada"),
    @("Error al cargar auditoria", "Error al cargar auditor$($i)a"),
    @("No hay registros de auditoria", "No hay registros de auditor$($i)a"),
    @("Detalle de auditoria", "Detalle de auditor$($i)a"),
    @("Accion<", "Acci$($o)n<"),
    @("Accion'", "Acci$($o)n'"),
    @("Accion`"", "Acci$($o)n`""),
    @("Detalle tecnico", "Detalle t$($e)cnico"),
    @("Ticket de pago de pension", "Ticket de pago de pensi$($o)n"),
    @("Alumnos con pension pendiente", "Alumnos con pensi$($o)n pendiente"),
    @("Alumno, DNI, codigo de alumno o ticket", "Alumno, DNI, c$($o)digo de alumno o ticket"),
    @("Quitar seleccion", "Quitar selecci$($o)n"),
    @("Año Escolar", "A$($n)o Escolar"),
    @("Ano Escolar", "A$($n)o Escolar"),
    @("No hay año escolar activo", "No hay a$($n)o escolar activo"),
    @("No hay ano escolar activo", "No hay a$($n)o escolar activo"),
    @("Configure un año escolar activo", "Configure un a$($n)o escolar activo"),
    @("Configure un ano escolar activo", "Configure un a$($n)o escolar activo"),
    @("Alertas rapidas", "Alertas r$($a)pidas"),
    @("Alertas `"No llego`" abiertas", "Alertas `"No lleg$($o)`" abiertas"),
    @("Asistencia por Salon", "Asistencia por sal$($o)n"),
    @("Resumen financiero del año escolar", "Resumen financiero del a$($n)o escolar"),
    @("Resumen financiero del ano escolar", "Resumen financiero del a$($n)o escolar"),
    @("Ir a cuadricula", "Ir a cuadr$($i)cula"),
    @("via WebSocket", "v$($i)a WebSocket")
  )

  foreach ($pair in $pairs) {
    $Text = $Text.Replace($pair[0], $pair[1])
  }
  return $Text
}

$files = Get-ChildItem -Path $srcDir -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx,*.css
$changed = @()

foreach ($file in $files) {
  $text = Read-Text $file.FullName
  $original = $text

  $lines = $text -split "(`r`n|`n|`r)", -1
  for ($idx = 0; $idx -lt $lines.Count; $idx++) {
    if ($idx % 2 -eq 0) {
      $lines[$idx] = Repair-MojibakeLine $lines[$idx]
    }
  }
  $text = -join $lines
  $text = $text.Replace([string][char]0x00A0, " ")

  $text = Replace-VisibleText $text

  if ($text -ne $original) {
    Write-Text $file.FullName $text
    $changed += $file.FullName
  }
}

if ($changed.Count -eq 0) {
  Write-Host "No se encontraron textos por corregir."
} else {
  Write-Host "Archivos corregidos:"
  $changed | ForEach-Object { Write-Host " - $_" }
}

Push-Location $FrontendDir
try {
  git diff -- src
  git add src
  git commit -m "Fix frontend Spanish text encoding"
  if ($Publish) {
    git push origin main
  }
} finally {
  Pop-Location
}

Write-Host "Listo. Textos del frontend corregidos."
