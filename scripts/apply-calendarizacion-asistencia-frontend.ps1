param(
  [Parameter(Mandatory=$true)][string]$FrontendDir,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$file = Join-Path $FrontendDir "src/pages/Asistencia.jsx"
if (!(Test-Path $file)) { throw "No se encontro Asistencia.jsx en $file" }

$text = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $text

$text = $text.Replace(
  "import { listarNiveles, listarGrados, listarAulas } from '../services/configEscolarService';",
  "import { listarNiveles, listarGrados, listarAulas, listarAños as listarAnios, obtenerCalendario, actualizarDiaCalendario } from '../services/configEscolarService';"
)

$text = $text.Replace(
"  const estadoColor = (estado) => {
    const conf = ESTADO_ASISTENCIA_LABELS[estado];
    return conf ? conf.color : 'bg-cream-100 text-gold-600';
  };",
"  const estadoColor = (estado) => {
    if (estado === 'NO_LECTIVO') return 'bg-sky-100 text-sky-800 border border-sky-200';
    const conf = ESTADO_ASISTENCIA_LABELS[estado];
    return conf ? conf.color : 'bg-cream-100 text-gold-600';
  };"
)

$text = $text.Replace(
"    if (estado === 'AUSENTE') return 'danger';
    return null;",
"    if (estado === 'AUSENTE') return 'danger';
    if (estado === 'NO_LECTIVO') return 'info';
    return null;"
)

$text = $text.Replace(
  "{ESTADO_ASISTENCIA_LABELS[dia.estado]?.label?.charAt(0)}",
  "{dia.estado === 'NO_LECTIVO' ? 'E' : ESTADO_ASISTENCIA_LABELS[dia.estado]?.label?.charAt(0)}"
)

$text = $text.Replace(
  "{ESTADO_ASISTENCIA_LABELS[diaSeleccionado.estado]?.label}",
  "{diaSeleccionado.estado === 'NO_LECTIVO' ? 'Dia especial' : ESTADO_ASISTENCIA_LABELS[diaSeleccionado.estado]?.label}"
)

# El bloque anterior puede variar por las llaves de plantilla. Usamos busqueda mas tolerante.
$detailStart = $text.IndexOf('                  <div className="grid grid-cols-2 gap-4">')
if ($detailStart -ge 0) {
  $detailEndMarker = "                  </div>`r`n                </Card>"
  $detailEnd = $text.IndexOf($detailEndMarker, $detailStart)
  if ($detailEnd -lt 0) {
    $detailEndMarker = "                  </div>`n                </Card>"
    $detailEnd = $text.IndexOf($detailEndMarker, $detailStart)
  }
  if ($detailEnd -ge 0) {
    $detailEnd += "                  </div>".Length
    $replacement = @'
                  {diaSeleccionado.estado === 'NO_LECTIVO' ? (
                    <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
                      <p className="text-xs text-sky-700 mb-1">Fecha especial</p>
                      <p className="text-base font-semibold text-sky-900">{diaSeleccionado.nota || 'Dia no lectivo'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-cream-50 rounded-lg p-3">
                        <p className="text-xs text-gold-600 mb-1">Entrada</p>
                        <p className="text-lg font-semibold text-primary-800">
                          {diaSeleccionado.hora_ingreso ? formatHora(diaSeleccionado.hora_ingreso) : '-'}
                        </p>
                        {diaSeleccionado.metodo_ingreso && (
                          <p className="text-xs text-gold-500 mt-0.5">Metodo: {diaSeleccionado.metodo_ingreso}</p>
                        )}
                      </div>
                      <div className="bg-cream-50 rounded-lg p-3">
                        <p className="text-xs text-gold-600 mb-1">Salida</p>
                        <p className={`text-lg font-semibold ${diaSeleccionado.salida_no_registrada ? 'text-amber-600' : 'text-primary-800'}`}>
                          {diaSeleccionado.salida_no_registrada
                            ? 'No registrada'
                            : diaSeleccionado.hora_salida ? formatHora(diaSeleccionado.hora_salida) : '-'}
                        </p>
                      </div>
                    </div>
                  )}
'@
    $text = $text.Substring(0, $detailStart) + $replacement + $text.Substring($detailEnd)
  }
}

if ($text -notmatch "const CalendarizacionAdmin") {
  $component = @'

const CalendarizacionAdmin = () => {
  const [anios, setAnios] = useState([]);
  const [anioActivo, setAnioActivo] = useState('');
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);
  const [dias, setDias] = useState([]);
  const [desde, setDesde] = useState(todayLimaISO());
  const [hasta, setHasta] = useState(todayLimaISO());
  const [nota, setNota] = useState('Vacaciones');
  const [loading, setLoading] = useState(false);

  const cargarAnios = async () => {
    const { data } = await listarAnios();
    const lista = data.data || [];
    setAnios(lista);
    const activo = lista.find(a => a.activo) || lista[0];
    if (activo) setAnioActivo(activo.id);
  };

  const cargarCalendario = async () => {
    if (!anioActivo) return;
    setLoading(true);
    try {
      const { data } = await obtenerCalendario(anioActivo);
      setDias(data.data || []);
    } catch {
      setDias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarAnios(); }, []);
  useEffect(() => { cargarCalendario(); }, [anioActivo]);

  const diasMes = () => {
    const anio = Number(anios.find(a => a.id === Number(anioActivo))?.anio || new Date().getFullYear());
    const total = new Date(anio, mes, 0).getDate();
    const inicio = new Date(anio, mes - 1, 1).getDay();
    const espacios = (inicio + 6) % 7;
    const mapa = new Map(dias.map(d => [String(d.fecha).slice(0, 10), d]));
    return [
      ...Array.from({ length: espacios }, () => null),
      ...Array.from({ length: total }, (_, i) => {
        const dia = i + 1;
        const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        return { dia, fecha, especial: mapa.get(fecha) };
      })
    ];
  };

  const fechasRango = () => {
    const res = [];
    const ini = new Date(`${desde}T00:00:00`);
    const fin = new Date(`${hasta}T00:00:00`);
    for (let d = ini; d <= fin; d.setDate(d.getDate() + 1)) {
      res.push(d.toISOString().slice(0, 10));
    }
    return res;
  };

  const guardarRango = async (esLectivo) => {
    if (!anioActivo || !desde || !hasta) return;
    try {
      await Promise.all(fechasRango().map(fecha =>
        actualizarDiaCalendario({
          id_anio_escolar: anioActivo,
          fecha,
          es_dia_lectivo: esLectivo,
          nota: esLectivo ? '' : nota
        })
      ));
      toast.success(esLectivo ? 'Fechas restauradas' : 'Fechas marcadas');
      cargarCalendario();
    } catch {
      toast.error('No se pudo guardar la calendarizacion');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Calendarizacion</h1>
      </div>
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Año escolar</label>
            <select value={anioActivo} onChange={(e) => setAnioActivo(e.target.value)} className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm">
              {anios.map(a => <option key={a.id} value={a.id}>{a.anio}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Mes</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm">
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i).toLocaleString('es-PE', { month: 'long' })}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gold-600 mb-1">Motivo</label>
            <select value={nota} onChange={(e) => setNota(e.target.value)} className="w-full px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm">
              {['Vacaciones', 'Feriado', 'Dia no laborable', 'Desfile', 'Suspension de clases', 'Otro'].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <button onClick={() => guardarRango(false)} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">Marcar fecha especial</button>
          <button onClick={() => guardarRango(true)} className="px-4 py-2 bg-cream-100 text-primary-700 rounded-lg hover:bg-cream-200 text-sm font-medium">Restaurar como lectivo</button>
        </div>
      </Card>
      <Card>
        {loading ? <LoadingSpinner /> : (
          <div className="grid grid-cols-7 gap-1">
            {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(d => <div key={d} className="text-center text-sm font-semibold text-primary-700 py-2">{d}</div>)}
            {diasMes().map((d, i) => d ? (
              <button key={i} type="button" onClick={() => { setDesde(d.fecha); setHasta(d.fecha); }} className={`min-h-[72px] rounded p-2 text-left text-sm border ${d.especial && d.especial.es_dia_lectivo === false ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-cream-50 border-cream-100 text-primary-800'}`}>
                <div className="font-semibold">{d.dia}</div>
                {d.especial && d.especial.es_dia_lectivo === false && <div className="text-xs mt-1 leading-tight">{d.especial.nota || 'Dia no lectivo'}</div>}
              </button>
            ) : <div key={i} />)}
          </div>
        )}
      </Card>
    </div>
  );
};
'@
  $text = $text.Replace("const AsistenciaAdmin = () => {", $component + "`r`n`r`nconst AsistenciaAdmin = () => {")
}

$text = $text.Replace(
  "const AsistenciaAdmin = () => {`r`n  const [datos, setDatos] = useState([]);",
  "const AsistenciaAdmin = () => {`r`n  const [adminTab, setAdminTab] = useState('global');`r`n  const [datos, setDatos] = useState([]);"
)
$text = $text.Replace(
  "const AsistenciaAdmin = () => {`n  const [datos, setDatos] = useState([]);",
  "const AsistenciaAdmin = () => {`n  const [adminTab, setAdminTab] = useState('global');`n  const [datos, setDatos] = useState([]);"
)

$oldHeader = @"
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Asistencia Global</h1>
        <button onClick={handleExportar} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <HiDownload className="w-4 h-4" /> Exportar Excel
        </button>
      </div>
"@
$newHeader = @"
  if (adminTab === 'calendarizacion') {
    return (
      <div>
        <div className="flex gap-2 mb-6">
          <button onClick={() => setAdminTab('global')} className="px-4 py-2 rounded-lg bg-cream-100 text-primary-700">Asistencia Global</button>
          <button onClick={() => setAdminTab('calendarizacion')} className="px-4 py-2 rounded-lg bg-primary-700 text-white">Calendarizacion</button>
        </div>
        <CalendarizacionAdmin />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setAdminTab('global')} className="px-4 py-2 rounded-lg bg-primary-700 text-white">Asistencia Global</button>
        <button onClick={() => setAdminTab('calendarizacion')} className="px-4 py-2 rounded-lg bg-cream-100 text-primary-700">Calendarizacion</button>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Asistencia Global</h1>
        <button onClick={handleExportar} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <HiDownload className="w-4 h-4" /> Exportar Excel
        </button>
      </div>
"@
if ($text.Contains($oldHeader)) {
  $text = $text.Replace($oldHeader, $newHeader)
} elseif ($text -notmatch "adminTab === 'calendarizacion'") {
  $pattern = '(?s)  return \(\s*<div>\s*<div className="flex items-center justify-between mb-6">\s*<h1 className="page-title">Asistencia Global</h1>\s*<button onClick=\{handleExportar\}.*?</button>\s*</div>'
  if ([regex]::IsMatch($text, $pattern)) {
    $text = [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{
      param($m)
      @"
  if (adminTab === 'calendarizacion') {
    return (
      <div>
        <div className="flex gap-2 mb-6">
          <button onClick={() => setAdminTab('global')} className="px-4 py-2 rounded-lg bg-cream-100 text-primary-700">Asistencia Global</button>
          <button onClick={() => setAdminTab('calendarizacion')} className="px-4 py-2 rounded-lg bg-primary-700 text-white">Calendarizacion</button>
        </div>
        <CalendarizacionAdmin />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setAdminTab('global')} className="px-4 py-2 rounded-lg bg-primary-700 text-white">Asistencia Global</button>
        <button onClick={() => setAdminTab('calendarizacion')} className="px-4 py-2 rounded-lg bg-cream-100 text-primary-700">Calendarizacion</button>
      </div>
$($m.Value.Substring($m.Value.IndexOf('<div className="flex items-center justify-between mb-6">')))
"@
    }, 1)
  } else {
    throw "No se encontro el encabezado de Asistencia Global para insertar Calendarizacion."
  }
}

if ($text -eq $original) { throw "No se aplicaron cambios en Asistencia.jsx." }
[System.IO.File]::WriteAllText($file, $text, [System.Text.UTF8Encoding]::new($false))

if ($Publish) {
  Push-Location $FrontendDir
  try {
    git add src/pages/Asistencia.jsx
    git commit -m "Add attendance calendarization"
    git push
  } finally {
    Pop-Location
  }
}

Write-Host "Listo. Frontend actualizado con Calendarizacion de asistencia."
