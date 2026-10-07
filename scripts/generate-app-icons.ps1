param([string]$OutputRoot = (Join-Path $PSScriptRoot "..\public"))

Add-Type -AssemblyName System.Drawing

function New-RallyIcon([int]$Size, [string]$Path) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#d9ed64"))

  # Matches the header mark: a Lucide "circle-dot" (24-unit grid, 2-unit stroke) at 63% of the icon.
  $dark = [System.Drawing.ColorTranslator]::FromHtml("#172e29")
  $box = $Size * 0.63
  $unit = $box / 24
  $origin = ($Size - $box) / 2
  $pen = [System.Drawing.Pen]::new($dark, [single](2 * $unit))
  $graphics.DrawEllipse($pen, [single]($origin + 2 * $unit), [single]($origin + 2 * $unit), [single](20 * $unit), [single](20 * $unit))
  $brush = [System.Drawing.SolidBrush]::new($dark)
  $graphics.FillEllipse($brush, [single]($origin + 10 * $unit), [single]($origin + 10 * $unit), [single](4 * $unit), [single](4 * $unit))

  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-RallyIcon 180 (Join-Path $OutputRoot "apple-touch-icon.png")
New-RallyIcon 192 (Join-Path $OutputRoot "icons\rally-192.png")
New-RallyIcon 512 (Join-Path $OutputRoot "icons\rally-512.png")
New-RallyIcon 512 (Join-Path $OutputRoot "icons\rally-maskable-512.png")
