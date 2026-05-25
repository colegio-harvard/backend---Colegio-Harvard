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
$appPath = Join-Path $FrontendDir "src\App.jsx"
$sidebarPath = Join-Path $FrontendDir "src\components\layout\Sidebar.jsx"
$pagePath = Join-Path $FrontendDir "src\pages\DashboardPagos.jsx"

if (-not (Test-Path $servicePath)) { throw "No existe pensionesService.js" }
if (-not (Test-Path $appPath)) { throw "No existe App.jsx" }
if (-not (Test-Path $sidebarPath)) { throw "No existe Sidebar.jsx" }

$pageContent = @'
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { dashboardPensiones, exportarReportePagosExcel, exportarDeudoresPensionesExcel } from '../services/pensionesService';
import { HiChartBar, HiCheckCircle, HiClock, HiCurrencyDollar, HiDownload, HiExclamationCircle, HiUserGroup } from 'react-icons/hi';

const money = (value) => `S/. ${Number(value || 0).toFixed(2)}`;
const pct = (value) => `${Number(value || 0)}%`;

const safeDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
  } catch {
    return '-';
  }
};

const StatCard = ({ icon: Icon, label, value, tone = 'emerald' }) => {
  const tones = {
    emerald: 'bg-emerald-500 text-emerald-700',
    amber: 'bg-amber-500 text-amber-700',
    red: 'bg-red-500 text-red-700',
    gold: 'bg-gold-500 text-gold-700',
    primary: 'bg-primary-600 text-primary-700',
  };
  const color = tones[tone] || tones.primary;
  const [bg, text] = color.split(' ');
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg} shadow-md`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-xs font-medium text-gold-600">{label}</p>
          <p className={`font-display text-2xl font-bold ${text}`}>{value}</p>
        </div>
      </div>
    </Card>
  );
};

const DashboardPagos = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conceptoActivo, setConceptoActivo] = useState('');
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await dashboardPensiones();
        const dashboard = res.data.data;
        setData(dashboard);
        setConceptoActivo(dashboard.conceptos?.[0]?.clave || '');
      } catch (err) {
        toast.error(err.response?.data?.error || 'No se pudo cargar el dashboard de pagos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const concepto = useMemo(() => {
    return data?.conceptos?.find(c => c.clave === conceptoActivo) || data?.conceptos?.[0] || null;
  }, [data, conceptoActivo]);

  const descargarGeneral = async () => {
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
      toast.success('Reporte general descargado');
    } catch {
      toast.error('No se pudo descargar el reporte general');
    }
  };

  const descargarDeudores = async () => {
    if (!concepto?.clave) return;
    const loadingToast = toast.loading('Preparando deudores...');
    try {
      setExportando(true);
      const res = await exportarDeudoresPensionesExcel({ concepto: concepto.clave });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deudores-${concepto.clave}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Deudores descargados', { id: loadingToast });
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo descargar deudores', { id: loadingToast });
    } finally {
      setExportando(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const resumen = data.resumen || {};
  const conceptos = data.conceptos || [];
  const deudaPorAula = data.deuda_por_aula || [];
  const topDeudores = data.top_deudores || [];
  const pagosRecientes = data.pagos_recientes || [];

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Dashboard Pagos</h1>
          <p className="text-sm text-primary-800/60">Resumen financiero del año escolar {data.anio}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/pensiones')} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            Ir a cuadrícula
          </button>
          <button onClick={descargarGeneral} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <HiDownload className="h-4 w-4" /> Exportar general
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={HiCurrencyDollar} label="Proyectado" value={money(resumen.proyectado)} tone="gold" />
        <StatCard icon={HiCheckCircle} label="Cobrado" value={money(resumen.cobrado)} tone="emerald" />
        <StatCard icon={HiExclamationCircle} label="Saldo pendiente" value={money(resumen.saldo)} tone="red" />
        <StatCard icon={HiChartBar} label="% Cobranza" value={pct(resumen.porcentaje_cobranza)} tone="primary" />
        <StatCard icon={HiUserGroup} label="Con deuda" value={resumen.alumnos_con_deuda || 0} tone="amber" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Cobranza por concepto">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-cream-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Concepto</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gold-600">Proyectado</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gold-600">Cobrado</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gold-600">Saldo</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gold-600">%</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gold-600">Deudores</th>
                </tr>
              </thead>
              <tbody>
                {conceptos.map(c => (
                  <tr
                    key={c.clave}
                    onClick={() => setConceptoActivo(c.clave)}
                    className={`cursor-pointer border-t hover:bg-cream-50 ${conceptoActivo === c.clave ? 'bg-gold-50/60' : ''}`}
                  >
                    <td className="px-3 py-2 text-sm font-semibold text-primary-800">{c.nombre}</td>
                    <td className="px-3 py-2 text-right text-sm">{money(c.proyectado)}</td>
                    <td className="px-3 py-2 text-right text-sm text-emerald-700">{money(c.cobrado)}</td>
                    <td className="px-3 py-2 text-right text-sm text-red-700">{money(c.saldo)}</td>
                    <td className="px-3 py-2 text-center text-sm font-semibold">{pct(c.porcentaje_cobranza)}</td>
                    <td className="px-3 py-2 text-center text-sm">{c.deudores_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={concepto ? `Detalle: ${concepto.nombre}` : 'Detalle por concepto'}>
          {concepto ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Cobrado</p>
                  <p className="font-display text-xl font-bold text-emerald-700">{money(concepto.cobrado)}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-xs text-red-700">Saldo</p>
                  <p className="font-display text-xl font-bold text-red-700">{money(concepto.saldo)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Parciales</p>
                  <p className="font-display text-xl font-bold text-amber-700">{concepto.parciales}</p>
                </div>
                <div className="rounded-lg bg-cream-50 p-3">
                  <p className="text-xs text-primary-800/60">Pendientes</p>
                  <p className="font-display text-xl font-bold text-primary-800">{concepto.pendientes}</p>
                </div>
              </div>
              <button
                onClick={descargarDeudores}
                disabled={exportando || !concepto.deudores_count}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <HiDownload className="h-4 w-4" /> Exportar deudores de este concepto
              </button>
              <div className="max-h-72 overflow-y-auto">
                {(concepto.deudores || []).length === 0 ? (
                  <p className="py-8 text-center text-primary-800/40">No hay deudores en este concepto</p>
                ) : (
                  <div className="space-y-2">
                    {concepto.deudores.map(d => (
                      <div key={`${d.id_alumno}-${d.saldo}`} className="rounded-lg border border-cream-200 p-3">
                        <p className="font-semibold text-primary-800">{d.alumno}</p>
                        <p className="text-xs text-primary-800/60">{d.codigo_alumno} | {d.aula}</p>
                        <p className="mt-1 text-xs text-primary-800/70">{d.apoderado || 'Sin apoderado'} {d.celular ? `| ${d.celular}` : ''}</p>
                        <p className="mt-1 text-sm font-bold text-red-700">Saldo: {money(d.saldo)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Deuda por aula">
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-cream-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Aula</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gold-600">Deudores</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gold-600">Saldo</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gold-600">%</th>
                </tr>
              </thead>
              <tbody>
                {deudaPorAula.map(a => (
                  <tr key={a.id_aula || a.aula} className="border-t">
                    <td className="px-3 py-2 text-sm font-semibold text-primary-800">{a.aula}</td>
                    <td className="px-3 py-2 text-right text-sm">{a.deudores}</td>
                    <td className="px-3 py-2 text-right text-sm text-red-700">{money(a.saldo)}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold">{pct(a.porcentaje_cobranza)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Mayores saldos pendientes">
          <div className="space-y-2">
            {topDeudores.length === 0 ? (
              <p className="py-8 text-center text-primary-800/40">No hay deudas pendientes</p>
            ) : topDeudores.map(d => (
              <div key={d.id_alumno} className="flex items-start justify-between gap-3 rounded-lg border border-cream-200 p-3">
                <div>
                  <p className="font-semibold text-primary-800">{d.alumno}</p>
                  <p className="text-xs text-primary-800/60">{d.codigo_alumno} | {d.aula}</p>
                  <p className="text-xs text-primary-800/70">{d.apoderado || 'Sin apoderado'} {d.celular ? `| ${d.celular}` : ''}</p>
                </div>
                <p className="whitespace-nowrap font-display text-lg font-bold text-red-700">{money(d.saldo)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Pagos recientes">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-cream-50">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Alumno</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Concepto</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gold-600">Monto</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {pagosRecientes.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 text-sm">{safeDate(p.fecha_pago)}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-primary-800">{p.alumno}</td>
                  <td className="px-3 py-2 text-sm">{p.concepto}</td>
                  <td className="px-3 py-2 text-right text-sm font-semibold text-emerald-700">{money(p.monto)}</td>
                  <td className="px-3 py-2 text-sm text-primary-800/70">{p.registrado_por || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPagos;
'@
Write-FileUtf8NoBom -Path $pagePath -Content $pageContent

$service = Get-Content -Raw -Path $servicePath
if ($service -notmatch "dashboardPensiones") {
  $service = $service.TrimEnd() + "`r`nexport const dashboardPensiones = () => apiClient.get('/pensiones/dashboard');`r`n"
  Write-FileUtf8NoBom -Path $servicePath -Content $service
}

$app = Get-Content -Raw -Path $appPath
if ($app -notmatch "DashboardPagos") {
  $app = $app.Replace("import ReportePagos from './pages/ReportePagos';", "import ReportePagos from './pages/ReportePagos';`r`nimport DashboardPagos from './pages/DashboardPagos';")
  $routeMarker = @'
            <Route path="/reporte-pagos" element={
              <ProtectedRoute roles={[SUPER_ADMIN, ADMIN]}><ReportePagos /></ProtectedRoute>
            } />
'@
  $newRoutes = @'
            <Route path="/dashboard-pagos" element={
              <ProtectedRoute roles={[SUPER_ADMIN, ADMIN]}><DashboardPagos /></ProtectedRoute>
            } />

            <Route path="/reporte-pagos" element={
              <ProtectedRoute roles={[SUPER_ADMIN, ADMIN]}><ReportePagos /></ProtectedRoute>
            } />
'@
  if (-not $app.Contains($routeMarker)) { throw "No se encontro la ruta de reporte-pagos en App.jsx" }
  $app = $app.Replace($routeMarker, $newRoutes)
  Write-FileUtf8NoBom -Path $appPath -Content $app
}

$sidebar = Get-Content -Raw -Path $sidebarPath
if ($sidebar -notmatch "Dashboard Pagos") {
  $sidebar = $sidebar.Replace(
    "{ to: '/reporte-pagos', icon: HiChartBar, label: 'Reporte Pagos' },",
    "{ to: '/dashboard-pagos', icon: HiChartBar, label: 'Dashboard Pagos' },`r`n    { to: '/reporte-pagos', icon: HiChartBar, label: 'Reporte Pagos' },"
  )
  Write-FileUtf8NoBom -Path $sidebarPath -Content $sidebar
}

Push-Location $FrontendDir
try {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    npm run build
  } else {
    Write-Warning "npm no esta disponible en esta terminal. Se omitio la compilacion local; Railway compilara al desplegar."
  }

  if ($Publish) {
    git add src/services/pensionesService.js src/pages/DashboardPagos.jsx src/App.jsx src/components/layout/Sidebar.jsx
    git commit -m "Add payments dashboard"
    git push
  }
} finally {
  Pop-Location
}

Write-Host "Listo. Frontend actualizado con Dashboard Pagos."
