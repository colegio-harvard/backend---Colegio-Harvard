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

function Require-Text {
  param([string]$Content, [string]$Needle, [string]$Label)
  if (-not $Content.Contains($Needle)) {
    throw "No se encontro el bloque esperado para: $Label"
  }
}

if (-not (Test-Path $FrontendDir)) {
  throw "No existe la carpeta del frontend: $FrontendDir"
}

$servicesDir = Join-Path $FrontendDir "src\services"
$dashboardPath = Join-Path $FrontendDir "src\pages\dashboards\DashboardAdmin.jsx"
$backupServicePath = Join-Path $servicesDir "backupService.js"

if (-not (Test-Path $dashboardPath)) {
  throw "No existe DashboardAdmin.jsx en: $dashboardPath"
}

$backupService = @'
import apiClient from './apiClient';

export const descargarRespaldoSistema = () => apiClient.get('/backup/sistema', { responseType: 'blob' });
'@
Write-FileUtf8NoBom -Path $backupServicePath -Content $backupService

$content = Get-Content -Raw -Path $dashboardPath

if ($content -notmatch "react-hot-toast") {
  $content = $content.Replace("import { useNavigate } from 'react-router-dom';", "import { useNavigate } from 'react-router-dom';`r`nimport toast from 'react-hot-toast';")
}

if ($content -notmatch "backupService") {
  $content = $content.Replace("import { dashboardAdmin } from '../../services/asistenciaService';", "import { dashboardAdmin } from '../../services/asistenciaService';`r`nimport { descargarRespaldoSistema } from '../../services/backupService';")
}

if ($content -notmatch "HiDownload") {
  $content = $content.Replace("HiSpeakerphone, HiCurrencyDollar, HiCalendar, HiShieldCheck, HiDocumentText,", "HiSpeakerphone, HiCurrencyDollar, HiCalendar, HiShieldCheck, HiDocumentText, HiDownload,")
}

if ($content -notmatch "backupLoading") {
  Require-Text -Content $content -Needle "const [loading, setLoading] = useState(true);" -Label "estado loading dashboard"
  $content = $content.Replace("const [loading, setLoading] = useState(true);", "const [loading, setLoading] = useState(true);`r`n  const [backupLoading, setBackupLoading] = useState(false);")
}

if ($content -notmatch "handleDescargarRespaldo") {
  $marker = "  if (loading) return <LoadingSpinner />;"
  Require-Text -Content $content -Needle $marker -Label "punto para funcion de respaldo"
  $handler = @'

  const handleDescargarRespaldo = async () => {
    if (backupLoading) return;
    const loadingToast = toast.loading('Preparando respaldo...');
    try {
      setBackupLoading(true);
      const response = await descargarRespaldoSistema();
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      link.href = url;
      link.download = match?.[1] || `respaldo-sistema-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Respaldo descargado', { id: loadingToast });
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo descargar el respaldo', { id: loadingToast });
    } finally {
      setBackupLoading(false);
    }
  };

'@
  $content = $content.Replace($marker, $handler + $marker)
}

$oldHeader = @'
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Dashboard</h1>
        <span className="text-sm text-gold-600 font-medium">
          {new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>
'@

$newHeader = @'
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="page-title">Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {usuario?.rol_codigo === ROLES.SUPER_ADMIN && (
            <button
              type="button"
              onClick={handleDescargarRespaldo}
              disabled={backupLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <HiDownload className="w-5 h-5" />
              {backupLoading ? 'Preparando...' : 'Respaldar sistema'}
            </button>
          )}
          <span className="text-sm text-gold-600 font-medium">
            {new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>
'@

if ($content.Contains($oldHeader)) {
  $content = $content.Replace($oldHeader, $newHeader)
} elseif ($content -notmatch "Respaldar sistema") {
  throw "No se encontro el encabezado esperado del dashboard."
}

Write-FileUtf8NoBom -Path $dashboardPath -Content $content

Push-Location $FrontendDir
try {
  npm run build
  if ($Publish) {
    git add src/services/backupService.js src/pages/dashboards/DashboardAdmin.jsx
    git commit -m "Add full system backup download"
    git push
  }
} finally {
  Pop-Location
}

Write-Host "Listo. Frontend actualizado con el boton de respaldo completo."
