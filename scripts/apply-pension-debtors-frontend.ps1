param(
  [string]$FrontendDir = "C:\Users\USUARIO\Desktop\frontend---Colegio-Harvard",
  [switch]$Publish
)

$ErrorActionPreference = "Stop"

function Write-FileUtf8NoBom {
  param([string]$Path, [string]$Content)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

if (-not (Test-Path $FrontendDir)) {
  throw "No existe la carpeta del frontend: $FrontendDir"
}

$servicePath = Join-Path $FrontendDir "src\services\pensionesService.js"
$pagePath = Join-Path $FrontendDir "src\pages\Pensiones.jsx"
if (-not (Test-Path $servicePath)) { throw "No existe pensionesService.js" }
if (-not (Test-Path $pagePath)) { throw "No existe Pensiones.jsx" }

$service = Get-Content -Raw -Path $servicePath
if ($service -notmatch "exportarDeudoresPensionesExcel") {
  $service = $service.TrimEnd() + "`r`nexport const exportarDeudoresPensionesExcel = (params) => apiClient.get('/pensiones/deudores/exportar-excel', { params, responseType: 'blob' });`r`n"
  Write-FileUtf8NoBom -Path $servicePath -Content $service
}

$content = Get-Content -Raw -Path $pagePath

if ($content -notmatch "exportarDeudoresPensionesExcel") {
  $content = $content.Replace(
    "import { obtenerPlantilla, obtenerEstadoPension, cuadriculaPensiones, registrarPago, obtenerDetalleMes, obtenerTicketPension } from '../services/pensionesService';",
    "import { obtenerPlantilla, obtenerEstadoPension, cuadriculaPensiones, registrarPago, obtenerDetalleMes, obtenerTicketPension, exportarDeudoresPensionesExcel } from '../services/pensionesService';"
  )
}

if ($content -notmatch "HiDownload") {
  $content = $content.Replace(
    "import { HiCheck, HiX, HiMinus, HiSearch, HiClock, HiChevronLeft, HiChevronRight, HiPrinter } from 'react-icons/hi';",
    "import { HiCheck, HiX, HiMinus, HiSearch, HiClock, HiChevronLeft, HiChevronRight, HiPrinter, HiDownload } from 'react-icons/hi';"
  )
}

if ($content -notmatch "conceptoDeudores") {
  $content = $content.Replace(
    "  const [ticketBusqueda, setTicketBusqueda] = useState('');",
    "  const [ticketBusqueda, setTicketBusqueda] = useState('');`r`n  const [conceptoDeudores, setConceptoDeudores] = useState('');`r`n  const [descargandoDeudores, setDescargandoDeudores] = useState(false);"
  )
}

if ($content -notmatch "handleExportarDeudores") {
  $marker = "  const handlePagoRegistrado = () => {"
  $handler = @'
  const handleExportarDeudores = async () => {
    if (!conceptoDeudores) return toast.error('Seleccione el concepto de cobro');
    const loadingToast = toast.loading('Preparando lista de deudores...');
    try {
      setDescargandoDeudores(true);
      const params = { concepto: conceptoDeudores };
      if (filtros.id_nivel) params.id_nivel = filtros.id_nivel;
      if (filtros.id_grado) params.id_grado = filtros.id_grado;
      if (filtros.id_aula) params.id_aula = filtros.id_aula;
      const res = await exportarDeudoresPensionesExcel(params);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disposition = res.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      link.href = url;
      link.download = match?.[1] || `deudores-${conceptoDeudores}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Lista de deudores descargada', { id: loadingToast });
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo descargar la lista', { id: loadingToast });
    } finally {
      setDescargandoDeudores(false);
    }
  };

'@
  if (-not $content.Contains($marker)) { throw "No se encontro punto para insertar funcion de deudores" }
  $content = $content.Replace($marker, $handler + $marker)
}

if ($content -notmatch "Lista deudores") {
  $buttonMarker = @'
            <button
              onClick={handleFiltrar}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm text-sm font-medium"
          >
            Filtrar
          </button>
'@
  $debtorsBlock = @'
            <div>
              <label className="block text-xs font-medium text-gold-600 mb-1">Concepto de deuda</label>
              <select
                value={conceptoDeudores}
                onChange={(e) => setConceptoDeudores(e.target.value)}
                className="px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm bg-white"
              >
                <option value="">Seleccione...</option>
                {plantilla.map(p => <option key={p.clave} value={p.clave}>{nombreMes(p)}</option>)}
              </select>
            </div>

            <button
              onClick={handleExportarDeudores}
              disabled={descargandoDeudores}
              className="self-end inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm text-sm font-medium"
            >
              <HiDownload className="w-4 h-4" />
              {descargandoDeudores ? 'Preparando...' : 'Lista deudores'}
            </button>

'@
  if ($content.Contains($buttonMarker)) {
    $content = $content.Replace($buttonMarker, $debtorsBlock + $buttonMarker)
  } else {
    throw "No se encontro el boton Filtrar para insertar deudores."
  }
}

Write-FileUtf8NoBom -Path $pagePath -Content $content

Push-Location $FrontendDir
try {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    npm run build
  } else {
    Write-Warning "npm no esta disponible en esta terminal. Se omitio la compilacion local; Railway compilara al desplegar."
  }

  if ($Publish) {
    git add src/services/pensionesService.js src/pages/Pensiones.jsx
    git commit -m "Add pension debtors export"
    git push
  }
} finally {
  Pop-Location
}

Write-Host "Listo. Pensiones actualizado con exportacion de deudores por concepto."
