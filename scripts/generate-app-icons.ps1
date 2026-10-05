param([string]$OutputRoot = (Join-Path $PSScriptRoot "..\public"))

Add-Type -AssemblyName System.Drawing

function New-RallyIcon([int]$Size, [string]$Path, [bool]$Maskable = $false) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#d9ed64"))

  $dark = [System.Drawing.ColorTranslator]::FromHtml("#172e29")
  $margin = if ($Maskable) { [int]($Size * 0.25) } else { [int]($Size * 0.19) }
  $diameter = $Size - (2 * $margin)
  $stroke = [Math]::Max(4, [int]($Size * 0.045))
  $pen = [System.Drawing.Pen]::new($dark, $stroke)
  $graphics.DrawEllipse($pen, $margin, $margin, $diameter, $diameter)

  $dotSize = [int]($Size * 0.12)
  $dotOffset = [int]($Size * 0.055)
  $brush = [System.Drawing.SolidBrush]::new($dark)
  $graphics.FillEllipse($brush, [int](($Size - $dotSize) / 2) + $dotOffset, [int](($Size - $dotSize) / 2) - $dotOffset, $dotSize, $dotSize)

  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-RallyIcon 180 (Join-Path $OutputRoot "apple-touch-icon.png")
New-RallyIcon 192 (Join-Path $OutputRoot "icons\rally-192.png")
New-RallyIcon 512 (Join-Path $OutputRoot "icons\rally-512.png")
New-RallyIcon 512 (Join-Path $OutputRoot "icons\rally-maskable-512.png") $true
