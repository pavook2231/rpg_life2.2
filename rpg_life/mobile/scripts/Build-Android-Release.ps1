param(
  [string]$VersionName = "1.4",
  [int]$VersionCode = 7,
  [string]$Architectures = "arm64-v8a",
  [int]$MaxWorkers = 0,
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
$sdkPlatformJarPath = Join-Path $sdkRoot "platforms\android-36\core-for-system-modules.jar"
$localPropertiesPath = Join-Path $physicalAndroidDir "local.properties"
$useSafeMode = if ($FastMode) { $false } elseif ($SafeMode) { $true } else { $false }
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

function Test-NativeBuildLockFailure {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LogPath
  )

  if (-not (Test-Path $LogPath)) {
    return $false
  }

  $content = Get-Content -Path $LogPath -Raw -ErrorAction SilentlyContinue
  if (-not $content) {
    return $false
  }

  $hasCmakeFailure = $content -match "configureCMake.*FAILED"
  $hasFileLockSignal = (
    $content -match "FileSystemException: .*\\\.cxx" -or
    $content -match "CMakeFiles\\CMakeTmp" -or
    $content -match "being used by another process"
  )

  return ($hasCmakeFailure -and $hasFileLockSignal)
}

function Test-SdkJarAccessDeniedFailure {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LogPath
  )

  if (-not (Test-Path $LogPath)) {
    return $false
  }

  $content = Get-Content -Path $LogPath -Raw -ErrorAction SilentlyContinue
  if (-not $content) {
    return $false
  }

  return (
    $content -match "AccessDeniedException: .*core-for-system-modules\.jar" -or
    ($content -match "An exception has occurred in the compiler" -and $content -match "core-for-system-modules\.jar")
  )
}

function Assert-SdkJarReadable {
  param(
    [Parameter(Mandatory = $true)]
    [string]$JarPath
  )

  if (-not (Test-Path $JarPath)) {
    throw "Android SDK platform jar is missing: $JarPath. Reinstall platform android-36 via SDK Manager."
  }

  try {
    $fs = [System.IO.File]::Open($JarPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $fs.Close()
  }
  catch {
    throw "Cannot read Android SDK jar ($JarPath). Another process (antivirus/indexer/SDK manager) may be locking it."
  }
}

function Reset-JavaToolchainState {
  Write-Host "Resetting Java/Gradle processes after SDK jar lock..."
  Get-Process java, gradle -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
}

function Reset-NativeBuildArtifacts {
  Write-Host "Clearing native build artifacts for Reanimated/Worklets..."
  Get-Process java, cmake, ninja -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2

  Remove-GeneratedDirectory -Path (Join-Path $physicalProjectRoot "node_modules\react-native-worklets\android\.cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalProjectRoot "node_modules\react-native-worklets\android\build\intermediates\cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalProjectRoot "node_modules\react-native-reanimated\android\.cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalProjectRoot "node_modules\react-native-reanimated\android\build\intermediates\cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalAndroidDir "app\.cxx")
  Remove-GeneratedDirectory -Path (Join-Path $physicalAndroidDir "app\build\intermediates\cxx")
}

if (-not (Test-Path $sdkRoot)) {
  throw "Android SDK not found: $sdkRoot"
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_USER_HOME = $androidUserHome
$env:GRADLE_USER_HOME = $gradleUserHome
$env:KOTLIN_DAEMON_ENABLED = "false"
$env:TEMP = $systemTempDir
$env:TMP = $systemTempDir
$env:NODE_ENV = "production"
$env:RPG_LIFE_METRO_PROJECT_ROOT = $physicalProjectRoot
$autoWorkers = [Math]::Max(2, [Math]::Min(4, [Environment]::ProcessorCount - 1))
$effectiveWorkers = if ($useSafeMode) { 1 } elseif ($MaxWorkers -gt 0) { [Math]::Max(1, $MaxWorkers) } else { $autoWorkers }
$gradleCaching = if ($useSafeMode) { "false" } else { "true" }
$gradleParallel = if ($useSafeMode) { "false" } else { "true" }
$env:GRADLE_OPTS = "-Dorg.gradle.vfs.watch=false -Dorg.gradle.workers.max=$effectiveWorkers -Dorg.gradle.caching=$gradleCaching -Dorg.gradle.parallel=$gradleParallel -Djava.io.tmpdir=$javaTempDir -Dkotlin.daemon.enabled=false -Dkotlin.compiler.execution.strategy=in-process"
$env:Path = "$sdkRoot\platform-tools;$sdkRoot\build-tools;$env:Path"
$env:RPG_LIFE_VERSION_NAME = $VersionName
$env:RPG_LIFE_VERSION_CODE = [string]$VersionCode
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = $Architectures
$newArchitectureEnabled = if ($PSBoundParameters.ContainsKey("UseNewArchitecture")) {
  if ($UseNewArchitecture) { "true" } else { "false" }
}
else {
  "true"
}
$env:ORG_GRADLE_PROJECT_newArchEnabled = $newArchitectureEnabled

$resolvedJavaHome = $preferredJavaHomes | Where-Object { Test-Path (Join-Path $_ "bin\java.exe") } | Select-Object -First 1
if ($resolvedJavaHome) {
  $env:JAVA_HOME = $resolvedJavaHome
  $env:Path = "$resolvedJavaHome\bin;$env:Path"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java (JDK 17+) is not installed or not added to PATH. Install a JDK, reopen PowerShell, and run this script again."
}

Assert-SdkJarReadable -JarPath $sdkPlatformJarPath

New-Item -ItemType Directory -Force -Path $buildLogDir | Out-Null

if ($ResetCaches) {
  Get-Process java, cmake, ninja -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

  Remove-GeneratedDirectory -Path $gradleUserHome
  Remove-GeneratedDirectory -Path $androidUserHome
  Remove-GeneratedDirectory -Path $tempRoot
  Reset-NativeBuildArtifacts
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
    "--no-daemon",
    "--max-workers=$effectiveWorkers"
  )
  if (-not $useSafeMode) {
    $gradleArgs += "--build-cache"
  }
  if ($CleanBuild) {
    $gradleArgs = @("clean") + $gradleArgs
  }
  if ($useSafeMode) {
    $gradleArgs += @("--no-parallel", "--no-build-cache")
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

  $maxLockRetries = 2
  $attemptLogs = @()
  $lastRecoveryReason = $null
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $gradleExitCode = -1
    for ($attempt = 0; $attempt -le $maxLockRetries; $attempt++) {
      $attemptLabel = if ($attempt -eq 0) { "initial" } else { "retry$attempt" }
      $attemptLogPath = Join-Path $buildLogDir "android-release-$buildStamp-$attemptLabel.log"
      $attemptLogs += $attemptLogPath
      if ($attempt -eq 0) {
        $gradleLogPath = $attemptLogPath
      }

      if ($attempt -gt 0) {
        if ($lastRecoveryReason -eq "sdk_jar_lock") {
          Write-Host "Retrying build after SDK jar lock recovery (attempt $attempt/$maxLockRetries)..."
          Reset-JavaToolchainState
          Assert-SdkJarReadable -JarPath $sdkPlatformJarPath
        }
        else {
          Write-Host "Retrying build after native lock cleanup (attempt $attempt/$maxLockRetries)..."
          Reset-NativeBuildArtifacts
        }
      }

      & .\gradlew.bat @gradleArgs *> $attemptLogPath
      $gradleExitCode = $LASTEXITCODE
      if ($gradleExitCode -eq 0) {
        $gradleLogPath = $attemptLogPath
        break
      }

      if (Test-NativeBuildLockFailure -LogPath $attemptLogPath) {
        $lastRecoveryReason = "native_lock"
        if ($attempt -lt $maxLockRetries) {
          Write-Host "Detected transient native file lock (CMake/.cxx)."
          continue
        }
      }
      elseif (Test-SdkJarAccessDeniedFailure -LogPath $attemptLogPath) {
        $lastRecoveryReason = "sdk_jar_lock"
        if ($attempt -lt $maxLockRetries) {
          Write-Host "Detected transient SDK jar lock (core-for-system-modules.jar)."
          continue
        }
      }
      else {
        $lastRecoveryReason = $null
      }

      $gradleLogPath = $attemptLogPath
      if ($attempt -lt $maxLockRetries -and $lastRecoveryReason) {
        continue
      }
      break
    }
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $stopwatch.Stop()

  if ($gradleExitCode -ne 0) {
    Write-Host ""
    Write-Host "Gradle failed with exit code $gradleExitCode after $([Math]::Round($stopwatch.Elapsed.TotalMinutes, 1)) min. Tail of the log:"
    if ($attemptLogs.Count -gt 1) {
      foreach ($attemptLog in $attemptLogs) {
        if (Test-Path $attemptLog) {
          Write-Host "--- Log tail ($attemptLog) ---"
          Get-Content -Path $attemptLog -Tail 40
        }
      }
      throw "Gradle assembleRelease failed after retries. Logs: $($attemptLogs -join ' ; ')"
    }
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
