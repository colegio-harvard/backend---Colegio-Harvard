param(
  [string]$FrontendDir = "C:\Users\USUARIO\Desktop\frontend---Colegio-Harvard",
  [switch]$Publish
)

$ErrorActionPreference = "Stop"

function Read-Text($Path) {
  return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) -replace "`r`n", "`n"
}

function Write-Text($Path, $Text) {
  [System.IO.File]::WriteAllText($Path, $Text, [System.Text.Encoding]::UTF8)
}

function Replace-Text([ref]$Text, [string]$Find, [string]$Replace, [string]$Label) {
  if ($Text.Value.Contains($Replace)) { return }
  if (-not $Text.Value.Contains($Find)) { throw "No se encontro el bloque esperado para: $Label" }
  $Text.Value = $Text.Value.Replace($Find, $Replace)
}

$srcDir = Join-Path $FrontendDir "src"
$pagePath = Join-Path $srcDir "pages\ReportePagos.jsx"
$servicePath = Join-Path $srcDir "services\pensionesService.js"

foreach ($path in @($pagePath, $servicePath)) {
  if (-not (Test-Path $path)) { throw "No se encontro $path" }
}

$service = Read-Text $servicePath
if ($service -notmatch "exportarReportePagosExcel") {
  $service += "`nexport const exportarReportePagosExcel = () => apiClient.get('/pensiones/reporte-pagos/exportar-excel', { responseType: 'blob' });`n"
  Write-Text $servicePath $service
}

$page = Read-Text $pagePath
Replace-Text ([ref]$page) `
  "import { cuadriculaPensiones, obtenerPlantilla } from '../services/pensionesService';" `
  "import { cuadriculaPensiones, obtenerPlantilla, exportarReportePagosExcel } from '../services/pensionesService';" `
  "import export service"

Replace-Text ([ref]$page) `
  "import { HiCheck, HiClock, HiCurrencyDollar, HiMinus, HiSearch, HiX } from 'react-icons/hi';" `
  "import { HiCheck, HiClock, HiCurrencyDollar, HiDownload, HiMinus, HiSearch, HiX } from 'react-icons/hi';" `
  "import download icon"

$handler = @'

  const descargarBackupPagos = async () => {
    try {
      const res = await exportarReportePagosExcel();
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-pagos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Backup de pagos descargado');
    } catch (err) {
      toast.error('No se pudo descargar el backup de pagos');
    }
  };
'@

Replace-Text ([ref]$page) `
  "  if (loading) return <LoadingSpinner />;" `
  "$handler`n  if (loading) return <LoadingSpinner />;" `
  "download handler"

Replace-Text ([ref]$page) `
  "        <div>`n          <h1 className=`"page-title`">Reporte de Pagos</h1>`n          <p className=`"text-sm text-primary-800/60`">Ordenado por Inicial, Primaria y Secundaria.</p>`n        </div>`n      </div>" `
  "        <div>`n          <h1 className=`"page-title`">Reporte de Pagos</h1>`n          <p className=`"text-sm text-primary-800/60`">Ordenado por Inicial, Primaria y Secundaria.</p>`n        </div>`n        <button onClick={descargarBackupPagos} className=`"inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700`">`n          <HiDownload className=`"h-4 w-4`" /> Descargar Excel`n        </button>`n      </div>" `
  "download button"

Write-Text $pagePath $page

if ($Publish) {
  Push-Location $FrontendDir
  try {
    git add src/services/pensionesService.js src/pages/ReportePagos.jsx
    git commit -m "Add payment report Excel backup export"
    git push
  } finally {
    Pop-Location
  }
}

Write-Host "Listo. Frontend actualizado con boton de backup Excel de pagos."
