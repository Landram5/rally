param(
  [string]$ArchivePath = (Join-Path $PSScriptRoot "..\..\rally-mac-source.zip")
)

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ("rally-mac-source-" + [guid]::NewGuid().ToString("N"))
$stagingFull = [IO.Path]::GetFullPath($stagingRoot)
$tempFull = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
if (-not $stagingFull.StartsWith($tempFull, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to create a staging directory outside the system temporary directory."
}

$excludedPrefixes = @(
  ".chrome-mobile-cdp/", ".sites-runtime/", ".test-runtime/", ".codex/", ".agents/",
  "node_modules/", "dist/", ".next/", ".vinext/", ".wrangler/"
)
$excludedFiles = @(".dev.vars", ".env", ".env.local", "tsconfig.tsbuildinfo")

try {
  New-Item -ItemType Directory -Force -Path $stagingFull | Out-Null
  $files = git -C $projectRoot ls-files --cached --others --exclude-standard
  foreach ($relative in $files) {
    $normalized = $relative.Replace("\", "/")
    if ($excludedFiles -contains $normalized) { continue }
    if ($excludedPrefixes | Where-Object { $normalized.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }) { continue }
    $source = Join-Path $projectRoot $relative
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
    $destination = Join-Path $stagingFull $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
  }

  $archiveFull = [IO.Path]::GetFullPath($ArchivePath)
  if (Test-Path -LiteralPath $archiveFull) { Remove-Item -LiteralPath $archiveFull -Force }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory($stagingFull, $archiveFull, [IO.Compression.CompressionLevel]::Optimal, $false)
  Get-Item -LiteralPath $archiveFull | Select-Object FullName, Length, LastWriteTime
}
finally {
  if (Test-Path -LiteralPath $stagingFull) { Remove-Item -LiteralPath $stagingFull -Recurse -Force }
}
