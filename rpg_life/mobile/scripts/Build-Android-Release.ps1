param(
  [string]$VersionName = "2.2",
  [int]$VersionCode = 3
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot "android"
$sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$localPropertiesPath = Join-Path $androidDir "local.properties"
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
$env:Path = "$sdkRoot\platform-tools;$sdkRoot\build-tools;$env:Path"
$env:RPG_LIFE_VERSION_NAME = $VersionName
$env:RPG_LIFE_VERSION_CODE = [string]$VersionCode

$resolvedJavaHome = $preferredJavaHomes | Where-Object { Test-Path (Join-Path $_ "bin\java.exe") } | Select-Object -First 1
if ($resolvedJavaHome) {
  $env:JAVA_HOME = $resolvedJavaHome
  $env:Path = "$resolvedJavaHome\bin;$env:Path"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java (JDK 17+) is not installed or not added to PATH. Install a JDK, reopen PowerShell, and run this script again."
}

@"
sdk.dir=$($sdkRoot.Replace('\', '\\'))
"@ | Set-Content -Path $localPropertiesPath -Encoding ASCII

Push-Location $androidDir
try {
  & .\gradlew.bat assembleRelease
}
finally {
  Pop-Location
}
