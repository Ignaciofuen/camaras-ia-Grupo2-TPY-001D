# =========================================================
# _render-mediamtx-yml.ps1
# =========================================================
# Lee el JSON de URLs RTSP que escribio discover_camera_ips.py
# y reemplaza los placeholders del mediamtx.yml por las URLs
# reales (con IP descubierta + password). Escribe el yml
# runtime SIN BOM (MediaMTX no lo soporta).
#
# Uso:
#   powershell -File _render-mediamtx-yml.ps1 `
#       -Template "...mediamtx.yml" `
#       -Runtime "...mediamtx.runtime.yml" `
#       -DiscoveredJson "%TEMP%\camaras_ips_descubiertas.json"
# =========================================================
param(
    [Parameter(Mandatory=$true)] [string] $Template,
    [Parameter(Mandatory=$true)] [string] $Runtime,
    [Parameter(Mandatory=$true)] [string] $DiscoveredJson
)

if (-not (Test-Path $Template)) {
    Write-Host "[ERROR] No existe el template: $Template"
    exit 1
}
if (-not (Test-Path $DiscoveredJson)) {
    Write-Host "[ERROR] No existe el JSON de descubrimiento: $DiscoveredJson"
    Write-Host "        Corre primero: python discover_camera_ips.py"
    exit 1
}

# Cargar JSON
$discovered = Get-Content -Raw -Path $DiscoveredJson | ConvertFrom-Json

# Cargar template
$tpl = [System.IO.File]::ReadAllText($Template)

# Reemplazar cada placeholder por la URL real
$count = 0
foreach ($prop in $discovered.PSObject.Properties) {
    $nombre = $prop.Name
    $info   = $prop.Value
    # placeholder_path = path con `rtsp://placeholder/X` en el yml.
    # Cuando mediamtx_path = cam_principal_lite (transcode FFmpeg), el
    # placeholder igual vive en el path base cam_principal.
    # discover_camera_ips.py escribe placeholder_path; si no esta (JSON viejo)
    # usamos mediamtx_path como fallback.
    $phPath = $info.placeholder_path
    if ([string]::IsNullOrWhiteSpace($phPath)) { $phPath = $info.mediamtx_path }
    $url    = $info.rtsp_url

    if ([string]::IsNullOrWhiteSpace($phPath)) {
        Write-Host "[WARN] $nombre no tiene placeholder_path ni mediamtx_path, saltado"
        continue
    }

    $placeholder = "rtsp://placeholder/$phPath"
    if ($tpl.Contains($placeholder)) {
        $tpl = $tpl.Replace($placeholder, $url)
        # Mostrar enmascarado
        $masked = $url -replace ':[^:@]+@', ':***@'
        Write-Host "  [OK] $nombre ($phPath) -> $masked   [$($info.fuente_ip)]"
        $count++
    } else {
        Write-Host "[WARN] No se encontro placeholder '$placeholder' en el template"
    }
}

if ($count -eq 0) {
    Write-Host "[ERROR] No se reemplazo ningun placeholder. Revisa el yml y el JSON."
    exit 1
}

# Escribir runtime SIN BOM (MediaMTX no acepta UTF-8 con BOM)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($Runtime, $tpl, $utf8NoBom)

Write-Host "[OK] $count path(s) renderizado(s) -> $Runtime"
