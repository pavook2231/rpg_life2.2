param(
  [string]$VersionName = "1.3",
  [int]$VersionCode = 6,
  [string]$Architectures = "arm64-v8a",
  [int]$MaxWorkers = 2,
  [switch]$CleanBuild,
  [switch]$ResetCaches,
  [switch]$SafeMode,
  [switch]$FastMode,
  [switch]$UseNewArchitecture,
  [switch]$UseShortRoot,
  [switch]$DisableShortRoot
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

if ($SafeMode -and $FastMode) {
  throw "Use either -SafeMode or -FastMode, not both."
}

$physicalProjectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $physicalProjectRoot)
$projectRoot = $physicalProjectRoot
$junctionProjectRoot = Join-Path $workspaceRoot "x"
$mappedDrive = $null
$preferredDriveLetters = @("R", "S", "T", "U", "V", "W", "X", "Y", "Z")
$shouldUseShortRoot = $UseShortRoot.IsPresent -and -not $DisableShortRoot.IsPresent
if ($shouldUseShortRoot) {
  if (-not (Test-Path $junctionProjectRoot)) {
    cmd /c mklink /J "$junctionProjectRoot" "$physicalProjectRoot" | Out-Null
  }
  if (Test-Path (Join-Path $junctionProjectRoot "android\gradlew.bat")) {
    $projectRoot = $junctionProjectRoot
  }
  else {
    foreach ($letter in $preferredDriveLetters) {
      if (Get-PSDrive -Name $letter -ErrorAction SilentlyContinue) {
        continue
      }

      $candidateDrive = "${letter}:"
      cmd /c subst $candidateDrive "$physicalProjectRoot" | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $mappedDrive = $candidateDrive
        $projectRoot = "$candidateDrive\"
        break
      }
    }
  }
}

$androidDir = Join-Path $projectRoot "android"
$physicalAndroidDir = Join-Path $physicalProjectRoot "android"
$releaseOutputDir = Join-Path $physicalAndroidDir "app\build\outputs\apk\release"
$namedApkPath = Join-Path $releaseOutputDir "rpg_life $VersionName.apk"
$sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$localPropertiesPath = Join-Path $physicalAndroidDir "local.properties"
$useSafeMode = if ($FastMode) { $false } elseif ($SafeMode) { $true } else { $true }
$cacheSuffix = if ($useSafeMode) { "s" } else { "f" }
$androidUserHome = Join-Path $workspaceRoot ".ah$cacheSuffix"
$gradleUserHome = Join-Path $workspaceRoot ".gh$cacheSuffix"
$tempRoot = Join-Path $workspaceRoot ".bt$cacheSuffix"
$javaTempDir = Join-Path $tempRoot "java"
$systemTempDir = Join-Path $tempRoot "system"
$buildLogDir = Join-Path $workspaceRoot ".build-logs"
$buildStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$gradleLogPath = Join-Path $buildLogDir "android-release-$buildStamp.log"
$preferredJavaHomes = @(
  "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot",
  "C:\Program Files\Eclipse Adoptium\jdk-17",
  "C:\Program Files\Java\jdk-17",
  "C:\Program Files\Java\jdk-21"
)

function Remove-GeneratedDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return
  }

  $longPath = if ($Path.StartsWith("\\?\")) { $Path } else { "\\?\$Path" }
  cmd /c rd /s /q "$longPath" | Out-Null

  if (Test-Path $Path) {
    Remove-Item -Path $Path -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path $sdkRoot)) {
  throw "Android SDK not found: $sdkRoot"
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_USER_HOME = $androidUserHome
$env:GRADLE_USER_HOME = $gradleUserHome
$env:TEMP = $systemTempDir
$env:TMP = $systemTempDir
$env:NODE_ENV = "production"
$env:RPG_LIFE_METRO_PROJECT_ROOT = $physicalProjectRoot
$effectiveWorkers = if ($useSafeMode) { 1 } else { [Math]::Max(1, $MaxWorkers) }
$gradleCaching = if ($useSafeMode) { "false" } else { "true" }
$gradleParallel = if ($useSafeMode) { "false" } else { "true" }
$env:GRADLE_OPTS = "-Dorg.gradle.vfs.watch=false -Dorg.gradle.workers.max=$effectiveWorkers -Dorg.gradle.caching=$gradleCaching -Dorg.gradle.parallel=$gradleParallel -Djava.io.tmpdir=$javaTempDir"
$env:Path = "$sdkRoot\platform-tools;$sdkRoot\build-tools;$env:Path"
$env:RPG_LIFE_VERSION_NAME = $VersionName
$env:RPG_LIFE_VERSION_CODE = [string]$VersionCode
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = $Architectures
$env:ORG_GRADLE_PROJECT_newArchEnabled = if ($UseNewArchitecture) { "true" } else { "false" }

$resolvedJavaHome = $preferredJavaHomes | Where-Object { Test-Path (Join-Path $_ "bin\java.exe") } | Select-Object -First 1
if ($resolvedJavaHome) {
  $env:JAVA_HOME = $resolvedJavaHome
  $env:Path = "$resolvedJavaHome\bin;$env:Path"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java (JDK 17+) is not installed or not added to PATH. Install a JDK, reopen PowerShell, and run this script again."
}

New-Item -ItemType Directory -Force -Path $buildLogDir | Out-Null

if ($ResetCaches) {
  Get-Process java, cmake, ninja -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

  Remove-GeneratedDirectory -Path $gradleUserHome
  Remove-GeneratedDirectory -Path $androidUserHome
  Remove-GeneratedDirectory -Path $tempRoot
  Remove-GeneratedDirectory -Path (Join-Path $physicalProjectRoot "node_modules\react-native-worklets\android\.cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalProjectRoot "node_modules\react-native-worklets\android\build\intermediates\cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalProjectRoot "node_modules\react-native-reanimated\android\.cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalProjectRoot "node_modules\react-native-reanimated\android\build\intermediates\cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalAndroidDir "app\.cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalAndroidDir "app\build\intermediates\cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalAndroidDir "app\build\outputs\apk")
}

New-Item -ItemType Directory -Force -Path $androidUserHome | Out-Null
New-Item -ItemType Directory -Force -Path $gradleUserHome | Out-Null
New-Item -ItemType Directory -Force -Path $javaTempDir | Out-Null
New-Item -ItemType Directory -Force -Path $systemTempDir | Out-Null

@"
sdk.dir=$($sdkRoot.Replace('\', '\\'))
"@ | Set-Content -Path $localPropertiesPath -Encoding ASCII

Push-Location $androidDir
try {
  $gradleArgs = @(
    "assembleRelease",
    "--console=plain",
    "--warning-mode=none",
    "--max-workers=$effectiveWorkers"
  )
  if (-not $useSafeMode) {
    $gradleArgs += "--build-cache"
  }
  if ($CleanBuild) {
    $gradleArgs = @("clean") + $gradleArgs
  }
  if ($useSafeMode) {
    $gradleArgs += @("--no-daemon", "--no-parallel", "--no-build-cache")
  }

  Write-Host "Starting Android release build (architectures=$Architectures, workers=$effectiveWorkers, clean=$($CleanBuild.IsPresent), resetCaches=$($ResetCaches.IsPresent), safeMode=$useSafeMode)"
  Write-Host "New architecture: $($env:ORG_GRADLE_PROJECT_newArchEnabled)"
  if ($shouldUseShortRoot -and $projectRoot -ne $physicalProjectRoot) {
    Write-Host "Using short build root $projectRoot"
  }
  if ($mappedDrive) {
    Write-Host "Using short build root $mappedDrive for Android sources"
  }
  Write-Host "Gradle log: $gradleLogPath"

  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & .\gradlew.bat @gradleArgs *> $gradleLogPath
    $gradleExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $stopwatch.Stop()

  if ($gradleExitCode -ne 0) {
    Write-Host ""
    Write-Host "Gradle failed with exit code $gradleExitCode after $([Math]::Round($stopwatch.Elapsed.TotalMinutes, 1)) min. Tail of the log:"
    Get-Content -Path $gradleLogPath -Tail 80
    throw "Gradle assembleRelease failed. Full log: $gradleLogPath"
  }

  $resolvedApk = Get-ChildItem -Path $releaseOutputDir -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $resolvedApk) {
    throw "Release APK not found under $releaseOutputDir. Full log: $gradleLogPath"
  }

  if ([System.StringComparer]::OrdinalIgnoreCase.Equals($resolvedApk.FullName, $namedApkPath)) {
    Write-Host "Created $namedApkPath in $([Math]::Round($stopwatch.Elapsed.TotalMinutes, 1)) min"
  }
  else {
    Copy-Item -Path $resolvedApk.FullName -Destination $namedApkPath -Force
    Write-Host "Created $namedApkPath from $($resolvedApk.FullName) in $([Math]::Round($stopwatch.Elapsed.TotalMinutes, 1)) min"
  }
}
finally {
  Pop-Location
  if ($mappedDrive) {
    cmd /c subst $mappedDrive /d | Out-Null
  }
}
