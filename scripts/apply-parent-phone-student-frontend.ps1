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

$alumnosPath = Join-Path $FrontendDir "src\pages\Alumnos.jsx"
if (-not (Test-Path $alumnosPath)) {
  throw "No existe Alumnos.jsx en: $alumnosPath"
}

$content = Get-Content -Raw -Path $alumnosPath

if ($content -notmatch "Celular del Apoderado") {
  $oldBlock = @'
              <div>
                <label className={labelClass}>Pensión (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monto_pension}
                  onChange={(e) => setForm({ ...form, monto_pension: e.target.value })}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
'@

  $newBlock = @'
              <div>
                <label className={labelClass}>Pensión (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monto_pension}
                  onChange={(e) => setForm({ ...form, monto_pension: e.target.value })}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelClass}>Celular del Apoderado</label>
                <input
                  type="text"
                  value={padreSeleccionado?.celular || 'Sin apoderado vinculado'}
                  readOnly
                  className={`${inputClass} bg-cream-50 text-primary-800/80`}
                />
              </div>
'@

  if ($content.Contains($oldBlock)) {
    $content = $content.Replace($oldBlock, $newBlock)
  } else {
    $fotoMarker = @'
            </div>
          </div>

          {/* --- Foto del Alumno --- */}
'@
    $phoneBlock = @'
              <div>
                <label className={labelClass}>Celular del Apoderado</label>
                <input
                  type="text"
                  value={padreSeleccionado?.celular || 'Sin apoderado vinculado'}
                  readOnly
                  className={`${inputClass} bg-cream-50 text-primary-800/80`}
                />
              </div>
'@
    if ($content.Contains($fotoMarker)) {
      $content = $content.Replace($fotoMarker, $phoneBlock + "`r`n" + $fotoMarker)
    } else {
      $pattern = '(?s)<div>\s*<label className=\{labelClass\}>Pensi.n \(S/\.\)</label>.*?</div>\s*</div>\s*</div>\s*\{\s*/\* --- Foto del Alumno --- \*/\s*\}'
      $updated = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m)
        $text = $m.Value
        $text = $text -replace '\{\s*/\* --- Foto del Alumno --- \*/\s*\}', ($phoneBlock + "`r`n          {/* --- Foto del Alumno --- */}")
        return $text
      }, 1)
      if ($updated -eq $content) {
        throw "No se encontro el punto para insertar el celular del apoderado en Alumnos.jsx."
      }
      $content = $updated
    }
  }
}

Write-FileUtf8NoBom -Path $alumnosPath -Content $content

Push-Location $FrontendDir
try {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    npm run build
  } else {
    Write-Warning "npm no esta disponible en esta terminal. Se omitio la compilacion local; Railway compilara al desplegar."
  }

  if ($Publish) {
    git add src/pages/Alumnos.jsx
    git commit -m "Show parent phone in student form"
    git push
  }
} finally {
  Pop-Location
}

Write-Host "Listo. Formulario de alumnos actualizado con celular del apoderado."
