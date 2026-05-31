param(
  [Parameter(Mandatory=$true)][string]$FrontendDir,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$file = Join-Path $FrontendDir "src/pages/Asistencia.jsx"
if (!(Test-Path $file)) { throw "No se encontro Asistencia.jsx en $file" }

$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $text

$old = "{dia.estado && <div className=""text-xs font-medium"">{dia.estado === 'NO_LECTIVO' ? 'E' : ESTADO_ASISTENCIA_LABELS[dia.estado]?.label?.charAt(0)}</div>}"
$new = "{dia.estado && (dia.estado === 'NO_LECTIVO' ? <div className=""text-[10px] font-semibold leading-tight px-0.5 break-words"">{dia.nota || 'Especial'}</div> : <div className=""text-xs font-medium"">{ESTADO_ASISTENCIA_LABELS[dia.estado]?.label?.charAt(0)}</div>)}"

$text = $text.Replace($old, $new)

if ($text -eq $original) { throw "No se encontro el bloque del calendario para mostrar el motivo especial." }
[System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))

if ($Publish) {
  Push-Location $FrontendDir
  try {
    git add src/pages/Asistencia.jsx
    git commit -m "Show special attendance day reason"
    git push
  } finally {
    Pop-Location
  }
}

Write-Host "Listo. Fechas especiales ahora muestran el motivo en el calendario."
