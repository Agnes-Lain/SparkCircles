#!/usr/bin/env bash
# Exports the Ripple brand SVGs (docs/design/brand/ripple/) to the PNGs Expo needs.
# Never edit the PNGs by hand: change docs/design/brand/_source/build_ripple.py,
# regenerate the SVGs, then run this script again from mobile/:
#
#   scripts/export-brand-assets.sh
#
# Needs rsvg-convert (brew install librsvg).
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="../docs/design/brand/ripple"
OUT="assets/brand"
mkdir -p "$OUT"

command -v rsvg-convert >/dev/null || { echo "rsvg-convert is missing: brew install librsvg" >&2; exit 1; }

# iOS / default app icon: 1024x1024, square, opaque (the system applies the mask).
rsvg-convert -w 1024 -h 1024 "$SRC/ripple-icon-1024.svg" -o "$OUT/icon.png"
# iOS tinted icon source (grayscale; the system applies the tint).
rsvg-convert -w 1024 -h 1024 "$SRC/ripple-icon-tinted-1024.svg" -o "$OUT/icon-ios-tinted.png"
# Android adaptive icon: foreground (ripple inside the 66 dp safe circle) and themed monochrome layer.
# The background layer is plain Ink, set as backgroundColor in app.config.ts.
rsvg-convert -w 1024 -h 1024 "$SRC/ripple-icon-foreground.svg" -o "$OUT/adaptive-icon-foreground.png"
rsvg-convert -w 1024 -h 1024 "$SRC/ripple-icon-mono.svg" -o "$OUT/adaptive-icon-monochrome.png"
# Splash: stacked lockup on Shell (PM decision M-14), transparent PNG, 1024 px wide.
rsvg-convert -w 1024 "$SRC/ripple-lockup-stacked.svg" -o "$OUT/splash-lockup.png"

# Welcome screen logo: horizontal lockup on light backgrounds, shown 40 px tall (section 19),
# exported at 3x for sharp rendering on every phone.
rsvg-convert -h 120 "$SRC/ripple-lockup-horizontal.svg" -o "$OUT/lockup-horizontal.png"

# The iOS master must be opaque: drop the alpha channel if the renderer added one.
if command -v magick >/dev/null; then
  magick "$OUT/icon.png" -background "#1A1A1A" -alpha remove -alpha off "$OUT/icon.png"
fi

ls -l "$OUT"
