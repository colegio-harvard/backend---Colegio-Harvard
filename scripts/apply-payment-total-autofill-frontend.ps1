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

$pensionesPath = Join-Path $FrontendDir "src\pages\Pensiones.jsx"
if (!(Test-Path $pensionesPath)) {
  throw "No se encontro Pensiones.jsx en $pensionesPath"
}

$content = Read-Text $pensionesPath
$original = $content

if ($content -notmatch "const ModalPago = \(\{ alumno, mes, onClose, onSaved \}\) => \{") {
  throw "No se encontro el modal de pago en Pensiones.jsx."
}

if ($content -notmatch "const montoTotalSugerido = \(\) => \{") {
  $needle = @'
  const [accion, setAccion] = useState(''); // 'PAGADO', 'PAGO_PARCIAL', 'PENDIENTE', 'NUEVO_PAGO'
  const [montoTotal, setMontoTotal] = useState('');
  const [montoPago, setMontoPago] = useState('');
  const [observacion, setObservacion] = useState('');

'@
  $insert = @'
  const [accion, setAccion] = useState(''); // 'PAGADO', 'PAGO_PARCIAL', 'PENDIENTE', 'NUEVO_PAGO'
  const [montoTotal, setMontoTotal] = useState('');
  const [montoPago, setMontoPago] = useState('');
  const [observacion, setObservacion] = useState('');

  const montoTotalSugerido = () => {
    const clave = String(mes?.clave || mes?.nombre || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    const monto =
      clave === 'MATRICULA'
        ? alumno?.monto_matricula
        : clave === 'MATERIALES'
          ? alumno?.monto_materiales
          : alumno?.monto_pension;

    const numero = Number(monto);
    return Number.isFinite(numero) && numero > 0 ? numero.toFixed(2) : '';
  };

  const completarMontoTotal = () => {
    setMontoTotal((actual) => actual || montoTotalSugerido());
  };

'@
  if (!$content.Contains($needle)) {
    throw "No se encontro el bloque de estados del formulario en Pensiones.jsx."
  }
  $content = $content.Replace($needle, $insert)
}

$content = $content.Replace(
  "        const d = res.data.data;`r`n        setDetalle(d);",
  "        const d = res.data.data;`r`n        const montoInicial = d.monto_total ? String(d.monto_total) : montoTotalSugerido();`r`n        setDetalle(d);"
)
$content = $content.Replace(
  "          setMontoTotal(String(d.monto_total || ''));",
  "          setMontoTotal(montoInicial);"
)
$content = $content.Replace(
  "        } else if (d.estado === 'PENDIENTE') {`r`n          setAccion('');`r`n        }",
  "        } else if (d.estado === 'PENDIENTE') {`r`n          setAccion('');`r`n          setMontoTotal(montoInicial);`r`n        }"
)

$content = $content.Replace(
  "onChange={() => { setAccion('PAGADO'); setMontoPago(''); }}",
  "onChange={() => { setAccion('PAGADO'); setMontoPago(''); completarMontoTotal(); }}"
)
$content = $content.Replace(
  "onChange={() => setAccion('PAGO_PARCIAL')}",
  "onChange={() => { setAccion('PAGO_PARCIAL'); completarMontoTotal(); }}"
)

if ($content -eq $original) {
  throw "No se aplicaron cambios. Es posible que el archivo ya tenga una estructura distinta."
}

Write-Text $pensionesPath $content

Push-Location $FrontendDir
try {
  git diff -- src/pages/Pensiones.jsx
  git add src/pages/Pensiones.jsx
  git commit -m "Autofill payment total from student fees"
  if ($Publish) {
    git push origin main
  }
} finally {
  Pop-Location
}

Write-Host "Listo. El monto total del pago se autocompleta desde matricula, materiales o pension."
