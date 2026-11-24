
param(
    [ValidateSet("dev", "prod")]
    [string]$Environment = "dev",

    [string]$Destination = (
        Join-Path $env:USERPROFILE "FlotivoBackups"
    )
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Katalog glownego projektu
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# Wybor pliku Docker Compose
$ComposeArgs = @()

if ($Environment -eq "prod") {
    $ComposeArgs = @("-f", "docker-compose.prod.yml")
}

# Unikalna nazwa kopii
$Timestamp = (Get-Date).ToUniversalTime().ToString(
    "yyyyMMdd_HHmmss"
)

$UniqueId = [guid]::NewGuid().ToString("N").Substring(0, 8)

$BackupName = "backup_${Timestamp}_${UniqueId}"

$BackupDir = Join-Path (
    Join-Path $Destination $Environment
) $BackupName

$DatabaseFile = Join-Path $BackupDir "database.dump"
$MediaDir = Join-Path $BackupDir "media"
$ManifestFile = Join-Path $BackupDir "manifest.json"
$IncompleteFile = Join-Path $BackupDir "_NIEKOMPLETNY.txt"

# Tymczasowy plik w kontenerze PostgreSQL
$TempDump = "/tmp/flotivo_${Timestamp}_${UniqueId}.dump"

$DbContainerId = ""
$BackendContainerId = ""

# Tworzymy katalog kopii
New-Item -ItemType Directory -Path $BackupDir -Force |
    Out-Null

# Znacznik niekompletnej kopii
Set-Content `
    -LiteralPath $IncompleteFile `
    -Value "Backup nie zostal jeszcze zakonczony." `
    -Encoding UTF8

Push-Location $ProjectRoot

try {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "       FLOTIVO - BACKUP"
    Write-Host "======================================"
    Write-Host "Srodowisko: $Environment"
    Write-Host "Folder: $BackupDir"
    Write-Host ""

    $DbContainerId = [string](
        & docker compose @ComposeArgs ps -q db
    )

    if (
        $LASTEXITCODE -ne 0 -or
        [string]::IsNullOrWhiteSpace($DbContainerId)
    ) {
        throw "Kontener PostgreSQL nie jest uruchomiony."
    }

    $DbContainerId = $DbContainerId.Trim()

    $BackendContainerId = [string](
        & docker compose @ComposeArgs ps -q backend
    )

    if (
        $LASTEXITCODE -ne 0 -or
        [string]::IsNullOrWhiteSpace($BackendContainerId)
    ) {
        throw "Kontener backendu nie jest uruchomiony."
    }

    $BackendContainerId = $BackendContainerId.Trim()

    Write-Host "[1/4] Tworzenie kopii PostgreSQL..."

$DumpCommand = 'PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U $POSTGRES_USER -d $POSTGRES_DB --format=custom --no-owner --no-acl -f $1 && pg_restore --list $1 >/dev/null'

& docker compose @ComposeArgs exec -T db `
    sh -c $DumpCommand sh $TempDump


    if ($LASTEXITCODE -ne 0) {
        throw "Tworzenie zrzutu PostgreSQL nie powiodlo sie."
    }

    # ====================================
    # 2. KOPIOWANIE BAZY
    # ====================================

    Write-Host "[2/4] Kopiowanie bazy na komputer..."

    & docker cp `
        "${DbContainerId}:${TempDump}" `
        $DatabaseFile

    if ($LASTEXITCODE -ne 0) {
        throw "Nie udalo sie skopiowac bazy danych."
    }

    $DbInfo = Get-Item -LiteralPath $DatabaseFile

    if ($DbInfo.Length -eq 0) {
        throw "Plik database.dump jest pusty."
    }

    # ====================================
    # 3. BACKUP DOKUMENTOW MEDIA
    # ====================================

    Write-Host "[3/4] Kopiowanie dokumentow media..."

    & docker compose @ComposeArgs exec -T backend `
        sh -c 'test -d /app/media'

    if ($LASTEXITCODE -ne 0) {
        throw "Brak katalogu /app/media w kontenerze backendu."
    }

    & docker cp `
        "${BackendContainerId}:/app/media" `
        $MediaDir

    if ($LASTEXITCODE -ne 0) {
        throw "Nie udalo sie skopiowac katalogu media."
    }

    $MediaFiles = @(
        Get-ChildItem `
            -LiteralPath $MediaDir `
            -Recurse `
            -File
    )

    # ====================================
    # 4. MANIFEST KOPII
    # ====================================

    Write-Host "[4/4] Zapisywanie manifestu..."

    $DatabaseHash = (
        Get-FileHash `
            -LiteralPath $DatabaseFile `
            -Algorithm SHA256
    ).Hash

    $Manifest = [ordered]@{
        application = "Flotivo"
        environment = $Environment
        created_utc = (Get-Date).ToUniversalTime().ToString("o")
        database_file = "database.dump"
        database_bytes = $DbInfo.Length
        database_sha256 = $DatabaseHash
        media_directory = "media"
        media_file_count = $MediaFiles.Count
    }

    $Manifest |
        ConvertTo-Json -Depth 4 |
        Set-Content `
            -LiteralPath $ManifestFile `
            -Encoding UTF8

    # Backup zostal zapisany
    Remove-Item -LiteralPath $IncompleteFile

    Write-Host ""
    Write-Host "======================================"
    Write-Host " BACKUP ZAKONCZONY POMYSLNIE"
    Write-Host "======================================"
    Write-Host "Folder: $BackupDir"
    Write-Host "Rozmiar bazy: $($DbInfo.Length) bajtow"
    Write-Host "Liczba plikow media: $($MediaFiles.Count)"
    Write-Host ""
}
finally {
    # Usuwamy zrzut tymczasowy z kontenera.
    if ($DbContainerId) {
        try {
            & docker compose @ComposeArgs exec -T db `
                sh -c 'rm -f "$1"' sh $TempDump | Out-Null
        }
        catch {
            Write-Warning "Nie udalo sie usunac pliku tymczasowego."
        }
    }

    Pop-Location
}
