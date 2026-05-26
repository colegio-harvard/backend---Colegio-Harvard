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

function Add-CommentsToFile($Path) {
  $text = Read-Text $Path
  $original = $text

  if ($text -notmatch "detallePension") {
    $marker = "const PensionResumen = ({ pensiones }) => {"
    $helper = @'
const detallePension = (mes) => {
  const lineas = [
    mes.nombre || mes.clave,
    `Estado: ${mes.estado || 'PENDIENTE'}`,
    `Pagado: ${formatMonto(mes.monto_pagado || 0)} / ${formatMonto(mes.monto_total || 0)}`,
  ];
  if (mes.saldo !== null && mes.saldo !== undefined) lineas.push(`Saldo: ${formatMonto(mes.saldo)}`);
  if (mes.observacion_no_corresponde) lineas.push(`Obs.: ${mes.observacion_no_corresponde}`);
  if (Array.isArray(mes.pagos) && mes.pagos.length > 0) {
    lineas.push('Pagos:');
    mes.pagos.forEach((p) => {
      const fecha = p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-PE') : '';
      lineas.push(`- ${fecha} ${formatMonto(p.monto)}${p.observacion ? `: ${p.observacion}` : ''}`);
    });
  } else {
    lineas.push('Sin comentarios registrados');
  }
  return lineas.join('\n');
};

'@
    if (!$text.Contains($marker)) { throw "No se encontro PensionResumen en $Path" }
    $text = $text.Replace($marker, $helper + $marker)
  }

  $old = '          <div key={mes.clave} className="rounded-lg border border-cream-200 bg-white px-2 py-2 text-center">'
  $new = '          <button type="button" key={mes.clave} title={detallePension(mes)} onClick={() => toast(detallePension(mes), { duration: 7000 })} className="rounded-lg border border-cream-200 bg-white px-2 py-2 text-center hover:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-300">'
  if ($text.Contains($old)) {
    $text = $text.Replace($old, $new)
    $text = $text.Replace("          </div>`r`n        ))}", "          </button>`r`n        ))}")
    $text = $text.Replace("          </div>`n        ))}", "          </button>`n        ))}")
  }

  if ($text -ne $original) {
    Write-Text $Path $text
  }
}

$files = @(
  (Join-Path $FrontendDir "src\pages\RegistroAsistencia.jsx"),
  (Join-Path $FrontendDir "src\pages\dashboards\DashboardPorteria.jsx")
)

foreach ($file in $files) {
  if (!(Test-Path $file)) { throw "No existe $file" }
  Add-CommentsToFile $file
}

function Frontend-Git {
  & git -C $FrontendDir -c "safe.directory=$FrontendDir" @args
  if ($LASTEXITCODE -ne 0) { throw "Fallo Git frontend: git $($args -join ' ')" }
}

Frontend-Git diff -- src/pages/RegistroAsistencia.jsx src/pages/dashboards/DashboardPorteria.jsx
Frontend-Git add src/pages/RegistroAsistencia.jsx src/pages/dashboards/DashboardPorteria.jsx
Frontend-Git commit -m "Show pension comments on scan cards"
if ($Publish) { Frontend-Git push origin main }

Write-Host "Listo. Al tocar una pension en el escaneo se muestran montos y comentarios."
