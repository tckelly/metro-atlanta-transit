/**
 * Brand color tokens — single source of truth.
 *
 * Values are RGB triplets (no commas) so they can be plugged into CSS
 * variables that work with Tailwind's `<alpha-value>` substitution:
 *   --status-live: 22 163 74;
 *   bg-status-live/10  →  rgb(22 163 74 / 0.1)
 *
 * The Tailwind preset wires both the CSS variable declarations
 * (light → :root, dark → .dark) and the matching Tailwind color names.
 * Changing a value here updates every component automatically.
 *
 * See docs/ux-guidelines.md for the visual system rules.
 */

export const colors = {
  // Status semantics — never decorative
  'status-live':      { light: '22 163 74',   dark: '74 222 128' },
  'status-warn':      { light: '202 138 4',   dark: '250 204 21' },
  'status-cancelled': { light: '220 38 38',   dark: '248 113 113' },

  // Brand
  primary:            { light: '0 102 204',   dark: '96 165 250' },

  // Surfaces
  surface:            { light: '255 255 255', dark: '17 24 39' },
  'surface-elevated': { light: '249 250 251', dark: '31 41 55' },

  // Foreground (text)
  fg:                 { light: '17 24 39',    dark: '249 250 251' },
  'fg-muted':         { light: '107 114 128', dark: '156 163 175' },

  // Dividers / hairlines
  divider:            { light: '229 231 235', dark: '55 65 81' },

  // Rail line identity — MARTA's official GTFS route colors. Light = exact
  // (RED #CE242B, GOLD #D4A723, BLUE #0075B2, GREEN #009D4B); dark = hue-matched
  // lightened variants for legibility on the dark surface, following the
  // `primary` light→dark convention. Always paired with the line name in
  // LineIndicator, so they reinforce the label rather than being the sole signal.
  'line-red':         { light: '206 36 43',   dark: '242 109 109' },
  'line-gold':        { light: '212 167 35',  dark: '230 190 77' },
  'line-blue':        { light: '0 117 178',   dark: '79 169 219' },
  'line-green':       { light: '0 157 75',    dark: '53 199 126' },
} as const;

export type ColorToken = keyof typeof colors;
