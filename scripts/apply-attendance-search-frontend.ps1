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

function Invoke-FrontendGit {
  & git -C $FrontendDir -c "safe.directory=$FrontendDir" @args
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo Git en frontend: git $($args -join ' ')"
  }
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
    "icono Buscar"
}

if ($text -notmatch "buscar: ''") {
  $text = Replace-Required $text `
    "const [filtros, setFiltros] = useState({ id_nivel: '', id_grado: '', id_aula: '', estado: '' });" `
    "const [filtros, setFiltros] = useState({ id_nivel: '', id_grado: '', id_aula: '', estado: '', buscar: '' });" `
    "estado filtros"
}

if ($text -notmatch "params\.buscar = filtros\.buscar\.trim\(\)") {
  $text = $text -replace "(\s+if \(filtros\.estado\) params\.estado = filtros\.estado;\r?\n)(\s+const \{ data \} = await asistenciaGlobal\(params\);)", "`$1      if (filtros.buscar?.trim()) params.buscar = filtros.buscar.trim();`r`n`$2"
  $text = $text -replace "(\s+if \(filtros\.estado\) params\.estado = filtros\.estado;\r?\n)(\s+const response = await exportarExcelAsistencia\(params\);)", "`$1      if (filtros.buscar?.trim()) params.buscar = filtros.buscar.trim();`r`n`$2"
}

if ($text -notmatch "value=\{filtros\.buscar\}") {
  $searchBlock = @'
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
          <button onClick={handleFiltrar} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm text-sm font-medium">
            Filtrar
          </button>
'@

  $filterButtonPattern = '(?s)\s{10}<button\s+onClick=\{handleFiltrar\}[^>]*>\s*Filtrar\s*</button>'
  if ($text -notmatch $filterButtonPattern) {
    throw "No se encontro el bloque esperado: boton Filtrar"
  }
  $text = [regex]::Replace($text, $filterButtonPattern, "`r`n$searchBlock", 1)
}

if ($text -eq $original) {
  Write-Host "El buscador de asistencia ya estaba aplicado."
} else {
  Write-Text $pagePath $text
}

if (Test-Path (Join-Path $FrontendDir ".git")) {
  Invoke-FrontendGit diff -- src/pages/Asistencia.jsx
  $status = & git -C $FrontendDir -c "safe.directory=$FrontendDir" status --porcelain -- src/pages/Asistencia.jsx
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo Git en frontend: git status"
  }

  if ($status) {
    Invoke-FrontendGit add src/pages/Asistencia.jsx
    Invoke-FrontendGit commit -m "Add attendance student search"
  } else {
    Write-Host "No habia cambios pendientes para confirmar en frontend."
  }

  if ($Publish) {
    Invoke-FrontendGit push origin main
  }
} else {
  Write-Host "Frontend actualizado, pero no se encontro repositorio Git en $FrontendDir."
}

Write-Host "Listo. Asistencia Global ahora tiene buscador por nombre, DNI o codigo."
