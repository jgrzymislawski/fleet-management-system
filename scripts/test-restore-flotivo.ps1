
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupDir
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$DatabaseFile = Join-Path $BackupDir "database.dump"
$MediaDir = Join-Path $BackupDir "media"
$ManifestFile = Join-Path $BackupDir "manifest.json"
$IncompleteFile = Join-Path $BackupDir "_NIEKOMPLETNY.txt"

Write-Host ""
Write-Host "======================================"
Write-Host "  FLOTIVO - TEST ODTWARZANIA BACKUPU"
Write-Host "======================================"

# 1. Sprawdzamy pliki kopii
Write-Host "[1/5] Sprawdzanie plikow backupu..."

if (!(Test-Path -LiteralPath $DatabaseFile -PathType Leaf)) {
    throw "Nie znaleziono database.dump."
}

if (!(Test-Path -LiteralPath $MediaDir -PathType Container)) {
    throw "Nie znaleziono katalogu media."
}

if (!(Test-Path -LiteralPath $ManifestFile -PathType Leaf)) {
    throw "Nie znaleziono manifest.json."
}

if (Test-Path -LiteralPath $IncompleteFile) {
    throw "Backup jest oznaczony jako niekompletny."
}

$Manifest = Get-Content -LiteralPath $ManifestFile -Raw |
    ConvertFrom-Json

$ActualHash = (
    Get-FileHash -LiteralPath $DatabaseFile -Algorithm SHA256
).Hash

if ($ActualHash -ne $Manifest.database_sha256) {
    throw "Niezgodna suma kontrolna database.dump."
}

$MediaCount = @(
    Get-ChildItem -LiteralPath $MediaDir -Recurse -File
).Count

if ($MediaCount -ne [int]$Manifest.media_file_count) {
    throw "Liczba plikow media nie zgadza sie z manifestem."
}

Write-Host "Integralnosc pliku bazy: OK"
Write-Host "Liczba plikow media: $MediaCount"

# Nazwa losowa zapobiega konfliktom z innymi kontenerami.
$RestoreName = "flotivo-restore-" +
    [guid]::NewGuid().ToString("N").Substring(0, 8)

$TemporaryPassword = [guid]::NewGuid().ToString("N")
$ContainerStarted = $false

try {
    # 2. Nowy, izolowany PostgreSQL
    Write-Host "[2/5] Uruchamianie testowego PostgreSQL..."

    & docker run -d --rm `
        --name $RestoreName `
        --network none `
        -e "POSTGRES_USER=flotivo_restore" `
        -e "POSTGRES_PASSWORD=$TemporaryPassword" `
        -e "POSTGRES_DB=flotivo_restore" `
        postgres:17 | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Nie udalo sie uruchomic kontenera."
    }

    $ContainerStarted = $true


# Czekamy na DOCELOWY proces PostgreSQL.
# Podczas pierwszej inicjalizacji obrazu postgres:17
# uruchamiany jest najpierw serwer tymczasowy.
# Sam pg_isready moze wtedy zbyt wczesnie zwrocic sukces.

$Ready = $false

for ($i = 0; $i -lt 60; $i++) {

    # Sprawdzamy proces PID 1.
    # Po zakonczeniu inicjalizacji powinien to byc postgres.
    $MainProcess = (
        & docker exec $RestoreName cat /proc/1/comm 2>$null |
            Out-String
    ).Trim()

    if (
        $LASTEXITCODE -eq 0 -and
        $MainProcess -eq "postgres"
    ) {
        # Sprawdzamy gotowosc docelowego serwera.
        & docker exec $RestoreName `
            pg_isready -U flotivo_restore -d flotivo_restore `
            *> $null

        if ($LASTEXITCODE -eq 0) {
            $Ready = $true
            break
        }
    }

    Start-Sleep -Seconds 1
}

if (!$Ready) {
    throw "Testowy PostgreSQL nie uruchomil sie poprawnie."
}

Write-Host "PostgreSQL gotowy do odtwarzania."


    # 3. Kopiowanie zrzutu
    Write-Host "[3/5] Kopiowanie database.dump..."

    & docker cp `
        $DatabaseFile `
        "${RestoreName}:/tmp/database.dump"

    if ($LASTEXITCODE -ne 0) {
        throw "Kopiowanie zrzutu nie powiodlo sie."
    }

    # 4. Przywracanie danych
    Write-Host "[4/5] Odtwarzanie bazy danych..."

    & docker exec $RestoreName `
        pg_restore `
        -U flotivo_restore `
        -d flotivo_restore `
        --no-owner `
        --no-acl `
        --single-transaction `
        --exit-on-error `
        /tmp/database.dump

    if ($LASTEXITCODE -ne 0) {
        throw "Odtwarzanie PostgreSQL nie powiodlo sie."
    }

    # 5. Sprawdzenie tabel
    Write-Host "[5/5] Sprawdzanie odtworzonych danych..."

    $Sql = "SELECT 'Migracje: ' || " +
        "(SELECT COUNT(*) FROM django_migrations) || " +
        "', pojazdy: ' || " +
        "(SELECT COUNT(*) FROM vehicles_vehicle) || " +
        "', kierowcy: ' || " +
        "(SELECT COUNT(*) FROM drivers_driver);"

    $Result = & docker exec $RestoreName `
        psql -U flotivo_restore `
        -d flotivo_restore `
        -Atc $Sql

    if ($LASTEXITCODE -ne 0) {
        throw "Nie udalo sie odczytac odtworzonych tabel."
    }

    Write-Host ""
    Write-Host "ODTWORZONE DANE: $Result"
    Write-Host ""
    Write-Host "======================================"
    Write-Host " TEST ODTWARZANIA ZAKONCZONY POMYSLNIE"
    Write-Host "======================================"
}
finally {
    # Usuwamy kontener testowy, nawet przy bledzie.
    if ($ContainerStarted) {
        Write-Host "Usuwanie testowego kontenera..."

        & docker stop $RestoreName | Out-Null

        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Sprawdz recznie kontener: $RestoreName"
        }
    }
}
