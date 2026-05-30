# Icons

App icons for the PWA manifest, browser favicon, and Apple home-screen.

## Files

| File | Source | Purpose |
|---|---|---|
| `icon.svg` | hand-authored | Master vector — `<link rel="icon">`, manifest `purpose: any`, `apple-touch-icon` on iOS 26+ |
| `maskable-icon.svg` | hand-authored | Vector variant with 80% safe zone for Android adaptive masking |
| `icon-192.png` | rasterized from `icon.svg` | Manifest fallback for browsers that ignore SVG icons |
| `icon-512.png` | rasterized from `icon.svg` | Manifest fallback (high-density) |
| `apple-touch-icon-180.png` | rasterized from `icon.svg` | Home-screen icon for older iOS that ignores SVG `apple-touch-icon` |
| `maskable-icon-512.png` | rasterized from `maskable-icon.svg` | Maskable PNG fallback for older Android |

The SVGs are the sources of truth. The PNGs are committed to git so a normal `pnpm install` doesn't need any image toolchain — they're regenerated only when the SVGs change.

## Regenerating the PNGs

We deliberately avoid a build-time dependency (sharp, @squoosh, etc.) for files that change maybe once a year. On macOS, `qlmanage` (part of Quick Look, always installed) rasterizes SVG → PNG without any setup.

Run from this directory (`packages/web/public/icons/`):

```bash
qlmanage -t -s 192 -o . icon.svg          && mv icon.svg.png          icon-192.png
qlmanage -t -s 512 -o . icon.svg          && mv icon.svg.png          icon-512.png
qlmanage -t -s 180 -o . icon.svg          && mv icon.svg.png          apple-touch-icon-180.png
qlmanage -t -s 512 -o . maskable-icon.svg && mv maskable-icon.svg.png maskable-icon-512.png
```

Verify dimensions:

```bash
file *.png
# each line should report the expected NxN pixels at 8-bit RGBA
```

On Linux / CI the equivalent is `rsvg-convert` (`apt install librsvg2-bin`):

```bash
rsvg-convert -w 192 -h 192 icon.svg          -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg          -o icon-512.png
rsvg-convert -w 180 -h 180 icon.svg          -o apple-touch-icon-180.png
rsvg-convert -w 512 -h 512 maskable-icon.svg -o maskable-icon-512.png
```

## Where they're wired

- **Manifest** — `packages/web/vite.config.ts`, the `VitePWA({ manifest: { icons: [...] } })` array. SVG entries appear first so modern browsers stay on vector; PNGs are appended as raster fallbacks.
- **`apple-touch-icon`** — `packages/web/index.html`, points at `apple-touch-icon-180.png` because older iOS (pre-26) ignores SVG home-screen icons.
- **Service-worker precache** — `vite.config.ts` `includeAssets` lists each PNG so workbox includes them in the precache.

## Design notes (for when you regenerate from scratch)

- **Two colors only**: `#0066CC` (brand blue) and `#ffffff`. Matches `theme_color` in the manifest.
- **Regular `icon.svg`** has a `rx=96` rounded-square blue background — that's the iOS / desktop browser shape.
- **`maskable-icon.svg`** is full-bleed blue (no rounding) with the bus glyph scaled to 80% so it survives Android's adaptive masking (circle, squircle, rounded square). Spec: <https://www.w3.org/TR/appmanifest/#icon-masks>.
- If you redesign the icon, regenerate both SVGs first, then rerun the `qlmanage` block above.
