# ─────────────────────────────────────────────────────────────────────────
# Publica una versión nueva de la APK de Prodhin.
#
# Hace TODO de una:
#   1. Toma la APK del build, la renombra a prodhin-<version>.apk
#   2. Crea el Release en el repo público prodhin-releases con la APK
#   3. Actualiza update.json (latestVersion + apkUrl + notes) y lo pushea
#
# Uso (desde PowerShell, en la carpeta del repo o donde sea):
#   .\apps\mobile\scripts\publish-release.ps1 -Version 1.1.0 -Notes "Que cambio"
#
# Opcionales:
#   -ApkPath "ruta\a\tu.apk"   (si tu APK no está en la ruta por defecto)
#   -Mandatory                 (obliga a actualizar; el chofer no puede posponer)
#
# Requisitos: gh (GitHub CLI) instalado y logueado (gh auth login), y git.
# ⚠️ ANTES de correr esto: subí el número de versión en app.json y en
#    src/lib/appVersion.ts (APP_VERSION), y generá la APK.
# ─────────────────────────────────────────────────────────────────────────

param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [string]$Notes = "Actualizacion de Prodhin.",

  [string]$ApkPath = "",

  [switch]$Mandatory
)

$ErrorActionPreference = "Stop"

$Repo = "aragontechsolutions-dev/prodhin-releases"

# Carpeta de este script → raíz de apps/mobile
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MobileDir = Split-Path -Parent $ScriptDir

# Ruta por defecto de la APK (build release de gradle)
if ([string]::IsNullOrWhiteSpace($ApkPath)) {
  $ApkPath = Join-Path $MobileDir "android\app\build\outputs\apk\release\app-release.apk"
}

if (-not (Test-Path $ApkPath)) {
  Write-Error "No encontre la APK en: $ApkPath`nGenera la APK primero o pasa -ApkPath con la ruta correcta."
}

# 1. Copiar/renombrar la APK a prodhin-<version>.apk (en la misma carpeta)
$ApkDir = Split-Path -Parent $ApkPath
$TargetApk = Join-Path $ApkDir "prodhin-$Version.apk"
Copy-Item $ApkPath $TargetApk -Force
Write-Host "APK lista: $TargetApk" -ForegroundColor Green

# 2. Crear el Release con la APK adjunta
$Tag = "v$Version"
Write-Host "Creando release $Tag en $Repo..." -ForegroundColor Cyan
gh release create $Tag $TargetApk --repo $Repo --title $Tag --notes $Notes
if ($LASTEXITCODE -ne 0) { Write-Error "Fallo la creacion del release." }

# 3. Actualizar update.json en el repo de releases
$ApkUrl = "https://github.com/$Repo/releases/download/$Tag/prodhin-$Version.apk"
$MandatoryBool = if ($Mandatory) { "true" } else { "false" }

$Tmp = Join-Path $env:TEMP "prodhin-releases-$(Get-Random)"
Write-Host "Actualizando update.json..." -ForegroundColor Cyan
gh repo clone $Repo $Tmp -- --depth 1 | Out-Null

$UpdateJson = @"
{
  "latestVersion": "$Version",
  "apkUrl": "$ApkUrl",
  "mandatory": $MandatoryBool,
  "notes": "$($Notes -replace '"','\"')"
}
"@
# IMPORTANTE: escribir SIN BOM. Set-Content -Encoding UTF8 agrega un BOM en
# Windows PowerShell 5.1, y ese BOM rompe el JSON.parse de la app.
[System.IO.File]::WriteAllText(
  (Join-Path $Tmp "update.json"),
  $UpdateJson,
  (New-Object System.Text.UTF8Encoding($false))
)

Push-Location $Tmp
git add update.json
git commit -m "release $Version" | Out-Null
git push | Out-Null
Pop-Location

Remove-Item $Tmp -Recurse -Force

Write-Host ""
Write-Host "LISTO. Version $Version publicada." -ForegroundColor Green
Write-Host "  APK:  $ApkUrl" -ForegroundColor Gray
Write-Host "  Los choferes veran el aviso al abrir la app (puede tardar ~5 min por cache de GitHub)." -ForegroundColor Gray
