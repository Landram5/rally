# Matching tab and Home Screen icons to the header logo

Not yet deployed. Branch `claude/match-header-logo`.

- The browser tab icon (`public/favicon.svg`), `apple-touch-icon.png`, and the 192/512/maskable PNGs now use the same mark as the site header: a dark (`#172e29`) circle-and-dot on lime (`#d9ed64`). The tab icon is a rounded tile like the header; the Home Screen PNGs are full-bleed so iOS/Android apply their own rounding.
- `scripts/generate-app-icons.ps1` draws the same mark so regenerating icons keeps them in sync.
- Unchanged: the header (Lucide `CircleDot` in `.brand-mark`), `rally-share-v2.png` and the manifest.

Validation: rendered all icons from the same geometry and compared them to the header in a browser at tab, Home Screen and maskable sizes. The PowerShell script was edited but not run in this environment. Deploying is up to the owner; existing Home Screen installs keep the old icon until removed and re-added, and browsers may cache the old tab icon for a while.
