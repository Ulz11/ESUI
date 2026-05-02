<#
.SYNOPSIS
  Provision a fresh ESUI database against an existing local PostgreSQL.

.DESCRIPTION
  Creates the `esui` role and `esui` database, then enables the `pgvector`
  extension. Idempotent — safe to re-run.

  Asks once for the `postgres` superuser password.

.PARAMETER Port
  TCP port your Postgres listens on. Defaults to 5432; pass 5433 if a
  prior install grabbed the default.

.PARAMETER PsqlPath
  Optional explicit path to psql.exe. The script auto-discovers
  PostgreSQL 13–18 under "C:\Program Files\PostgreSQL\*\bin\psql.exe".

.EXAMPLE
  .\setup-postgres.ps1

.EXAMPLE
  .\setup-postgres.ps1 -Port 5433
#>

[CmdletBinding()]
param(
  [int]$Port = 5432,
  [string]$PsqlPath
)

$ErrorActionPreference = "Stop"

# ── Locate psql ─────────────────────────────────────────────────────────────
function Find-Psql {
  if ($PsqlPath -and (Test-Path $PsqlPath)) { return $PsqlPath }
  $cmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending
  if ($candidates) { return $candidates[0].FullName }
  throw "Could not find psql.exe. Pass -PsqlPath explicitly or add it to PATH."
}

$psql = Find-Psql
Write-Host "Using psql: $psql" -ForegroundColor DarkGray
Write-Host "Connecting to localhost:$Port as postgres" -ForegroundColor DarkGray

# ── Get the postgres password once ──────────────────────────────────────────
$secure = Read-Host "Postgres superuser password (input hidden)" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$pgpass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) | Out-Null

$env:PGPASSWORD = $pgpass

function Run-Sql {
  param([string]$Db, [string]$Sql)
  & $psql -U postgres -h localhost -p $Port -d $Db -v ON_ERROR_STOP=1 -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "psql failed for: $Sql" }
}

try {
  # ── Role ────────────────────────────────────────────────────────────────
  Write-Host "→ Ensuring role 'esui' exists..."
  Run-Sql -Db "postgres" -Sql @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'esui') THEN
    CREATE ROLE esui WITH LOGIN PASSWORD 'esui';
  END IF;
END
`$`$;
"@

  # ── Database ────────────────────────────────────────────────────────────
  Write-Host "→ Ensuring database 'esui' exists..."
  $dbExists = & $psql -U postgres -h localhost -p $Port -d "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='esui'"
  if ($LASTEXITCODE -ne 0) { throw "psql failed when checking database existence" }
  if ($dbExists.Trim() -ne "1") {
    Run-Sql -Db "postgres" -Sql "CREATE DATABASE esui OWNER esui;"
  } else {
    Write-Host "  (already exists)" -ForegroundColor DarkGray
  }

  # ── pgvector ────────────────────────────────────────────────────────────
  Write-Host "→ Enabling pgvector inside esui..."
  Run-Sql -Db "esui" -Sql "CREATE EXTENSION IF NOT EXISTS vector;"

  # ── Sanity check the connection from the new role ───────────────────────
  Write-Host "→ Verifying esui can log in..."
  $env:PGPASSWORD = "esui"
  & $psql -U esui -h localhost -p $Port -d "esui" -v ON_ERROR_STOP=1 -c "SELECT 'connected as ' || current_user;" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "esui role exists but cannot log in. Check pg_hba.conf for scram-sha-256 entries on localhost." }

  Write-Host ""
  Write-Host "✓ Postgres ready." -ForegroundColor Green
  Write-Host "  DATABASE_URL=postgresql+asyncpg://esui:esui@localhost:$Port/esui"
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
