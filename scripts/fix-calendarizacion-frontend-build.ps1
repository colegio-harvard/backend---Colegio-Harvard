param(
  [Parameter(Mandatory=$true)][string]$FrontendDir,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$file = Join-Path $FrontendDir "src/pages/Asistencia.jsx"
if (!(Test-Path $file)) { throw "No se encontro Asistencia.jsx en $file" }

$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $text

$badImportPattern = "import \{ listarNiveles, listarGrados, listarAulas, .*? as listarAnios, obtenerCalendario, actualizarDiaCalendario \} from '../services/configEscolarService';"
$goodImports = @"
import { listarNiveles, listarGrados, listarAulas, obtenerCalendario, actualizarDiaCalendario } from '../services/configEscolarService';
import * as configEscolarService from '../services/configEscolarService';
"@.Trim()

$text = [regex]::Replace($text, $badImportPattern, $goodImports, 1)
$text = $text.Replace("const { data } = await listarAnios();", "const { data } = await configEscolarService['listarA\u00f1os']();")
$text = $text.Replace("AÃƒÂ±o escolar", "Año escolar")

if ($text -eq $original) { throw "No se encontraron cambios que aplicar en Asistencia.jsx." }
[System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))

if ($Publish) {
  Push-Location $FrontendDir
  try {
    git add src/pages/Asistencia.jsx
    git commit -m "Fix attendance calendarization build"
    git push
  } finally {
    Pop-Location
  }
}

Write-Host "Listo. Build de calendarizacion corregido en el frontend."
