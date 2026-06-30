# Themes in `@fileverse-dev/dsheet` — Design / Product Spec

> How theming is defined, delivered, and switched inside the dsheet package so it drops into
> `ddocs.new`'s existing theme runtime the same way `@fileverse-dev/ddoc` does. Companion to
> `fileverse-ddoc/docs/THEMES.md` (the cross-repo reference) — read that first for the token
> system, the five themes, and the `<html>`-class switch mechanism.

**Status:** Design approved (re-scoped). Pending spec review.
**Scope of this doc:** themes *inside dsheet only*. Wiring dsheet into the ddocs.new app is a
later spec, but every decision here is made so that integration is a no-op (chrome) or a prop
pass (Phase 2 grid), not a rewrite.

---

## 0. Two phases (read this first)

dsheet has **two rendering worlds**:

| World | What | Themed by | Phase |
|---|---|---|---|
| **Chrome** | toolbar wrapper, sidebars, comments, dialogs, chips — everything in `src/editor/**` (dsheet-level React) | CSS cascade off the `<html>` class via `@fileverse/ui` `.color-*` utilities | **Phase 1 — this spec, active** |
| **Grid** | the Luckysheet/Fortune canvas + fortune-react components in `src/sheet-engine/**` | JS color resolution (canvas can't read CSS vars) + a `theme` prop + redraw | **Phase 2 — deferred, §7** |

**Phase 1 touches only dsheet-level code (`src/editor/**` + `src/editor/styles/index.css`). It does
NOT modify fortune-core or fortune-react component code in `src/sheet-engine/**`.** The single
exception is dsheet-*authored* CSS overrides in `index.css` that target fortune DOM classes (e.g.
the inline-comment popup) — those are dsheet's own stylesheet, in scope (§4.3).

This doc was originally written grid-first; it has been re-scoped so Phase 1 is the
chrome-only work and the grid work is preserved verbatim as deferred Phase 2.

---

## 1. TL;DR (Phase 1)

- **Chrome themes by pure CSS cascade.** A theme is a class on `<html>` (`light` / `dark` /
  `theme-sepia` / `theme-pink` / `theme-green`). `@fileverse/ui` ships token blocks for each and
  `.color-*` utilities that read them. Any markup painted with `.color-*` repaints automatically
  when the class changes — no re-render, no prop.
- **The work is gap-filling.** 56 spots in `src/editor/**` already use `.color-*`. ~75 spots still
  hardcode colors (`bg-white`, `text-black`, `text-gray-600`, `bg-[#363B3F]`, `bg-[#F8F9FA]`, …)
  or use ad-hoc `dark:` Tailwind variants (only 3). Those break in non-light themes. Phase 1
  converts them to `.color-*`.
- **No `theme` prop, no provider in the package.** Chrome needs only the `<html>` class, which the
  host sets. Demo already wraps in `@fileverse/ui` `ThemeProvider` (`demo/src/main.tsx`); ddocs.new
  already sets the class. Nothing to thread.
- **Five themes, full parity with ddoc**: `light`, `dark`, `theme-sepia`, `theme-pink` (Keith),
  `theme-green` (Naomiii). Because `.color-*` reads whichever token block is live, all five work
  the moment the hardcoded colors are gone — no per-theme chrome code.

---

## 2. Decisions (locked)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Theme scope | **All 5** | Parity so a doc and a sheet look consistent in any ddocs.new theme. For chrome this is free once colors are semantic. |
| 2 | Phase 1 surface | **dsheet chrome only** (`src/editor/**` + dsheet-authored `index.css`) | User directive: do not touch fortune-core / fortune-react UI. |
| 3 | How chrome learns the theme | **CSS cascade off `<html>` class** (no prop) | Chrome is DOM/CSS; `.color-*` repaints on class change. Matches ddoc chrome (THEMES.md §6.1). |
| 4 | Hardcoded color fix | **Convert to `.color-*` semantic utilities** | The `@fileverse/ui` contract; what the 56 existing uses already do. |
| 5 | Ad-hoc `dark:` variants | **Replace with `.color-*`** | `dark:` only triggers on `.dark`; it ignores sepia/pink/green. `.color-*` covers all five. |
| 6 | `#efc703` selection accent | **Constant across all themes** | dsheet brand; readable on every background. |
| 7 | Export/data color code | **Out of scope, stays literal** | `xlsx-*` ARGB, `csv-import` hyperlink `rgb(0,0,255)`, `formula-ui-sync` `STATIC_LINE_BG` are file/data values, not UI. |
| 8 | `theme` prop / grid palette | **Deferred to Phase 2** | Canvas-only concern (§7). |
| 9 | Provider/toggle ownership | **Consume only, no fork** | Avoids the multi-place duplication THEMES.md §9 flags. Demo uses ui's provider; ddocs.new uses its own. |

---

## 3. The five themes

`<html>` class values and ui labels (must match ddoc — THEMES.md §2):

| Class | Label |
|---|---|
| `light`       | Light |
| `dark`        | Dark |
| `theme-sepia` | Sepia |
| `theme-pink`  | Keith |
| `theme-green` | Naomiii |

Phase 1 writes no theme list in code (chrome reads tokens, not a list), so there is nothing here
to keep in sync — the duplication risk THEMES.md §9 calls out does not apply to Phase 1.

---

## 4. Phase 1 work

### 4.1 Convert hardcoded colors in `src/editor/**` → `.color-*`
Map raw classes to the nearest semantic utility. Reference mapping (extend per case):

| Hardcoded | Semantic replacement |
|---|---|
| `bg-white` | `color-bg-default` |
| `bg-[#F8F9FA]`, `bg-gray-50/100` (surfaces) | `color-bg-secondary` (or `-default` per context) |
| `text-black`, `text-[#363B3F]` | `color-text-default` |
| `text-gray-600/500` | `color-text-secondary` / `color-text-disabled` |
| `text-[#FB3449]`, `text-[#FB...]` (danger) | `color-text-danger` |
| `border-white`, `border-[#E8EBEC]`, `border-gray-200` | `color-border-default` |
| `bg-[#000] !text-[#fff]` (selected pill) | `color-bg-default-inverse` / `color-text-inverse` |
| `dark:bg-gray-800` etc. (the 3 `dark:` variants) | drop the `dark:` variant, use `.color-*` base |

Known files with hardcoded colors (non-exhaustive; the implementation plan enumerates all):
`components/skeleton-loader.tsx`, `collab-status-chip.tsx`, `import-button-ui.tsx`,
`permission-chip.tsx`, `components/comments/*` (`comment-cell-popup`, `comment-item`,
`comment-input`, `comment-actions-dropdown`), `components/sidebars/*` (`templates`, `template-ui`,
`function/function-metadata`), `components/sidebar/right-sidebar.tsx`,
`utils/custom-toolbar-item.tsx`.

**Brand-color exceptions that stay literal** (intentional accent, not theme-driven):
`custom-toolbar-item.tsx` fetch-url `#1977E4*` and template `#CF1C82*` button accents — confirm
per-case during implementation; default is to keep documented brand accents literal but ensure
their text/contrast still works on dark backgrounds.

### 4.2 No-prop wiring
Nothing to thread. Confirm `src/editor/styles/index.css:2` keeps `@import '@fileverse/ui/styles'`
(it does) so the token blocks ship. Chrome repaints on `<html>` class change with zero JS.

### 4.3 `index.css` fortune-DOM overrides (dsheet-authored, in scope)
Convert hardcoded colors in dsheet's own `src/editor/styles/index.css` overrides to
`hsl(var(--color-*))` so they follow the theme:

| Selector | Today | Action |
|---|---|---|
| `.luckysheet-postil-show-main` (inline-comment popup) | `background-color: white`, `border: 1px solid #e8ebec` | → `hsl(var(--color-bg-default))`, `hsl(var(--color-border-default))` |
| `.fortune-tooltip` | `background: black` | → tooltip token (`hsl(var(--color-bg-tooltip))`) |
| `.fetch-url-button` | `color: #1977e4` | brand accent — keep or token per design |
| `.template-button:hover` | `#cf1c821f` | brand accent — keep |
| `.luckysheet-cs-fillhandle`, `.fortune-cell-selected-*`, `.luckysheet-input-box-inner` (`#efc703`) | selection accent | **keep constant** |

This is dsheet's stylesheet, not fortune-react component code, so it does not violate the
"don't touch fortune-react UI" rule. It does NOT include the canvas-painted grid colors (those
are JS in `canvas.ts` → Phase 2).

### 4.4 Verification
- Render `@fileverse/ui` `ThemeToggle` in the **demo navbar**, the same way ddoc's demo does
  (`fileverse-ddoc` `demo/src/App.tsx:469`). dsheet's demo already has the prerequisites: a
  `ThemeProvider` wrap (`demo/src/main.tsx`) and a `renderNavbar` callback
  (`demo/src/App.tsx:285`) — drop `<ThemeToggle />` into `renderNavbar` (near the more-actions
  buttons, ~L331). Demo app only; nothing added to the package. Cycle all five themes.
- Visually confirm in each theme: sidebars (data-verification, conditional-format, functions,
  templates), comment popup + sidebar, permission chip, collab chip, skeleton loader,
  import/export menus, dialogs. No white-on-white, no black-on-black, no stuck light surfaces.
- Confirm the grid canvas is visibly *unthemed* (still light) — expected; that's Phase 2.

---

## 5. What follows the theme vs what stays literal (Phase 1)

| Element | Behavior |
|---|---|
| Chrome surfaces/text/borders/icons (`src/editor/**`) | follow `<html>` class via `.color-*` |
| Inline-comment popup, tooltip (`index.css`) | follow theme via `hsl(var(--color-*))` |
| `#efc703` selection accent | constant, all themes |
| Documented brand accents (`#1977E4`, `#CF1C82`) | literal (per-case contrast check) |
| Export/data colors (`xlsx-*`, csv hyperlink, formula static bg) | literal — file data, not UI |
| **Grid canvas** (cell bg, gridlines, headers, cell text) | **unthemed in Phase 1** → Phase 2 |

---

## 6. Delivery chain (Phase 1)

```
@fileverse/ui  dist/index.css  (token blocks + .color-*)
      ▼  (already imported)
@fileverse-dev/dsheet
   src/editor/styles/index.css : @import '@fileverse/ui/styles'
   src/editor/** : .color-* utilities (gap-filled)         → chrome themed
      ▼
host (demo today, ddocs.new later)
   <html class> set by provider  → chrome repaints via CSS cascade. Zero dsheet wiring.
```

Integration contract for ddocs.new (Phase 1): **none.** Importing `@fileverse-dev/dsheet/styles`
and rendering `<Dsheet>` under the app's existing `<html>`-class provider is enough for chrome to
theme. (Phase 2 adds a `theme` prop for the grid — §7/§8.)

---

## 7. Phase 2 — sheet-engine grid palette (DEFERRED, design preserved)

> Not implemented now. Captured so the plan is not lost. Touches `src/sheet-engine/**`
> (fortune-core/react), which Phase 1 deliberately avoids.

**Problem:** the grid is painted to canvas by `src/sheet-engine/core/canvas.ts` with hardcoded
hex. Canvas cannot read CSS variables, so chrome theming does not reach it. This is dsheet's
analogue of ddoc's JS-driven "document styling" path (THEMES.md §6.2), and ddoc feeds that path an
explicit `theme: ThemeKey` prop threaded through React context. Phase 2 mirrors that.

**Design (recommended approach: static palette map):**

1. **`ThemeKey` + `GRID_THEMES` palette map** — new module in the engine layer
   (`src/sheet-engine/core/theme.ts`). `ThemeKey` copied verbatim from
   `fileverse-ddoc/package/types.ts:95`:
   ```ts
   export type ThemeKey = 'light' | 'dark' | 'theme-sepia' | 'theme-pink' | 'theme-green';
   ```
   `GRID_THEMES: Record<ThemeKey, GridPalette>` with one slot per grid-chrome color role found in
   `canvas.ts`: `cellBg`, `gridLine`, `cellText`, `headerBg`, `headerText`, `secondaryFill`.
   `light` is seeded with the EXACT current hex (regression guard). The four non-light palettes
   are a design deliverable (start from each theme's surface swatch; tune with design). A
   module-level `activePalette` + `setActiveGridPalette(theme)` lets the imperative canvas read
   colors live without prop threading inside the engine.
   `SELECTION_ACCENT = '#EFC703'` stays a constant, not a palette slot.

2. **`theme` prop on `DsheetProps`** — `theme?: ThemeKey` (default `'light'`), threaded
   `Dsheet → editor-context → EditorWorkbook → Workbook → engine`, the same shape as ddoc's
   `editor-context.tsx` → `ddoc-editor.tsx`.

3. **canvas.ts reads the palette** — replace hardcoded literals (catalogued below) with
   `activePalette.*`. `defaultStyle`'s color fields (`fillStyle`/`strokeStyle`, dead `rowFillStyle`)
   become palette-derived at use sites.

4. **Re-render on theme change** — preferred: a targeted engine grid-redraw if cleanly exposed;
   fallback: bump the existing `forceSheetRender` value feeding `workbookKey`
   (`editor-workbook.tsx:316`) to remount.

5. **User-authored cell colors stay literal in every theme** — only defaults + grid chrome follow
   the theme. dsheet intentionally does NOT port ddoc's `getResponsiveColor` inversion; spreadsheet
   fills/text are deliberate data-viz.

**Grid color literals to replace (verified in `canvas.ts`):**

| Hex (today) | Role → slot |
|---|---|
| `defaultStyle.fillStyle = '#000000'` (L20; used L168/357/671), `'#000000'` L1708 | default cell/text → `cellText` |
| `defaultStyle.strokeStyle = '#e8ebec'` (L22; used L262/458/473/1842/1862/2516/2534) | gridlines → `gridLine` |
| `'#F8F9FA'` (L224, L415) | header bg → `headerBg` |
| `'#000000'` header text (L231, L422) | → `headerText` |
| `'#ffffff'`/`'#FFFFFF'` (L663, L1673, L1954) | unset cell bg / canvas clear → `cellBg` |
| `'rgba(232, 235, 236, 1)'` (L1777, L2042) | on-canvas chip fill → `secondaryFill` |
| `'#EFC703'` (L1748, L2099, L2113) | selection accent → `SELECTION_ACCENT` (constant) |

**Stay literal in Phase 2 too** (feature/semantic, not grid chrome): error red `#ff0000`
(L2304/2321/2487), forced-string green `#487f1e` (L2127), chevron/checkbox glyph fills
(`rgba(0,0,0,*)`, `#000`/`#fff` L2222/2244/2251), pivot-table placeholder block (L1090–1119),
conditional-format `cellColor` (author data).

**Phase 2 integration contract (ddocs.new):** `<Dsheet theme={theme} />` where `theme` comes from
the app's existing `useTheme()` — identical to its `<DdocEditor theme={theme} />` call.

---

## 8. Risks & observations

- **Phase 1 leaves a visible seam:** themed chrome around a light grid until Phase 2 ships. This is
  intentional and acceptable for incremental delivery; call it out to stakeholders.
- **Brand-accent contrast:** `#1977E4` / `#CF1C82` accents kept literal must still be legible on
  dark/green backgrounds. Per-case check during implementation; adjust only if a real contrast
  failure appears.
- **`.color-*` coverage gaps:** if a needed semantic token doesn't exist in `@fileverse/ui`
  (e.g. no exact match for a surface), prefer the closest existing token over re-introducing a
  hardcoded value; flag genuinely missing tokens rather than hardcoding.
- **Phase 2 `ThemeKey` duplication:** when Phase 2 lands, the 5-theme union is declared in a third
  package (ddoc, dsheet, ddocs.new). Same risk THEMES.md §9 names. Mitigate by copying the union
  verbatim with a comment pointing at `fileverse-ddoc/package/types.ts`. (No impact in Phase 1.)
- **Phase 2 redraw lever unconfirmed:** targeted-redraw API vs remount fallback — resolve in the
  Phase 2 plan.

---

## 9. Out of scope

- **Phase 1:** anything in `src/sheet-engine/**` component/canvas code; the `theme` prop; the grid
  palette; per-cell color inversion; a dsheet-owned provider/toggle; export-time color resolution;
  any theme beyond the five; theming `#efc703`.
- **All phases:** wiring dsheet into the ddocs.new app (separate spec); any new theme.

---

## 10. Key file map

| Concern | Location | Phase |
|---|---|---|
| Chrome components to convert | `src/editor/components/**`, `src/editor/utils/custom-toolbar-item.tsx` | 1 |
| dsheet-authored CSS overrides | `src/editor/styles/index.css` | 1 |
| ui token cascade import | `src/editor/styles/index.css:2` (`@import '@fileverse/ui/styles'`) | 1 |
| Demo `ThemeToggle` in navbar (verification) | `demo/src/main.tsx` (provider, exists), `demo/src/App.tsx:285` (`renderNavbar`) | 1 |
| Export/data color code (leave literal) | `src/editor/utils/xlsx-*`, `csv-import.tsx`, `formula-ui-sync.ts` | — |
| Grid color literals | `src/sheet-engine/core/canvas.ts` | 2 |
| Grid palette module (new) | `src/sheet-engine/core/theme.ts` | 2 |
| `theme` prop type | `src/editor/types.ts` (`DsheetProps`) | 2 |
| Editor context (thread theme) | `src/editor/contexts/editor-context.tsx` | 2 |
| Workbook usage + `forceSheetRender` | `src/editor/components/editor-workbook.tsx:312-332` | 2 |
| ddoc parity references | `fileverse-ddoc/package/types.ts:95`, `package/context/editor-context.tsx`, `package/ddoc-editor.tsx:193-220` | 2 |
