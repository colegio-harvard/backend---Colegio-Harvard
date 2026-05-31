param(
  [Parameter(Mandatory=$true)][string]$FrontendDir,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$file = Join-Path $FrontendDir "src/pages/Asistencia.jsx"
if (!(Test-Path $file)) { throw "No se encontro Asistencia.jsx en $file" }

$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $text

$text = $text.Replace("const [nota, setNota] = useState('Vacaciones');`r`n  const [loading, setLoading] = useState(false);", "const [nota, setNota] = useState('Vacaciones');`r`n  const [motivoLibre, setMotivoLibre] = useState('');`r`n  const [loading, setLoading] = useState(false);")
$text = $text.Replace("const [nota, setNota] = useState('Vacaciones');`n  const [loading, setLoading] = useState(false);", "const [nota, setNota] = useState('Vacaciones');`n  const [motivoLibre, setMotivoLibre] = useState('');`n  const [loading, setLoading] = useState(false);")

$text = $text.Replace("    if (!anioActivo || !desde || !hasta) return;`r`n    try {", "    if (!anioActivo || !desde || !hasta) return;`r`n    const notaFinal = nota === 'Otro' ? motivoLibre.trim() : nota;`r`n    if (!esLectivo && !notaFinal) {`r`n      toast.error('Ingrese el motivo');`r`n      return;`r`n    }`r`n    try {")
$text = $text.Replace("    if (!anioActivo || !desde || !hasta) return;`n    try {", "    if (!anioActivo || !desde || !hasta) return;`n    const notaFinal = nota === 'Otro' ? motivoLibre.trim() : nota;`n    if (!esLectivo && !notaFinal) {`n      toast.error('Ingrese el motivo');`n      return;`n    }`n    try {")

$text = $text.Replace("nota: esLectivo ? '' : nota", "nota: esLectivo ? '' : notaFinal")

$text = $text.Replace("AÃƒÂ±o escolar", "Año escolar")
$text = $text.Replace("AÃ±o escolar", "Año escolar")

$text = $text.Replace(
  "{['Vacaciones', 'Feriado', 'Dia no laborable', 'Desfile', 'Suspension de clases', 'Otro'].map(x => <option key={x} value={x}>{x}</option>)}",
  "{['Vacaciones', 'Feriado', 'Día no laborable', 'Otro'].map(x => <option key={x} value={x}>{x}</option>)}"
)

$selectBlock = @"
            <select value={nota} onChange={(e) => setNota(e.target.value)} className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm">
              {['Vacaciones', 'Feriado', 'Día no laborable', 'Otro'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
"@
$selectReplacement = @"
            <select value={nota} onChange={(e) => setNota(e.target.value)} className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm">
              {['Vacaciones', 'Feriado', 'Día no laborable', 'Otro'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            {nota === 'Otro' && (
              <input
                type="text"
                value={motivoLibre}
                onChange={(e) => setMotivoLibre(e.target.value)}
                placeholder="Escriba el motivo"
                className="w-full mt-2 px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm"
              />
            )}
"@
if ($text.Contains($selectBlock)) {
  $text = $text.Replace($selectBlock, $selectReplacement)
} elseif ($text -notmatch "motivoLibre") {
  throw "No se encontro el selector de motivo para agregar motivo libre."
}

$text = $text.Replace("bg-cream-100 text-primary-700", "bg-white border border-cream-300 text-primary-700 shadow-sm hover:bg-cream-50")

if ($text -eq $original) { throw "No se aplicaron cambios en Asistencia.jsx." }
[System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))

if ($Publish) {
  Push-Location $FrontendDir
  try {
    git add src/pages/Asistencia.jsx
    git commit -m "Refine attendance calendarization UI"
    git push
  } finally {
    Pop-Location
  }
}

Write-Host "Listo. Calendarizacion actualizada."
