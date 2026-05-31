param(
  [Parameter(Mandatory=$true)][string]$FrontendDir,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$file = Join-Path $FrontendDir "src/pages/Asistencia.jsx"
if (!(Test-Path $file)) { throw "No se encontro Asistencia.jsx en $file" }

$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $text

# Mantener identificadores internos sin tildes para no romper el build.
$text = [regex]::Replace($text, "Calendarizaci\S*Admin", "CalendarizacionAdmin")
$text = [regex]::Replace($text, "calendarizaci\S*'", "calendarizacion'")
$text = [regex]::Replace($text, "setAdminTab\('calendarizaci\S*'\)", "setAdminTab('calendarizacion')")

# Textos visibles usando escapes Unicode seguros en JSX.
$text = [regex]::Replace($text, ">Calendarizaci\S*</button>", ">{'Calendarizaci\u00f3n'}</button>")
$text = [regex]::Replace($text, "<h1 className=""page-title"">Calendarizaci\S*</h1>", "<h1 className=""page-title"">{'Calendarizaci\u00f3n'}</h1>")
$text = [regex]::Replace($text, "No se pudo guardar la calendarizaci\S*'", "No se pudo guardar la calendarizacion'")

$text = [regex]::Replace($text, "<label className=""block text-xs font-medium text-gold-600 mb-1"">A\S*o escolar</label>", "<label className=""block text-xs font-medium text-gold-600 mb-1"">{'A\u00f1o escolar'}</label>")
$text = [regex]::Replace($text, "\{\['Vacaciones', 'Feriado', 'D\S*a no laborable', 'Otro'\]\.map", "{['Vacaciones', 'Feriado', 'D\u00eda no laborable', 'Otro'].map")
$text = [regex]::Replace($text, "'D\S*a no lectivo'", "'D\u00eda no lectivo'")

# Buscador de asistencia global.
$text = [regex]::Replace($text, 'placeholder="Nombre, DNI, c\S*digo\.\.\."', "placeholder={'Nombre, DNI, c\u00f3digo...'}")

if ($text -eq $original) { throw "No se encontraron textos rotos para corregir." }
[System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))

if ($Publish) {
  Push-Location $FrontendDir
  try {
    git add src/pages/Asistencia.jsx
    git commit -m "Fix attendance calendarization text encoding"
    git push
  } finally {
    Pop-Location
  }
}

Write-Host "Listo. Textos corregidos sin cambiar la logica."
