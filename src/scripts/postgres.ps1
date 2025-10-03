# PowerShell script to run PostgreSQL in a container on Windows
param(
    [string]$ContainerName = $(if ($env:CONTAINER_NAME) { $env:CONTAINER_NAME } else { "my-postgres" }),
    [string]$PostgresUser = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }),
    [string]$PostgresPassword = $(if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }),
    [string]$PostgresDb = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "postgres" }),
    [int]$PostgresPort = $(if ($env:POSTGRES_PORT) { [int]$env:POSTGRES_PORT } else { 5432 }),
    [string]$PostgresImage = $(if ($env:POSTGRES_IMAGE) { $env:POSTGRES_IMAGE } else { "docker.io/library/postgres:15" })
)

# Auto-detect container runtime (podman or docker)
$ContainerCmd = $null
if (Get-Command podman -ErrorAction SilentlyContinue) {
    $ContainerCmd = "podman"
    Write-Host "Using Podman as container runtime" -ForegroundColor Green
}
elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    $ContainerCmd = "docker"
    Write-Host "Using Docker as container runtime" -ForegroundColor Green
}
else {
    Write-Host "Error: Neither podman nor docker is installed!" -ForegroundColor Red
    exit 1
}

# Function to handle cleanup on exit
function Cleanup {
    Write-Host "`nStopping container..." -ForegroundColor Yellow
    try {
        & $ContainerCmd stop $ContainerName *>$null
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
    $containerExists = & $ContainerCmd container exists $ContainerName 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Reusing existing container: $ContainerName" -ForegroundColor Cyan
        & $ContainerCmd start $ContainerName *>$null
    }
    else {
        Write-Host "Pulling image $PostgresImage..." -ForegroundColor Cyan
        & $ContainerCmd pull $PostgresImage
        
        Write-Host "Starting new Postgres container..." -ForegroundColor Cyan
        & $ContainerCmd run -d `
            --name $ContainerName `
            --env "POSTGRES_USER=$PostgresUser" `
            --env "POSTGRES_PASSWORD=$PostgresPassword" `
            --env "POSTGRES_DB=$PostgresDb" `
            -p "${PostgresPort}:5432" `
            $PostgresImage
        
        Write-Host "Waiting for Postgres to be ready..." -ForegroundColor Cyan
        do {
            Start-Sleep -Seconds 1
            $ready = & $ContainerCmd exec $ContainerName pg_isready -U $PostgresUser 2>$null
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