# Copies every non-empty variable in .env.local to the linked Vercel project (Production).
# Run once after `vercel link`:  powershell -ExecutionPolicy Bypass -File scripts\vercel-env.ps1
# Values are read locally and sent only to Vercel; nothing is printed or written to git.
param(
  [string]$EnvFile = ".env.local",
  [string]$Target = "production"
)

if (-not (Test-Path $EnvFile)) { Write-Error "$EnvFile not found. Run this from the project folder."; exit 1 }

foreach ($raw in Get-Content $EnvFile) {
  $line = $raw.Trim()
  if (-not $line -or $line.StartsWith("#")) { continue }
  $i = $line.IndexOf("=")
  if ($i -lt 1) { continue }
  $name = $line.Substring(0, $i).Trim()
  $value = $line.Substring($i + 1).Trim().Trim('"')
  if (-not $value) { Write-Host "skip  $name (empty)"; continue }
  if ($name.StartsWith("VERCEL_")) { Write-Host "skip  $name (managed by Vercel)"; continue }
  # VITE_ variables are built into the public page, so Vercel needs them marked as config; the rest stay secret.
  $type = if ($name.StartsWith("VITE_")) { "config" } else { "secret" }
  Write-Host "add   $name ($type)"
  vercel env add $name --environment $Target --type $type --value $value --yes | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Warning "$name was not added (it may already exist: remove it with 'vercel env rm $name $Target' and run again)." }
}
Write-Host "Done. Check with: vercel env ls"
