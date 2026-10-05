$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backupRoot = Join-Path $projectRoot '.local-backups'
$snapshotId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$stagingRoot = Join-Path $backupRoot $snapshotId
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$manifest = @()
try {
  foreach ($copy in @('web', 'former-deployment')) {
    $sourceRoot = if ($copy -eq 'web') { $projectRoot } else { Join-Path $projectRoot '.sites-source' }
    if (!(Test-Path -LiteralPath $sourceRoot)) { continue }
    $files = @(git -C $sourceRoot ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw "Cannot inventory $sourceRoot" }
    foreach ($relative in ($files | Sort-Object -Unique)) {
      $name = $relative.Replace('\','/')
      if ($name -match '(^|/)(\.git|\.sites-source|\.local-backups|\.pnpm-store|\.chrome-mobile-cdp|\.sites-runtime|\.test-runtime|\.agents|\.codex|node_modules|dist|\.next|\.vinext|\.wrangler|outputs|work)(/|$)') { continue }
      if ($name -match '(^|/)(\.env[^/]*|\.dev\.vars[^/]*|tsconfig\.tsbuildinfo)$' -and $name -ne '.dev.vars.example') { continue }
      if ($name -match '\.(zip|pem|key|sqlite|sqlite3|db)$') { continue }
      $source = Join-Path $sourceRoot $relative
      if (!(Test-Path -LiteralPath $source -PathType Leaf)) { continue }
      $target = [IO.Path]::GetFullPath((Join-Path (Join-Path $stagingRoot $copy) $relative))
      if (!$target.StartsWith($stagingRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe archive path' }
      New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
      Copy-Item -LiteralPath $source -Destination $target
      $manifest += [pscustomobject]@{copy=$copy;path=$name;sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash}
    }
  }
  $manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $stagingRoot 'manifest.json') -Encoding UTF8
  $archive = Join-Path $backupRoot ($snapshotId + '.zip')
  [IO.Compression.ZipFile]::CreateFromDirectory($stagingRoot, $archive)
  Write-Output "Saved $($manifest.Count) source files: $archive"
  Write-Output 'Source-only backup. Secrets, databases, dependencies, and Git history are not included.'
} finally {
  $resolvedStage = [IO.Path]::GetFullPath($stagingRoot)
  $resolvedBackup = [IO.Path]::GetFullPath($backupRoot) + [IO.Path]::DirectorySeparatorChar
  if (!$resolvedStage.StartsWith($resolvedBackup, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing cleanup outside backup directory' }
  if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
