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
$pagePath = Join-Path $srcDir "pages\ImportarPagosExcel.jsx"
$servicePath = Join-Path $srcDir "services\pensionesService.js"
$appPath = Join-Path $srcDir "App.jsx"
$sidebarPath = Join-Path $srcDir "components\layout\Sidebar.jsx"

foreach ($path in @($servicePath, $appPath, $sidebarPath)) {
  if (-not (Test-Path $path)) { throw "No se encontro $path" }
}

$page = @'
import { useState } from 'react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { previewImportacionPensiones, aplicarImportacionPensiones } from '../services/pensionesService';
import { HiUpload, HiCheckCircle, HiExclamationCircle } from 'react-icons/hi';

const formatMonto = (n) => n == null ? '-' : `S/. ${Number(n || 0).toFixed(2)}`;

const Stat = ({ label, value }) => (
  <div className="rounded-lg border border-cream-200 bg-cream-50 px-4 py-3">
    <div className="text-xs text-gold-600 font-medium">{label}</div>
    <div className="text-2xl font-bold text-primary-800">{value}</div>
  </div>
);

const ImportarPagosExcel = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [resultado, setResultado] = useState(null);

  const makeFormData = () => {
    const fd = new FormData();
    fd.append('archivo', file);
    return fd;
  };

  const handlePreview = async () => {
    if (!file) return toast.error('Seleccione un archivo Excel');
    setLoading(true);
    setResultado(null);
    try {
      const res = await previewImportacionPensiones(makeFormData());
      setPreview(res.data?.data || null);
      toast.success('Excel analizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo analizar el Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!file) return toast.error('Seleccione un archivo Excel');
    if (!preview) return toast.error('Primero genere la vista previa');
    setApplying(true);
    try {
      const res = await aplicarImportacionPensiones(makeFormData());
      setResultado(res.data?.data?.resultado || null);
      toast.success('Importacion aplicada');
      setPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo aplicar la importacion');
    } finally {
      setApplying(false);
    }
  };

  const resumen = preview?.resumen;
  const coincidencias = preview?.coincidencias || [];
  const noEncontrados = preview?.noEncontrados || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Importar pagos desde Excel</h1>
        <p className="text-sm text-primary-800/60 mt-1">Suba la matriz actual para revisar coincidencias antes de guardar cambios.</p>
      </div>

      <Card>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-800/80 mb-2">Archivo Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResultado(null); }}
              className="block w-full text-sm text-primary-800 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-700"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={handlePreview} disabled={loading || !file} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">
              {loading ? <LoadingSpinner size="sm" /> : <HiUpload className="w-5 h-5" />}
              Analizar Excel
            </button>
            <button onClick={handleApply} disabled={applying || !preview} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
              {applying ? <LoadingSpinner size="sm" /> : <HiCheckCircle className="w-5 h-5" />}
              Aplicar importacion
            </button>
          </div>
        </div>
      </Card>

      {resultado && (
        <Card>
          <div className="p-5">
            <h2 className="font-display text-xl text-primary-800 mb-4">Resultado aplicado</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Stat label="Alumnos actualizados" value={resultado.alumnos_actualizados} />
              <Stat label="Campos de montos" value={resultado.campos_montos_actualizados} />
              <Stat label="Pagos creados" value={resultado.pagos_creados} />
              <Stat label="Pagos omitidos" value={resultado.pagos_omitidos_existentes} />
              <Stat label="No encontrados" value={resultado.alumnos_no_encontrados} />
            </div>
          </div>
        </Card>
      )}

      {resumen && (
        <Card>
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-2">
              <HiExclamationCircle className="w-5 h-5 text-gold-600" />
              <h2 className="font-display text-xl text-primary-800">Vista previa</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <Stat label="Filas Excel" value={resumen.filas_excel} />
              <Stat label="Encontrados" value={resumen.alumnos_encontrados} />
              <Stat label="No encontrados" value={resumen.alumnos_no_encontrados} />
              <Stat label="Cambios de montos" value={resumen.cambios_montos} />
              <Stat label="Pagos nuevos" value={resumen.pagos_nuevos} />
              <Stat label="Pagos omitidos" value={resumen.pagos_omitidos_existentes} />
            </div>

            <div className="overflow-x-auto border border-cream-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-cream-50 text-gold-600 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Alumno</th>
                    <th className="px-3 py-2 text-left">Cambios de montos</th>
                    <th className="px-3 py-2 text-left">Pagos nuevos</th>
                    <th className="px-3 py-2 text-left">Omitidos</th>
                  </tr>
                </thead>
                <tbody>
                  {coincidencias.slice(0, 30).map((item) => (
                    <tr key={item.alumno.id} className="border-t border-cream-100">
                      <td className="px-3 py-2">
                        <div className="font-medium text-primary-800">{item.alumno.nombre_completo}</div>
                        <div className="text-xs text-gold-600">{item.alumno.codigo_alumno}</div>
                      </td>
                      <td className="px-3 py-2 text-primary-800/70">
                        {item.cambios_montos.length === 0 ? '-' : item.cambios_montos.map(c => `${c.etiqueta}: ${formatMonto(c.actual)} -> ${formatMonto(c.nuevo)}`).join(', ')}
                      </td>
                      <td className="px-3 py-2 text-primary-800/70">
                        {item.pagos_nuevos.length === 0 ? '-' : item.pagos_nuevos.map(p => `${p.concepto}: ${formatMonto(p.monto)}`).join(', ')}
                      </td>
                      <td className="px-3 py-2 text-primary-800/70">{item.pagos_omitidos.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {noEncontrados.length > 0 && (
              <div>
                <h3 className="font-semibold text-primary-800 mb-2">Alumnos no encontrados</h3>
                <div className="text-sm text-primary-800/70 bg-red-50 border border-red-100 rounded-lg p-3">
                  {noEncontrados.slice(0, 20).map((a, idx) => (
                    <div key={idx}>{a.codigo_alumno || '-'} | {a.dni || '-'} | {a.nombre_completo || '-'}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ImportarPagosExcel;
'@

Write-Text $pagePath $page

$service = Read-Text $servicePath
if ($service -notmatch "previewImportacionPensiones") {
  $service += @'

export const previewImportacionPensiones = (formData) => apiClient.post('/pensiones/importar-excel/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const aplicarImportacionPensiones = (formData) => apiClient.post('/pensiones/importar-excel/aplicar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
'@
  Write-Text $servicePath $service
}

$app = Read-Text $appPath
Replace-Text ([ref]$app) `
  "import ImprimirRecibos from './pages/ImprimirRecibos';" `
  "import ImprimirRecibos from './pages/ImprimirRecibos';`nimport ImportarPagosExcel from './pages/ImportarPagosExcel';" `
  "import pagina importar"

Replace-Text ([ref]$app) `
  "            <Route path=`"/imprimir-recibos`" element={`n              <ProtectedRoute roles={[SUPER_ADMIN, ADMIN]}><ImprimirRecibos /></ProtectedRoute>`n            } />" `
  "            <Route path=`"/imprimir-recibos`" element={`n              <ProtectedRoute roles={[SUPER_ADMIN, ADMIN]}><ImprimirRecibos /></ProtectedRoute>`n            } />`n`n            <Route path=`"/importar-pagos`" element={`n              <ProtectedRoute roles={[SUPER_ADMIN, ADMIN]}><ImportarPagosExcel /></ProtectedRoute>`n            } />" `
  "ruta importar pagos"
Write-Text $appPath $app

$sidebar = Read-Text $sidebarPath
if ($sidebar -notmatch "HiUpload") {
  $sidebar = $sidebar.Replace("HiCog, HiBell, HiDocumentText, HiChartBar, HiPrinter, HiCalendar, HiShieldCheck, HiX, HiQrcode", "HiCog, HiBell, HiDocumentText, HiChartBar, HiPrinter, HiCalendar, HiShieldCheck, HiX, HiQrcode, HiUpload")
}
$item = "    { to: '/importar-pagos', icon: HiUpload, label: 'Importar Pagos' },"
if ($sidebar -notmatch "/importar-pagos") {
  $sidebar = $sidebar.Replace("    { to: '/imprimir-recibos', icon: HiPrinter, label: 'Imprimir Recibos' },", "    { to: '/imprimir-recibos', icon: HiPrinter, label: 'Imprimir Recibos' },`n$item")
}
Write-Text $sidebarPath $sidebar

if ($Publish) {
  Push-Location $FrontendDir
  try {
    git add src/services/pensionesService.js src/pages/ImportarPagosExcel.jsx src/App.jsx src/components/layout/Sidebar.jsx
    git commit -m "Add Excel payment import preview"
    git push
  } finally {
    Pop-Location
  }
}

Write-Host "Listo. Frontend actualizado con importador de pagos Excel."
