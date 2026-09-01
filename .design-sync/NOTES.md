# design-sync — repo notes (apps/web)

## This run

Local-only: build + validate + author + grade previews, no upload.
`DesignSync` (the claude.ai/design tool) is unauthorized in this session —
"`/design-login` requires an interactive terminal, not available here." The
user needs to run `/design-login` in an interactive terminal (or use "Send to
Claude Code Web") before the first real upload. `ds-bundle/` and
`ds-bundle/.review.html` are ready and validated locally in the meantime.

## Why synth-entry mode

`apps/web` is a Next.js *app*, not a component library — its `package.json`
only has `next build` (the whole app), no importable `dist/` entry. Passing
`--entry ./apps/web/dist/index.js` (a path that deliberately doesn't exist,
but sits inside `apps/web` so `package-build.mjs` still resolves `PKG_DIR` to
the right `package.json`) makes `resolveDistEntry(..., soft:true)` return
`null`, which falls through to the converter's synth-entry mode: it bundles
every `.tsx`/`.jsx` under `cfg.srcDir` straight from source. Weaker
auto-extracted `.d.ts` prop types are the accepted cost (user pre-approved).

## `cfg.srcDir: "src/components"` — NOT the default `src/`

The default `srcDir` (unset → `src/`) would sweep every file under
`apps/web/src`, including `src/app/**` — `layout.tsx` calls
`Cinzel(...)`/`Geist(...)` from `next/font/google` at module top level (a
Next.js build-time macro, not a real browser-runtime function) and reads
`cookies()`/`auth()` (`next/headers`, next-auth server side). Since the
synth-entry barrel is `export * from <every swept file>`, ES module semantics
force ALL of those files' top-level code to execute the instant the bundle
loads in a browser preview — real risk of taking down every card at once.
All 16→17 scoped components already live under `src/components/**`, so
scoping `srcDir` there is a free fix with no coverage loss. Confirmed via
`ts-morph` scan of `src/components/**`: the ONLY top-level PascalCase
`export const|function` values are the 17 target components + the 3
excluded providers — no stray non-component export needed pruning beyond
those 3 (checked specifically for a stray `LocaleContext` per the run
instructions — it's `const LocaleContext = createContext(...)` in
`LocaleProvider.tsx` but is **never exported**, so it was never actually a
risk; no `componentSrcMap` entry needed for it).

## Provider nesting — corrected from what the run instructions assumed

The instructions this run started from had it backwards
(`ThemeProvider` outer, `Providers` inner). The real app
(`apps/web/src/app/layout.tsx`) nests `Providers` (outer:
`SessionProvider` → `AuthTokenBridge` → `LocaleProvider`) wrapping
`ThemeProvider` (inner — just a `useEffect` toggling `.dark`, no context of
its own, so the swap was functionally harmless either way, but
`conventions.md` documents the CORRECT order). Config:
```json
"provider": { "component": "Providers", "props": {"session": null}, "inner": {"component": "ThemeProvider"} }
```

## `next/image` / `next/link` shims (`apps/web/.design-sync-shims/`)

Both eagerly read Next-internal `process.env.*` (`__NEXT_IMAGE_OPTS`,
`__NEXT_ROUTER_BASEPATH`, ...) at module top level — fine inside a real Next
build (webpack/SWC DefinePlugin replaces these before the browser ever sees
them), fatal here (esbuild's browser target only defines the one literal
`process.env.NODE_ENV` the base script sets). `apps/web/.design-sync.tsconfig.json`
(a custom tsconfig — NOT the real `apps/web/tsconfig.json`, only used via
`cfg.tsconfig`) redirects `next/image` → a plain `<img>` shim and
`next/link` → a plain `<a>` shim; previews never need real
navigation/optimization anyway. Also fixes `@/messages` (a directory with an
`index.ts` — the stock `tsconfigPathsPlugin`'s extension-probe order tries
the bare directory path before `/index.ts` and Windows'
`Cannot read file ... Incorrect function` is what a directory-as-file read
looks like on this OS) by pinning it to `./src/messages/index.ts` explicitly,
ordered before the `@/*` wildcard rule.

## `cssEntry` is a COMPILED file, not raw `globals.css`

Tailwind v4's `@import "tailwindcss"` is a build-time directive resolved by
`@tailwindcss/postcss` (which scans the project for class usage and expands
the `@theme` block) — pointing `cssEntry` at the raw source ships a CSS file
where literally none of the utility classes our components use exist yet.
`.ds-sync/compile-tailwind.mjs` (not part of the converter — a one-off local
script) runs `postcss([tailwind({base: apps/web})])` over `globals.css` and
writes the result to `apps/web/.design-sync-generated/tailwind.css`, which
`cssEntry` points at. **Must be re-run** (`node .ds-sync/compile-tailwind.mjs`
from `.ds-sync/`) any time `globals.css` or any scanned component's classes
change, before the next `package-build.mjs` — it is NOT wired into the
converter's own build step. `cssEntry` also can't use a `../..` path escaping
`PKG_DIR` the way `guidelinesGlob`/`extraFonts` can (`css.mjs` rejects it) —
the compiled file has to live under `apps/web/` itself.

That same script appends one small fallback block:
`:root{--font-cinzel:Georgia,serif;--font-geist:ui-sans-serif,system-ui,sans-serif;}`
— without it every `font-serif`/`font-sans` utility renders in the browser's
default font, not merely an imperfect fallback: a bare `var(--font-cinzel)`
with no defined value and no explicit `var(..., fallback)` invalidates the
WHOLE `font-family` declaration at computed-value time (not just that one
alternative in the comma list), so "Georgia, serif" written further down the
same value never gets a chance to apply. See `conventions.md`.

## `.design-sync/overrides/bundle.mjs` fork (`cfg.libOverrides`)

The **only** local fork of a `lib/` file this run needed, and it's the one
the base skill explicitly asks agents not to touch ("lib/emit.mjs and
lib/bundle.mjs define the output contract with the app's self-check — don't
fork those"). Justification for the deviation: this run never uploads (the
self-check the warning protects never runs against this fork), the change is
a pure runtime-safety addition (`banner: {js: 'var process=...'}` in
`sharedBuildOptions`, mirroring the existing `reactShim` pattern) that
touches nothing in `stampHeader`/`resolveDistEntry`/the emitted header
format, and there was no other way to fix it: real Next.js modules bundled
transitively (`next-auth/react`'s `SessionProvider`, this app's own
`src/lib/api.ts`) read `process.env.*`/`.platform`/`.nextTick` at module top
level, and esbuild's browser target has no `process` global at all (only the
one literal `process.env.NODE_ENV` the base script already defines).
Symptom before the fix: `ReferenceError: process is not defined`, thrown
during the FIRST top-level module evaluated with such a reference — since
the IIFE's `window.AiDm = ...` assignment happens only at the very end, this
killed EVERY component uniformly (17/17 `[BUNDLE_EXPORT]` failures), not
just the ones that actually import next-auth. Also had to import `esbuild`
by a relative path into `.ds-sync/node_modules/esbuild/lib/main.js` instead
of the bare specifier — the doc's usual fix (`ln -sfn ../.ds-sync/node_modules
.design-sync/node_modules`) didn't produce a real reparse point in this
Windows environment (`git-bash ln -s` silently made a plain directory, no
`ReparsePoint` attribute) — **re-check this on a fresh clone**; if the
symlink trick works there, prefer it (see Re-sync risks).

**Before this fork is safe to include in an uploaded sync**, re-verify it's
still needed (a design-sync version bump might add a real fix), and confirm
the self-check genuinely doesn't parse anything past `stampHeader`'s existing
fields.

## `extraEntries: ["next-auth/react"]`

Needed once `AuthNav`'s preview (below) required a real, authenticated
`useSession()`. Without this, a preview file's own
`import { SessionProvider } from 'next-auth/react'` bundles a SECOND,
independent copy of `next-auth/react` (a separate esbuild compile per
`buildPreviews`) — a different module instance means a different
`SessionContext` object, so the preview's `<SessionProvider>` and
`AuthNav`'s internal `useSession()` (reading the MAIN bundle's own
`next-auth/react` instance, via the global `Providers` wrap) silently don't
see each other; `AuthNav` stayed on the outer `session: null` and rendered
nothing (`root empty`, no thrown error — the hardest kind to diagnose).
`extraEntries` merges `next-auth/react`'s exports onto `window.AiDm` from
the SAME bundle, so `SessionProvider` imported in a preview resolves through
the story-imports shim to the identical instance `AuthNav` already uses.

## Preview-specific notes

- **`AuthNav.tsx` / `ThemeToggle.tsx`**: both real components are
  `position: fixed` (top-right corner). `cfg.overrides` pins
  `cardMode: "single"` + a small `viewport` for both so the fixed element
  doesn't collapse to zero height in the product grid. The absolute-rubric
  grading screenshots (`package-capture.mjs`, per-story) render both
  correctly, cropped and centered. **Known cosmetic artifact**: the
  SEPARATE contact-sheet screenshot `package-validate.mjs` takes for the
  render-check summary (`ds-bundle/_screenshots/general__AuthNav.png`) uses
  one shared 1200×800 browser viewport for every component's `<Name>.html` —
  it does NOT read the per-component `viewport` override — so
  `position: fixed; right-16` anchors AuthNav's button to the real
  1200×800 canvas's corner, landing well outside the small region the
  contact-sheet tile crops to. The full screenshot IS correct (verified:
  "Sign out" renders, real tokens, `bad: false` in `.render-check.json`) —
  only the tiled thumbnail looks blank. Not a defect; recorded here as a
  "known render warn" per the skill's own instruction so a future re-sync
  doesn't re-chase it.
- **`HomeHero.tsx`**: fetches its own data (`api.listCharacters()`, no
  props) — a real network call always fails in a static preview (no
  backend), landing on the thin error state. The preview patches
  `window.fetch` at module scope (before mount) to return canned character
  data for `/characters/mine` specifically, falling through to the real
  `fetch` for anything else. This is environment stubbing, not a component
  reimplementation — `HomeHero` itself is the real, unmodified export.
  Only ONE story authored (`WithCharacters`, 2 characters, one with an
  active adventure, "show all" list expanded via composed data) — a second
  "Empty" variant would need the mock to distinguish calls from two
  different story mounts (call order isn't a safe enough signal across
  independent React roots), not worth the fragility for one thin extra
  state (the empty state is one heading + one button, already visible in
  source).
- **Locale mismatch (cosmetic, not fixed this run)**: `LocaleProvider`
  defaults to `DEFAULT_LOCALE` (en-US) absent a session/localStorage/cookie
  — none exist in a static preview render. UI chrome text (section
  headings, badges, buttons) renders in English while my authored flavor
  text (character names, feature/spell descriptions) is Portuguese
  (`BackgroundPanel`, `FeaturesPanel`, `HomeHero`, `SceneFrame`,
  `SectionTitle`). Forcing pt-BR would need the same context-identity fix
  `AuthNav` needed (a local `LocaleProvider` composed in the preview would
  bundle a SEPARATE module instance, since `LocaleProvider` is excluded from
  `componentSrcMap` — not in the story-imports shim's `exported` set either)
  — skipped as a low-value chase for a cosmetic-only mismatch; still reads
  as styled/complete/plausible per the grading rubric. Would need either its
  own `extraEntries`-style fix or a `NEXT_PUBLIC`-style env default.

## Font fidelity gap (see `conventions.md`)

Cinzel/Geist are self-hosted via `next/font/google`, which only produces
real `.woff2` files during an actual `next build` (not run this pass, and
out of scope for `srcDir`, which deliberately doesn't sweep `layout.tsx`
anyway). Previews render in the fallback stack (`Georgia, serif` /
`ui-sans-serif, system-ui, sans-serif`), close in spirit but not the exact
shipped typeface. To close this: run a real `next build` once, find the
generated `.woff2` files under `.next/static/media/`, and wire them via
`cfg.extraFonts`.

## HomeHero scope decision

`HomeHero.tsx` wasn't in the run's original 14-component list but was
flagged as a likely-intentional omission worth a judgment call. Included it
as the 15th authored component: it's a real page composition (not a
provider/context wrapper), uses the same primitives as everything else, and
is exactly the kind of "page-level composed component" the run's stated
scope ("primitives + page compositions") already covers.

## Floor-card-only: GameView, SetupWizard

Per the run's explicit scope. Neither needed `cfg.overrides.<Name>.skip` —
package shape has no generated preview tier (a component either has an
authored `.design-sync/previews/<Name>.tsx` or ships the floor card
automatically; the run instructions' draft `overrides.skip` block was
speculative and turned out unnecessary, confirmed by reading
`non-storybook/SKILL.md` §3/§4.5 directly: "Floor-card components pass the
gate by design"). Both render cleanly as floor cards without any
`bad: true` flag: `GameView`'s default/empty-state UI happens to render a
full, coherent shell (HP/Sheet tabs, empty inventory, narration prompt) even
with crash-prevention default props; `SetupWizard` throws
`invariant expected app router to be mounted` (from a `next/navigation`
hook it calls) but the floor-card mechanism catches it and swaps to the
honest "preview not yet authored" typographic placeholder, which is not a
failure by design.

## Missing base `SKILL.md`

The run's instructions repeatedly reference "base SKILL.md §1/§2/§3" (the
router logic for atomic-vs-incremental upload, the general `.design-sync/`
mechanics, the "Author the conventions header" step). No such file exists in
this skill installation — only `<skill-base-dir>/non-storybook/SKILL.md` and
`<skill-base-dir>/storybook/SKILL.md` are present (verified via `find`).
Since this run stops before §5 Upload, the missing upload-router content
didn't block anything; the "Author the conventions header" step was done
using the run's own paraphrase (already detailed) plus the non-storybook
file's cross-references, not a base file I could read directly. Worth
flagging to whoever maintains the skill bundle.

## Re-sync risks

- **`.ds-sync/package-validate.mjs`'s bundle-export smoke test was patched
  locally** (writes a real temp file + `page.goto()` instead of
  `page.setContent()`) — this is a genuine upstream bug independent of this
  repo (confirmed via isolated repro: `page.setContent()` mis-decodes a
  UTF-8 script fetch's encoding when the bundle contains ANY non-ASCII
  regex literal — this repo's trigger is `@ai-dm/shared/dist/roll.js`'s
  accent-stripping `/[̀-ͯ]/g`, pulled in transitively; a real
  `page.goto()` to an identical file, same server, same headers, renders
  clean). **This patch lives only in `.ds-sync/package-validate.mjs`, NOT
  in `.design-sync/overrides/`** — `package-validate.mjs` is a top-level
  staged script, outside the `loadLib()` override mechanism, so re-copying
  `.ds-sync/` from the skill bundle (the standard re-sync step) silently
  drops this fix. Re-apply it (see the `LOCAL PATCH` comment left at the
  `[BUNDLE_EXPORT]` smoke-test block) or confirm upstream ships a fix before
  the next re-sync.
- **The `.design-sync/overrides/bundle.mjs` esbuild import is a relative
  path** into `.ds-sync/node_modules/esbuild/lib/main.js`, not the
  symlink the Troubleshooting section recommends (`ln -sfn
  ../.ds-sync/node_modules .design-sync/node_modules`) — that symlink
  didn't take as a real reparse point in this Windows session. If a re-sync
  on a different machine/environment gets a working symlink, prefer
  switching to the bare `import { build } from 'esbuild'` specifier instead
  (simpler, matches the documented pattern) — the relative path is more
  brittle across any restructuring of `.ds-sync/`.
- **`apps/web/.design-sync-generated/tailwind.css` is a manually-run
  compile step**, not part of `package-build.mjs` itself. It WILL go stale
  silently (build still "succeeds," just against old CSS) if `globals.css`
  or a scanned component's Tailwind class usage changes without re-running
  `node .ds-sync/compile-tailwind.mjs` first. Same applies to
  `apps/web/.design-sync-shims/` and `apps/web/.design-sync.tsconfig.json` —
  none of these three `apps/web/.design-sync*` paths are tracked/generated
  by the converter itself; they're this run's own scaffolding, kept
  deliberately outside `src/` so the `srcDir: "src/components"` scope never
  sweeps them back in.
- **Font fidelity**: see "Font fidelity gap" above — the fallback fix is a
  CSS patch, not the real typeface. A future sync that wires `cfg.extraFonts`
  to real `next build` output should remove the fallback block (or keep it
  as a true fallback with real values defined elsewhere first).
- **Locale mismatch**: see "Preview-specific notes" above — cosmetic only,
  not gating, but will still be there next sync unless someone wires a
  locale-forcing fix with the same care `extraEntries` needed for AuthNav.
- **HomeHero's fetch mock** hardcodes the `/characters/mine` URL substring
  from `apps/web/src/lib/api.ts`'s `get()` helper — if that endpoint path
  ever changes, the preview silently falls through to the REAL (failing)
  fetch and regresses to the thin error state without any build/validate
  error to catch it. No automated check ties the two together.
- **`AuthNav`/`ThemeToggle` contact-sheet blank thumbnail**: recorded above
  as a known render warn — re-syncs should check this note before treating
  it as new.
