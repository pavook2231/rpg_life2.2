param(
  [string]$VersionName = "1.1",
  [int]$VersionCode = 4,
  [string]$Architectures = "arm64-v8a"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot "android"
$releaseOutputDir = Join-Path $androidDir "app\build\outputs\apk\release"
$namedApkPath = Join-Path $releaseOutputDir "rpg_life $VersionName.apk"
$sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$localPropertiesPath = Join-Path $androidDir "local.properties"
$androidUserHome = Join-Path $androidDir ".android-home"
$gradleUserHome = Join-Path $androidDir ".gradle-user"
$tempRoot = Join-Path $androidDir ".build-tmp"
$javaTempDir = Join-Path $tempRoot "java"
$systemTempDir = Join-Path $tempRoot "system"
$preferredJavaHomes = @(
  "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot",
  "C:\Program Files\Eclipse Adoptium\jdk-17",
  "C:\Program Files\Java\jdk-17",
  "C:\Program Files\Java\jdk-21"
)

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
$env:GRADLE_OPTS = "-Dorg.gradle.vfs.watch=false -Dorg.gradle.workers.max=1 -Dorg.gradle.caching=false -Dorg.gradle.parallel=false -Djava.io.tmpdir=$javaTempDir"
$env:Path = "$sdkRoot\platform-tools;$sdkRoot\build-tools;$env:Path"
$env:RPG_LIFE_VERSION_NAME = $VersionName
$env:RPG_LIFE_VERSION_CODE = [string]$VersionCode
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = $Architectures

$resolvedJavaHome = $preferredJavaHomes | Where-Object { Test-Path (Join-Path $_ "bin\java.exe") } | Select-Object -First 1
if ($resolvedJavaHome) {
  $env:JAVA_HOME = $resolvedJavaHome
  $env:Path = "$resolvedJavaHome\bin;$env:Path"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java (JDK 17+) is not installed or not added to PATH. Install a JDK, reopen PowerShell, and run this script again."
}

New-Item -ItemType Directory -Force -Path $androidUserHome | Out-Null
New-Item -ItemType Directory -Force -Path $gradleUserHome | Out-Null
New-Item -ItemType Directory -Force -Path $javaTempDir | Out-Null
New-Item -ItemType Directory -Force -Path $systemTempDir | Out-Null

Push-Location $androidDir
try {
  try {
    & .\gradlew.bat --stop | Out-Null
  } catch {
    # Best-effort daemon shutdown before cache cleanup.
  }
}
finally {
  Pop-Location
}

$gradleCachesPath = Join-Path $gradleUserHome "caches"
if (Test-Path $gradleCachesPath) {
  Get-ChildItem -Path $gradleCachesPath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $transformsPath = Join-Path $_.FullName "transforms"
    if (Test-Path $transformsPath) {
      Remove-Item -Path $transformsPath -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

@"
sdk.dir=$($sdkRoot.Replace('\', '\\'))
"@ | Set-Content -Path $localPropertiesPath -Encoding ASCII

Push-Location $androidDir
try {
  & .\gradlew.bat clean assembleRelease --no-daemon --no-parallel --max-workers=1

  $defaultApkPath = Join-Path $releaseOutputDir "app-release.apk"
  if (-not (Test-Path $defaultApkPath)) {
    throw "Release APK not found: $defaultApkPath"
  }

  Copy-Item -Path $defaultApkPath -Destination $namedApkPath -Force
  Write-Host "Created $namedApkPath"
}
finally {
  Pop-Location
}
