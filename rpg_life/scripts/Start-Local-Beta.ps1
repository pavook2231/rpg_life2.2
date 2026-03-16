param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Get-LanIpv4Address {
    try {
        $addresses = Get-NetIPAddress -AddressFamily IPv4 |
            Where-Object {
                $_.IPAddress -ne "127.0.0.1" -and
                $_.IPAddress -notlike "169.254.*" -and
                $_.PrefixOrigin -ne "WellKnown"
            }

        $value = $addresses | Select-Object -First 1 -ExpandProperty IPAddress
        if ($value) {
            return $value
        }
    } catch {
        # Fall back to ipconfig parsing on systems where Get-NetIPAddress is restricted.
    }

    $ipconfigOutput = ipconfig
    $match = $ipconfigOutput | Select-String -Pattern 'IPv4[^:]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)'
    foreach ($item in $match) {
        $candidate = $item.Matches[0].Groups[1].Value
        if ($candidate -and $candidate -ne "127.0.0.1" -and $candidate -notlike "169.254.*") {
            return $candidate
        }
    }

    return $null
}

function Wait-ForHttpOk($url, $timeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    return $false
}

Write-Step "Checking Docker"
docker --version | Out-Null
docker compose version | Out-Null

Write-Step "Detecting local IP"
$lanIp = Get-LanIpv4Address
if (-not $lanIp) {
    throw "Failed to detect local IPv4 address. Make sure the computer is connected to Wi-Fi."
}

$apiRoot = "http://$lanIp`:8000"
$apiBaseUrl = "$apiRoot/api/v1"

Write-Step "Starting backend for local beta"
$composeArgs = @("compose", "up", "-d")
if (-not $SkipBuild) {
    $composeArgs += "--build"
}

& docker @composeArgs

Write-Step "Waiting for API readiness"
$healthOk = Wait-ForHttpOk "$apiRoot/healthz" 120
if (-not $healthOk) {
    Write-Host ""
    Write-Host "Backend did not answer /healthz within 120 seconds." -ForegroundColor Yellow
    Write-Host "Check logs with:" -ForegroundColor Yellow
    Write-Host "docker compose logs api" -ForegroundColor White
    exit 1
}

Write-Step "Local beta is ready"
Write-Host "API base URL:" -ForegroundColor Green
Write-Host $apiBaseUrl -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Connect the phone and the computer to the same Wi-Fi." -ForegroundColor White
Write-Host "2. If you use Expo Go, enter this URL on the login screen." -ForegroundColor White
Write-Host "3. If you build a beta APK, set this env variable:" -ForegroundColor White
Write-Host "   `$env:EXPO_PUBLIC_API_BASE_URL=`"$apiBaseUrl`"" -ForegroundColor White
Write-Host ""
Write-Host "Useful links:" -ForegroundColor Green
Write-Host "$apiRoot/healthz" -ForegroundColor White
Write-Host "$apiRoot/readyz" -ForegroundColor White
