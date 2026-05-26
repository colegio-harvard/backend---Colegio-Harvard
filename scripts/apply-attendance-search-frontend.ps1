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

function Replace-Required([string]$Text, [string]$Find, [string]$Replace, [string]$Label) {
  if (!$Text.Contains($Find)) { throw "No se encontro el bloque esperado: $Label" }
  return $Text.Replace($Find, $Replace)
}

$pagePath = Join-Path $FrontendDir "src\pages\Asistencia.jsx"
if (!(Test-Path $pagePath)) {
  throw "No se encontro Asistencia.jsx en $pagePath"
}

$text = Read-Text $pagePath
$original = $text

if ($text -notmatch "HiSearch") {
  $text = Replace-Required $text `
    "import { HiDownload, HiCalendar, HiViewGrid, HiViewList } from 'react-icons/hi';" `
    "import { HiDownload, HiCalendar, HiViewGrid, HiViewList, HiSearch } from 'react-icons/hi';" `
    "importar icono de busqueda"
}

if ($text -notmatch "buscar: ''") {
  $text = Replace-Required $text `
    "const [filtros, setFiltros] = useState({ id_nivel: '', id_grado: '', id_aula: '', estado: '' });" `
    "const [filtros, setFiltros] = useState({ id_nivel: '', id_grado: '', id_aula: '', estado: '', buscar: '' });" `
    "estado filtros con buscar"
}

if ($text -notmatch "params\.buscar = filtros\.buscar\.trim\(\)") {
  $text = $text -replace "(\s+if \(filtros\.estado\) params\.estado = filtros\.estado;\r?\n)(\s+const \{ data \} = await asistenciaGlobal\(params\);)", "`$1      if (filtros.buscar?.trim()) params.buscar = filtros.buscar.trim();`r`n`$2"
  $text = $text -replace "(\s+if \(filtros\.estado\) params\.estado = filtros\.estado;\r?\n)(\s+const response = await exportarExcelAsistencia\(params\);)", "`$1      if (filtros.buscar?.trim()) params.buscar = filtros.buscar.trim();`r`n`$2"
}

if ($text -notmatch "value=\{filtros\.buscar\}") {
  $needle = @'
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Estado</label>
            <select value={filtros.estado} onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
              className="px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm">
              <option value="">Todos</option>
              <option value="PRESENTE">Asistió</option>
              <option value="TARDE">Tardanza</option>
              <option value="AUSENTE">Faltó</option>
            </select>
          </div>
'@
  $insert = @'
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Estado</label>
            <select value={filtros.estado} onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
              className="px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm">
              <option value="">Todos</option>
              <option value="PRESENTE">Asistió</option>
              <option value="TARDE">Tardanza</option>
              <option value="AUSENTE">Faltó</option>
            </select>
          </div>
          <div className="min-w-[240px] flex-1">
            <label className="block text-xs font-medium text-gold-600 mb-1">Buscar</label>
            <div className="relative">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-400" />
              <input
                type="text"
                value={filtros.buscar}
                onChange={(e) => setFiltros({...filtros, buscar: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && handleFiltrar()}
                className="w-full pl-9 pr-3 py-2 border border-cream-300 rounded-lg outline-none text-sm"
                placeholder="Nombre, DNI, código..."
              />
            </div>
          </div>
'@
  if (!$text.Contains($needle)) {
    throw "No se encontro el bloque del filtro Estado para insertar Buscar."
  }
  $text = $text.Replace($needle, $insert)
}

if ($text -eq $original) {
  Write-Host "El buscador de asistencia ya estaba aplicado."
} else {
  Write-Text $pagePath $text
}

Push-Location $FrontendDir
try {
  git diff -- src/pages/Asistencia.jsx
  git add src/pages/Asistencia.jsx
  git commit -m "Add attendance student search"
  if ($Publish) {
    git push origin main
  }
} finally {
  Pop-Location
}

Write-Host "Listo. Asistencia Global ahora tiene buscador por nombre, DNI o codigo."
