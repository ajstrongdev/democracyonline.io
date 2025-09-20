# PowerShell script to run PostgreSQL in a container on Windows
param(
    [string]$ContainerName = ($env:CONTAINER_NAME ?? "my-postgres"),
    [string]$PostgresUser = ($env:POSTGRES_USER ?? "postgres"),
    [string]$PostgresPassword = ($env:POSTGRES_PASSWORD ?? "postgres"),
    [string]$PostgresDb = ($env:POSTGRES_DB ?? "postgres"),
    [int]$PostgresPort = ($env:POSTGRES_PORT ?? 5432),
    [string]$PostgresImage = ($env:POSTGRES_IMAGE ?? "docker.io/library/postgres:15")
)

# Function to handle cleanup on exit
function Cleanup {
    Write-Host "`nStopping container..." -ForegroundColor Yellow
    try {
        & podman stop $ContainerName *>$null
    }
    catch {
        # Ignore errors when stopping
    }
}

# Register cleanup function for Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }

Write-Host "Container Name: $ContainerName" -ForegroundColor Green
Write-Host "Postgres User: $PostgresUser" -ForegroundColor Green
Write-Host "Postgres DB: $PostgresDb" -ForegroundColor Green
Write-Host "Postgres Port: $PostgresPort" -ForegroundColor Green

try {
    # Check if container already exists
    $containerExists = & podman container exists $ContainerName 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Reusing existing container: $ContainerName" -ForegroundColor Cyan
        & podman start $ContainerName
    }
    else {
        Write-Host "Pulling image $PostgresImage..." -ForegroundColor Cyan
        & podman pull $PostgresImage
        
        Write-Host "Starting new Postgres container..." -ForegroundColor Cyan
        & podman run -d `
            --name $ContainerName `
            --env "POSTGRES_USER=$PostgresUser" `
            --env "POSTGRES_PASSWORD=$PostgresPassword" `
            --env "POSTGRES_DB=$PostgresDb" `
            -p "${PostgresPort}:5432" `
            $PostgresImage
        
        Write-Host "Waiting for Postgres to be ready..." -ForegroundColor Cyan
        do {
            Start-Sleep -Seconds 1
            $ready = & podman exec $ContainerName pg_isready -U $PostgresUser 2>$null
        } while ($LASTEXITCODE -ne 0)
    }
    
    $dbUrl = "postgresql://${PostgresUser}:${PostgresPassword}@localhost:${PostgresPort}/${PostgresDb}"
    Write-Host "Database is ready!" -ForegroundColor Green
    Write-Host "Connection URL: $dbUrl" -ForegroundColor Yellow
    
    Write-Host "Press CTRL+C to stop the container..." -ForegroundColor Magenta
    
    # Keep script running until interrupted
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Cleanup
    exit 1
}
finally {
    Cleanup
}