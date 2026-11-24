
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupDir
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$SourceMedia = Join-Path $BackupDir "media"
$ManifestPath = Join-Path $BackupDir "manifest.json"
$IncompletePath = Join-Path $BackupDir "_NIEKOMPLETNY.txt"

if (!(Test-Path -LiteralPath $SourceMedia -PathType Container)) {
    throw "Brak katalogu media w backupie."
}

if (!(Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "Brak manifest.json."
}

if (Test-Path -LiteralPath $IncompletePath) {
    throw "Backup jest niekompletny."
}

$Manifest = Get-Content -LiteralPath $ManifestPath -Raw |
    ConvertFrom-Json

$SourceFiles = @(
    Get-ChildItem -LiteralPath $SourceMedia -Recurse -File
)

if ($SourceFiles.Count -ne [int]$Manifest.media_file_count) {
    throw "Liczba plikow nie zgadza sie z manifestem."
}

$Id = [guid]::NewGuid().ToString("N").Substring(0, 8)
$ContainerName = "flotivo-media-test-$Id"
$TempDir = Join-Path $env:TEMP "flotivo-media-test-$Id"

$ContainerStarted = $false

New-Item -ItemType Directory -Path $TempDir -Force |
    Out-Null

try {
    Write-Host "[1/4] Uruchamianie izolowanego kontenera..."

    & docker run -d --rm `
        --name $ContainerName `
        --network none `
        --entrypoint sh `
        fleet-management-system-backend:latest `
        -c "sleep 300" | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Nie udalo sie uruchomic kontenera."
    }

    $ContainerStarted = $true

    & docker exec $ContainerName mkdir -p /restore

    if ($LASTEXITCODE -ne 0) {
        throw "Nie udalo sie utworzyc katalogu testowego."
    }

    Write-Host "[2/4] Przywracanie plikow do kontenera..."

    & docker cp $SourceMedia "${ContainerName}:/restore/"

    if ($LASTEXITCODE -ne 0) {
        throw "Nie udalo sie przywrocic media."
    }

    Write-Host "[3/4] Odczytywanie odtworzonych plikow..."

    & docker cp "${ContainerName}:/restore/media" $TempDir

    if ($LASTEXITCODE -ne 0) {
        throw "Nie udalo sie odczytac plikow."
    }

    $RestoredMedia = Join-Path $TempDir "media"

    $RestoredFiles = @(
        Get-ChildItem -LiteralPath $RestoredMedia -Recurse -File
    )

    if ($RestoredFiles.Count -ne $SourceFiles.Count) {
        throw "Liczba odtworzonych plikow jest nieprawidlowa."
    }

    Write-Host "[4/4] Porownywanie SHA-256..."

    $SourceRoot = $SourceMedia.TrimEnd('\', '/')

    foreach ($File in $SourceFiles) {
        $Relative = $File.FullName.Substring(
            $SourceRoot.Length
        ).TrimStart('\', '/')

        $RestoredPath = Join-Path $RestoredMedia $Relative

        if (!(Test-Path -LiteralPath $RestoredPath -PathType Leaf)) {
            throw "Nie odnaleziono jednego z odtworzonych plikow."
        }

        $OriginalHash = (
            Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256
        ).Hash

        $RestoredHash = (
            Get-FileHash -LiteralPath $RestoredPath -Algorithm SHA256
        ).Hash

        if ($OriginalHash -ne $RestoredHash) {
            throw "Wykryto niezgodnosc SHA-256."
        }
    }

    Write-Host ""
    Write-Host "======================================"
    Write-Host " TEST MEDIA ZAKONCZONY POMYSLNIE"
    Write-Host "======================================"
    Write-Host "Sprawdzone pliki: $($SourceFiles.Count)"
    Write-Host "Wszystkie sumy SHA-256 sa zgodne."
}
finally {
    if ($ContainerStarted) {
        & docker rm -f $ContainerName | Out-Null
    }

    if (Test-Path -LiteralPath $TempDir) {
        Remove-Item -LiteralPath $TempDir -Recurse -Force
    }
}
