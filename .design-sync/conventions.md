## Token system — "nenhuma tela escreve cor literal"

Every color is a CSS custom property, defined once per theme (`:root` for
light, `.dark` for dark) and exposed to Tailwind v4 via a `@theme inline`
block in `apps/web/src/app/globals.css`. Utility classes follow the token
name directly: `--primary` → `bg-primary` / `text-primary` / `border-primary`.
Never reach for a literal Tailwind color (`bg-amber-600`, `text-stone-400`) —
if a shade is missing, add a token (both themes, contrast re-measured), don't
escape to the raw palette. Core tokens: `--background`, `--foreground`,
`--card`, `--sidebar`, `--primary` (the one accent — every CTA, focus ring,
and active state), `--ember` (gradient/HP-bar companion to primary),
`--accent` (section labels), `--parchment` (highest-emphasis text: names,
values), `--muted-foreground`, `--destructive`, `--success`, `--border` /
`--input`, `--ring` / `--focus`. Full table with measured contrast ratios:
`docs/sdlc/02-design/design-system.md`.

## Provider wrap (required for every composition)

Most components read account/theme state from context. Real nesting order
(`apps/web/src/app/layout.tsx`) is `Providers` (outer: `SessionProvider` →
`AuthTokenBridge` → `LocaleProvider`) wrapping `ThemeProvider` (inner: a
`useEffect` that toggles the `.dark` class — no context of its own). Any
mockup composing these components needs the same wrap; without it,
`LocaleToggle`/`ThemeToggle`/`BrandName`/`AuthNav`/`HomeHero` render blank or
throw ("useSession must be wrapped in a SessionProvider").

## Helper functions — when to reach for them

- `cn(...)` — joins class strings, drops falsy values. No conflict
  resolution (no `clsx`/`tailwind-merge`): the system has no case where two
  conflicting utilities land on the same element, so don't add one.
- `dmButtonClass(variant?, extra?)` — the exact class string `DmButton`
  renders. Use it (never hand-roll button classes) when the element must be a
  `<Link>` or other non-`<button>` tag — `HomeHero`'s primary CTA is the
  reference example.
- `fieldClass(extra?)` — the one input/select/textarea class. Always paired
  with `FieldLabel` above the field (US-46: placeholder is never the only
  label) — never used alone.

## Primitives — composition rules

`Panel` is the **only** card unit — never nest a `Panel` inside a `Panel`;
group related content with `divide-y divide-border` or a plain border
instead (`BackgroundPanel`/`FeaturesPanel` inside a sheet tab; `HomeHero`'s
"see all characters" list). `SceneFrame` is a `<div>`, never `<main>` — the
page's single `<main>` landmark lives in the layout. `SheetHeading` only
ever appears inside a `Panel`. `SectionTitle` is one per screen.

## Fonts

Two families, both self-hosted via `next/font/google` in `layout.tsx` (never
a Google Fonts `<link>`): **Cinzel** (`--font-cinzel` → `font-serif`) for
titles, character names, and ficha values; **Geist** (`--font-geist` →
`font-sans`) for everything else. `font-serif` never appears in running body
text — titles, names, and numbers only. Numbers use `tabular-nums`.

**This bundle's synth-entry build doesn't ship next/font's generated files**
(the srcDir scope that avoids sweeping `next/font/google`'s build-time-only
internals — see NOTES.md — also means the app's actual woff2 files never get
attached). `--font-cinzel`/`--font-geist` are given plain fallback values
(`Georgia, serif` / `ui-sans-serif, system-ui, sans-serif`) in the compiled
CSS specifically so titles still render in a real serif instead of silently
falling back to the browser default (a bare `var(--font-cinzel)` with no
value and no explicit fallback invalidates the WHOLE `font-family` list at
computed-value time, not just that one alternative) — previews are close in
spirit, not the exact shipped typeface. Wire real Cinzel/Geist files via
`cfg.extraFonts` on a future sync to close this gap.
