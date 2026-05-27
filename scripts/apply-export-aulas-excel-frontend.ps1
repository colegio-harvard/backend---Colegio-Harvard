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

function Replace-Required($Text, $Find, $Replace, $Label) {
  if (!$Text.Contains($Find)) { throw "No se encontro el bloque esperado: $Label" }
  return $Text.Replace($Find, $Replace)
}

function Frontend-Git {
  & git -C $FrontendDir -c "safe.directory=$FrontendDir" @args
  if ($LASTEXITCODE -ne 0) { throw "Fallo Git frontend: git $($args -join ' ')" }
}

$servicePath = Join-Path $FrontendDir "src\services\alumnosService.js"
$pagePath = Join-Path $FrontendDir "src\pages\Alumnos.jsx"
if (!(Test-Path $servicePath)) { throw "No existe alumnosService.js" }
if (!(Test-Path $pagePath)) { throw "No existe Alumnos.jsx" }

$service = Read-Text $servicePath
if ($service -notmatch "exportarAulasExcel") {
  $service = $service.TrimEnd() + "`r`nexport const exportarAulasExcel = () => apiClient.get('/alumnos/exportar-aulas-excel', { responseType: 'blob' });`r`n"
  Write-Text $servicePath $service
}

$page = Read-Text $pagePath
if ($page -notmatch "exportarAulasExcel") {
  $page = Replace-Required $page `
    "import { listarAlumnos, crearAlumno, actualizarAlumno, obtenerCarnet, eliminarAlumno, obtenerSiguienteCodigoAlumno } from '../services/alumnosService';" `
    "import { listarAlumnos, crearAlumno, actualizarAlumno, obtenerCarnet, eliminarAlumno, obtenerSiguienteCodigoAlumno, exportarAulasExcel } from '../services/alumnosService';" `
    "importar servicio exportar aulas"

  $handler = @'

  const handleExportarAulasExcel = async () => {
    try {
      const response = await exportarAulasExcel();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `aulas-alumnos-${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel de aulas descargado');
    } catch {
      toast.error('No se pudo descargar el Excel');
    }
  };
'@
  $page = Replace-Required $page "  // ===================== RENDER =====================" "$handler`r`n  // ===================== RENDER =====================" "insertar funcion exportar"

  $old = @'
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm text-sm font-medium">
          <HiPlus className="w-4 h-4" /> Nuevo Alumno
        </button>
'@
  $new = @'
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExportarAulasExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm text-sm font-medium">
            <HiDownload className="w-4 h-4" /> Exportar Aulas Excel
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm text-sm font-medium">
            <HiPlus className="w-4 h-4" /> Nuevo Alumno
          </button>
        </div>
'@
  $page = Replace-Required $page $old $new "boton nuevo alumno"
  Write-Text $pagePath $page
}

Frontend-Git diff -- src/services/alumnosService.js src/pages/Alumnos.jsx
Frontend-Git add src/services/alumnosService.js src/pages/Alumnos.jsx
Frontend-Git commit -m "Add classrooms Excel export"
if ($Publish) { Frontend-Git push origin main }

Write-Host "Listo. Boton Exportar Aulas Excel agregado en Alumnos."
