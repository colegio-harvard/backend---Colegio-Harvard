param(
  [Parameter(Mandatory=$true)][string]$FrontendDir,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$file = Join-Path $FrontendDir "src/pages/Asistencia.jsx"
if (!(Test-Path $file)) { throw "No se encontro Asistencia.jsx en $file" }

$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $text

$text = $text.Replace("Calendarizacion", "Calendarización")
$text = $text.Replace("calendarizacion", "calendarización")
$text = $text.Replace("DÃƒÂ­a no laborable", "Día no laborable")
$text = $text.Replace("DÃ­a no laborable", "Día no laborable")
$text = $text.Replace("Dia no laborable", "Día no laborable")
$text = $text.Replace("Dia no lectivo", "Día no lectivo")
$text = $text.Replace("AÃƒÂ±o escolar", "Año escolar")
$text = $text.Replace("AÃ±o escolar", "Año escolar")
$text = $text.Replace("No se pudo guardar la calendarización", "No se pudo guardar la calendarización")

if ($text -eq $original) { throw "No se encontraron textos de calendarizacion para corregir." }
[System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))

if ($Publish) {
  Push-Location $FrontendDir
  try {
    git add src/pages/Asistencia.jsx
    git commit -m "Fix calendarization labels"
    git push
  } finally {
    Pop-Location
  }
}

Write-Host "Listo. Textos de Calendarizacion corregidos."
