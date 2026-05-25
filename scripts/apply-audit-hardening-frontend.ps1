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

$pagePath = Join-Path $FrontendDir "src\pages\Auditoria.jsx"
if (-not (Test-Path $pagePath)) {
  throw "No existe Auditoria.jsx"
}

$content = @'
import { useMemo, useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { listarAuditoria, listarAcciones, exportarExcelAuditoria } from '../services/auditoriaService';
import { formatFechaHora } from '../utils/formatters';
import { HiDownload, HiEye, HiSearch } from 'react-icons/hi';
import toast from 'react-hot-toast';

const texto = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const Auditoria = () => {
  const [registros, setRegistros] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ accion: '', fecha_inicio: '', fecha_fin: '' });
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtros.accion) params.codigo_accion = filtros.accion;
      if (filtros.fecha_inicio) params.fecha_inicio = filtros.fecha_inicio;
      if (filtros.fecha_fin) params.fecha_fin = filtros.fecha_fin;
      const [registrosR, accionesR] = await Promise.all([
        listarAuditoria(params),
        listarAcciones(),
      ]);
      setRegistros(registrosR.data.data || []);
      setAcciones(accionesR.data.data || []);
    } catch {
      toast.error('Error al cargar auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const registrosFiltrados = useMemo(() => {
    const term = texto(busqueda);
    if (!term) return registros;
    return registros.filter(r => [
      r.usuario?.nombres,
      r.usuario?.username,
      r.usuario?.rol_codigo,
      r.accion,
      r.tipo_entidad,
      r.id_entidad,
      r.resumen,
      r.meta ? JSON.stringify(r.meta) : '',
    ].some(value => texto(value).includes(term)));
  }, [registros, busqueda]);

  const handleExportar = async () => {
    try {
      const params = {};
      if (filtros.accion) params.codigo_accion = filtros.accion;
      if (filtros.fecha_inicio) params.fecha_inicio = filtros.fecha_inicio;
      if (filtros.fecha_fin) params.fecha_fin = filtros.fecha_fin;
      const response = await exportarExcelAuditoria(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Auditoría exportada');
    } catch {
      toast.error('Error al exportar');
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="page-title">Auditoría</h1>
          <p className="text-sm text-primary-800/60">Registro de acciones sensibles del sistema.</p>
        </div>
        <button onClick={handleExportar} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <HiDownload className="w-4 h-4" /> Exportar Excel
        </button>
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_190px_190px_160px] lg:items-end">
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Acción</label>
            <select value={filtros.accion} onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })}
              className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm bg-white">
              <option value="">Todas</option>
              {acciones.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Desde</label>
            <input type="date" value={filtros.fecha_inicio} onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
              className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Hasta</label>
            <input type="date" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
              className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm" />
          </div>
          <button onClick={fetchData} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm text-sm font-medium">
            Filtrar
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-cream-200">
          <label className="block text-xs font-medium text-gold-600 mb-1">Buscar en resultados</label>
          <div className="relative">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Usuario, acción, alumno, entidad, resumen, IP..."
              className="w-full pl-9 pr-3 py-2 border border-cream-300 rounded-lg outline-none text-sm bg-white"
            />
          </div>
          <p className="mt-2 text-xs text-primary-800/50">{registrosFiltrados.length} registro(s) visibles</p>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-cream-50">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Usuario</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Rol</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Acción</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Entidad</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gold-600">Resumen</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gold-600">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="px-3 py-8 text-center text-primary-800/40">Cargando...</td></tr>
              ) : registrosFiltrados.length === 0 ? (
                <tr><td colSpan="7" className="px-3 py-8 text-center text-primary-800/40">No hay registros de auditoría</td></tr>
              ) : registrosFiltrados.map(r => (
                <tr key={r.id} className="border-t hover:bg-cream-50">
                  <td className="px-3 py-2 text-sm whitespace-nowrap">{formatFechaHora(r.fecha_hora)}</td>
                  <td className="px-3 py-2 text-sm">
                    <div className="font-semibold text-primary-800">{r.usuario?.nombres || `ID: ${r.id_usuario}`}</div>
                    {r.usuario?.username && <div className="text-xs text-primary-800/50">{r.usuario.username}</div>}
                  </td>
                  <td className="px-3 py-2 text-sm">{r.usuario?.rol_codigo || '-'}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-primary-700">{r.accion}</td>
                  <td className="px-3 py-2 text-sm">
                    <div>{r.tipo_entidad || '-'}</div>
                    {r.id_entidad && <div className="text-xs text-primary-800/50">ID: {r.id_entidad}</div>}
                  </td>
                  <td className="px-3 py-2 text-sm min-w-[280px]">{r.resumen}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => setDetalle(r)}
                      className="inline-flex items-center justify-center rounded-lg bg-gold-50 px-3 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-100"
                    >
                      <HiEye className="mr-1 h-4 w-4" /> Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={!!detalle} onClose={() => setDetalle(null)} title="Detalle de auditoría" size="xl">
        {detalle && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-cream-50 p-3">
                <p className="text-xs text-gold-600">Usuario</p>
                <p className="font-semibold text-primary-800">{detalle.usuario?.nombres || `ID: ${detalle.id_usuario}`}</p>
                <p className="text-xs text-primary-800/60">{detalle.usuario?.username || '-'}</p>
              </div>
              <div className="rounded-lg bg-cream-50 p-3">
                <p className="text-xs text-gold-600">Acción</p>
                <p className="font-semibold text-primary-800">{detalle.accion}</p>
                <p className="text-xs text-primary-800/60">{formatFechaHora(detalle.fecha_hora)}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary-800 mb-1">Resumen</p>
              <p className="rounded-lg border border-cream-200 p-3 text-sm text-primary-800/80">{detalle.resumen}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary-800 mb-1">Detalle técnico</p>
              <pre className="max-h-96 overflow-auto rounded-lg bg-primary-950 p-4 text-xs text-cream-50">
                {JSON.stringify(detalle.meta || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Auditoria;
'@

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
    git add src/pages/Auditoria.jsx
    git commit -m "Improve audit log UI"
    git push
  }
} finally {
  Pop-Location
}

Write-Host "Listo. Auditoria visual reforzada."
