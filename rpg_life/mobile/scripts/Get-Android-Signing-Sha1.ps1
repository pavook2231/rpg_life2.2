param(
  [switch]$UseDebug,
  [string]$KeystorePath,
  [string]$Alias,
  [string]$StorePassword,
  [string]$KeyPassword
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidAppDir = Join-Path $projectRoot "android\app"
$defaultDebugKeystore = Join-Path $androidAppDir "debug.keystore"
$defaultPackageName = "com.rpglife.mobile"

function Resolve-Keytool {
  $command = Get-Command keytool -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $javaHome = $env:JAVA_HOME
  if ($javaHome) {
    $candidate = Join-Path $javaHome "bin\keytool.exe"
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "keytool не найден. Установи JDK 17+ или добавь keytool в PATH."
}

function Resolve-ReleaseSigningConfig {
  $resolvedKeystore = $KeystorePath
  if (-not $resolvedKeystore) {
    $resolvedKeystore = $env:RPG_LIFE_UPLOAD_STORE_FILE
  }

  $resolvedAlias = $Alias
  if (-not $resolvedAlias) {
    $resolvedAlias = $env:RPG_LIFE_UPLOAD_KEY_ALIAS
  }

  $resolvedStorePassword = $StorePassword
  if (-not $resolvedStorePassword) {
    $resolvedStorePassword = $env:RPG_LIFE_UPLOAD_STORE_PASSWORD
  }

  $resolvedKeyPassword = $KeyPassword
  if (-not $resolvedKeyPassword) {
    $resolvedKeyPassword = $env:RPG_LIFE_UPLOAD_KEY_PASSWORD
  }

  if (-not ($resolvedKeystore -and $resolvedAlias -and $resolvedStorePassword -and $resolvedKeyPassword)) {
    return $null
  }

  if (-not [System.IO.Path]::IsPathRooted($resolvedKeystore)) {
    $resolvedKeystore = Join-Path $androidAppDir $resolvedKeystore
  }

  return [pscustomobject]@{
    Mode = "release"
    KeystorePath = $resolvedKeystore
    Alias = $resolvedAlias
    StorePassword = $resolvedStorePassword
    KeyPassword = $resolvedKeyPassword
  }
}

$keytoolPath = Resolve-Keytool
$releaseSigning = Resolve-ReleaseSigningConfig

if ($UseDebug -or -not $releaseSigning) {
  $signing = [pscustomobject]@{
    Mode = "debug"
    KeystorePath = $defaultDebugKeystore
    Alias = "androiddebugkey"
    StorePassword = "android"
    KeyPassword = "android"
  }
} else {
  $signing = $releaseSigning
}

if (-not (Test-Path $signing.KeystorePath)) {
  throw "Файл keystore не найден: $($signing.KeystorePath)"
}

$keytoolArgs = @(
  "-list",
  "-v",
  "-keystore", $signing.KeystorePath,
  "-alias", $signing.Alias,
  "-storepass", $signing.StorePassword,
  "-keypass", $signing.KeyPassword
)

$stdoutPath = [System.IO.Path]::GetTempFileName()
$stderrPath = [System.IO.Path]::GetTempFileName()

try {
  $process = Start-Process -FilePath $keytoolPath -ArgumentList $keytoolArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  $stdoutText = if (Test-Path $stdoutPath) { Get-Content $stdoutPath -Raw } else { "" }
  $stderrText = if (Test-Path $stderrPath) { Get-Content $stderrPath -Raw } else { "" }
  $outputText = ($stdoutText + "`n" + $stderrText).Trim()

  if ($process.ExitCode -ne 0) {
    throw "keytool завершился с ошибкой. Проверь keystore, alias и пароли.`n$outputText"
  }
}
finally {
  Remove-Item $stdoutPath, $stderrPath -ErrorAction SilentlyContinue
}

$sha1Match = [regex]::Match($outputText, "SHA1:\s*([A-F0-9:]+)")
$sha256Match = [regex]::Match($outputText, "SHA256:\s*([A-F0-9:]+)")

if (-not $sha1Match.Success) {
  throw "Не удалось извлечь SHA1 из вывода keytool.`n$outputText"
}

Write-Host ""
Write-Host "Android signing fingerprint"
Write-Host "Mode: $($signing.Mode)"
Write-Host "Package name: $defaultPackageName"
Write-Host "Keystore: $($signing.KeystorePath)"
Write-Host "Alias: $($signing.Alias)"
Write-Host "SHA1: $($sha1Match.Groups[1].Value)"
if ($sha256Match.Success) {
  Write-Host "SHA256: $($sha256Match.Groups[1].Value)"
}
Write-Host ""
Write-Host "Что вставлять в Google Cloud:"
Write-Host "1. Application type: Android"
Write-Host "2. Package name: $defaultPackageName"
Write-Host "3. SHA-1: $($sha1Match.Groups[1].Value)"
Write-Host ""
Write-Host "Если нужен именно debug-ключ, запусти:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\\scripts\\Get-Android-Signing-Sha1.ps1 -UseDebug"
