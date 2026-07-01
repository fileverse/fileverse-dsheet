# dsheet Canvas/Grid Theming (Phase 3) — Design / Spec

> How the JS-painted grid — cells, cell text, cell backgrounds, gridlines, headers, and the
> in-cell editor — gains theme support across all 5 themes. Completes the dsheet theming effort:
> Phase 1 themed the dsheet chrome (`src/editor/**`), Phase 2 themed the sheet-engine React
> chrome (`src/sheet-engine/react/**`); this phase themes the **canvas core**
> (`src/sheet-engine/core/**`) + the in-cell editor that Phase 2 deliberately deferred.

**Status:** ✅ **Implemented** (uncommitted — owner commits manually). Built step-by-step with browser checkpoints. Build green. See §11 "Implementation notes" for where the built solution deviated from the original design.
**Companion docs:** `docs/superpowers/specs/2026-06-30-dsheet-themes-design.md` (overall theming;
this supersedes/expands its §7 Phase-2-deferred grid sketch), `fileverse-ddoc/docs/THEMES.md`
(cross-repo reference + ddoc's JS-path parity).

---

## 0. Why this is its own phase

The chrome (toolbar, sidebars, comments, tabs, context menu) is DOM/CSS — it themes by pure CSS
cascade off the `<html>` class via `@fileverse/ui` `.color-*` utilities, no JS. **The grid is
different: it is painted to a `<canvas>` by `src/sheet-engine/core/canvas.ts` with hardcoded hex
(~81 literals). Canvas cannot read CSS variables.** So the grid needs its own JS color-resolution
layer, its own theme signal, and an explicit repaint on theme change. This is dsheet's analogue of
ddoc's JS-driven "document styling" path (THEMES.md §6.2), and it mirrors how ddoc feeds that path:
an explicit `theme` prop threaded through React context.

---

## 1. TL;DR

- **Fully dark grid.** In dark themes, unset/empty cells, gridlines, and row/column headers go
  dark. A "dark sheet" looks dark, not a bright grid in a dark frame.
- **User-set cell colors stay literal.** Any cell the user explicitly colored (`bg` / `fc` /
  border set) renders exactly as authored in every theme. Only *defaults* and *grid chrome* follow
  the theme. dsheet does NOT port ddoc's `getResponsiveColor` inversion — spreadsheet colors are
  deliberate data.
- **Palette map in the engine.** New `src/sheet-engine/core/theme.ts` holds
  `GRID_THEMES: Record<ThemeKey, GridPalette>`. `canvas.ts` reads `activePalette.<slot>` instead of
  literals. `light` palette = exact current hex (regression guard).
- **Explicit `theme` prop, ddoc parity.** `theme?: ThemeKey` on `DsheetProps`, threaded
  `Dsheet → editor-context → EditorWorkbook → Workbook → engine`. On change: update the active
  palette + repaint via `jfrefreshgrid`.
- **In-cell editor matches the cell.** The input/edit overlay uses themed default colors over an
  empty cell, or the cell's literal color when editing a colored cell.
- **Selection accent + feature colors stay constant/literal.** `#EFC703` selection accent is a
  constant; error-red / forced-string-green / data-verification chip / comment marker / hyperlink /
  conditional-formatting colors are feature or user data and stay literal.

---

## 2. Decisions (locked)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Dark-theme grid surface | **Fully dark grid** | Empty cells + gridlines + headers go dark; cohesive dark sheet, not light grid in dark frame. |
| 2 | User-authored cell colors | **Literal in every theme** | Spreadsheet fills/text are deliberate data-viz. Only defaults + chrome theme. No `getResponsiveColor`. |
| 3 | How the canvas learns the theme | **Explicit `theme: ThemeKey` prop** (ddoc parity), threaded through context to the engine | ddoc's canonical channel for its JS-rendered path. Testable; ddocs.new passes `theme` from `useTheme()` exactly like `<DdocEditor theme>`. |
| 4 | Palette home | **Engine layer** (`src/sheet-engine/core/theme.ts`) | Canvas is the only consumer; keeps the engine self-themable. |
| 5 | Redraw on theme change | **`jfrefreshgrid(ctx)`** (targeted full-grid repaint), NOT remount | Already the canonical repaint path (`core/modules/refresh`, called after every edit). No remount churn. |
| 6 | Feature/semantic canvas colors | **Literal** | error-red validation triangle, forced-string green triangle, data-verification dropdown chip, comment marker, hyperlink blue, conditional-format colors (user data). |
| 7 | `#EFC703` selection accent | **Constant across all themes** | Brand selection accent; readable on every background (fill handle, selection border, marching ants). |
| 8 | In-cell editor (InputBox/ContentEditable) | **Matches the cell it overlays** | Themed default over empty cells; literal over colored cells. Editing no longer flashes white-on-dark. |
| 9 | Non-light palette final hex | **Design deliverable** | Ship token-derived placeholders; designer tunes. `light` is exact-current (no visual change). |

---

## 3. The five themes

`ThemeKey` copied verbatim from `fileverse-ddoc/package/types.ts` so the dsheet `theme` prop is
type-identical and ddocs.new can pass one value to both editors:

```ts
export type ThemeKey = 'light' | 'dark' | 'theme-sepia' | 'theme-pink' | 'theme-green';
```

| Class on `<html>` | Label | Grid family |
|---|---|---|
| `light`       | Light   | light |
| `dark`        | Dark    | dark |
| `theme-sepia` | Sepia   | light |
| `theme-pink`  | Keith   | light |
| `theme-green` | Naomiii | dark |

"Family" only guides palette authoring (dark families get dark cell/header surfaces + light text).
There is **no runtime branching on family** and **no inversion of user data** — the per-theme
palette is a static lookup.

---

## 4. Architecture

Four units, each independently testable.

### 4.1 `GRID_THEMES` palette map — `src/sheet-engine/core/theme.ts` (new)

```ts
export type ThemeKey = 'light' | 'dark' | 'theme-sepia' | 'theme-pink' | 'theme-green';
export const DEFAULT_THEME: ThemeKey = 'light';

// Brand selection accent — constant across themes, NOT a palette slot.
export const SELECTION_ACCENT = '#EFC703';

export interface GridPalette {
  cellBg: string;          // unset cell background + main-area canvas clear
  gridLine: string;        // gridlines
  cellText: string;        // default cell text (no user fc)
  headerBg: string;        // row/column header background
  headerText: string;      // row/column header text
  freezeLine: string;      // frozen-pane divider line
  secondaryFill: string;   // on-canvas chip fill (e.g. data-verification dropdown)
  editorBg: string;        // in-cell editor background over an empty cell
  editorText: string;      // in-cell editor text default
  editorBorder: string;    // in-cell editor outline (distinct from selection accent if needed)
}

export const GRID_THEMES: Record<ThemeKey, GridPalette> = {
  light: { /* EXACT current canvas.ts hex — regression guard */ },
  dark: { /* dark-family */ },
  'theme-sepia': { /* light-family, sepia surface */ },
  'theme-pink': { /* light-family, Keith surface */ },
  'theme-green': { /* dark-family, Naomiii surface */ },
};

export let activePalette: GridPalette = GRID_THEMES[DEFAULT_THEME];
export const resolveGridPalette = (t?: ThemeKey): GridPalette =>
  GRID_THEMES[t ?? DEFAULT_THEME] ?? GRID_THEMES[DEFAULT_THEME];

/** Returns true if the palette changed (caller decides whether to repaint). */
export const setActiveGridPalette = (t?: ThemeKey): boolean => { /* swaps activePalette */ };
```

`canvas.ts` replaces hardcoded literals with `activePalette.<slot>` at paint sites.
`light` palette holds the exact pre-theming values, so the default theme renders pixel-identical.

> The four non-light palettes are a design deliverable. Starting point: derive surface/border/text
> from each `@fileverse/ui` theme block so the grid harmonizes with the chrome; designer tunes.

### 4.2 `theme` prop threading — editor layer

`theme?: ThemeKey` on `DsheetProps` (default `'light'`), threaded:

```
<Dsheet theme>
  └─ EditorProvider / editor-context.tsx        (carry theme, default 'light')
       └─ EditorWorkbook                          (src/editor/components/editor-workbook.tsx)
            └─ <Workbook theme>                    (src/sheet-engine/react)
                 └─ engine: setActiveGridPalette(theme) + jfrefreshgrid(ctx)
```

Same shape as ddoc's `editor-context.tsx` → `ddoc-editor.tsx`. A React effect watching `theme`
calls `setActiveGridPalette(theme)`; if it returns true, calls `jfrefreshgrid(ctx, null, undefined)`
to repaint the grid.

### 4.3 Color resolution at paint time — `canvas.ts`

The default-vs-literal split rides the **existing** code branch. Today canvas does, per cell:

```ts
let fillStyle = normalizedAttr(flowdata, r, c, 'bg'); // user-set cell bg, if any
if (checksCF?.cellColor) fillStyle = checksCF.cellColor; // conditional format (user data)
if (!fillStyle) renderCtx.fillStyle = '#FFFFFF';        // ← DEFAULT: becomes activePalette.cellBg
else renderCtx.fillStyle = fillStyle;                    // ← LITERAL: user/CF color, unchanged
```

So the change is surgical: the **fallback** (`!fillStyle`) branch reads `activePalette.cellBg`;
the user-color branch is untouched. Same pattern for default text (`fc` unset → `activePalette.cellText`),
gridlines, and headers (always palette — they have no user-color concept).

### 4.4 In-cell editor — `SheetOverlay/InputBox.tsx`, `ContentEditable.tsx` (+ their CSS)

The editor overlay sits exactly over a cell. It must paint the cell's resolved color:
- Empty cell → `activePalette.editorBg` / `editorText` / `editorBorder`.
- Colored cell → the cell's literal `bg`/`fc` (read the same way the canvas does).

These are React/DOM (not canvas), but they are the cell-editing surface, so they belong to this
phase, not the chrome phases. Their CSS (`.luckysheet-input-box*`, rich-text editor selectors)
moves from hardcoded white/black to the palette-driven values (passed as inline style or CSS vars
set from the active palette, since the editor must match the JS-resolved cell color, not a fixed
CSS token).

---

## 5. What themes vs what stays literal

| Element | Source | Behavior |
|---|---|---|
| Unset cell background | `palette.cellBg` | themed (dark in dark) |
| Gridlines | `palette.gridLine` | themed |
| Row/col header bg + text | `palette.headerBg`/`headerText` | themed |
| Default cell text (no `fc`) | `palette.cellText` | themed |
| Frozen-pane divider | `palette.freezeLine` | themed |
| On-canvas chip (data-verification dropdown) | `palette.secondaryFill` | themed |
| In-cell editor over empty cell | `palette.editor*` | themed |
| **User-set cell bg / text / border** | cell `bg`/`fc`/border | **literal** |
| **Conditional-format colors** | CF rule data | **literal** |
| In-cell editor over a colored cell | cell color | **literal (matches cell)** |
| Selection accent (fill handle, selection border, marching ants) | `SELECTION_ACCENT` | **constant `#EFC703`** |
| Error-red validation triangle, forced-string green triangle | feature | **literal** |
| Comment marker, hyperlink blue, checkbox glyphs | feature | **literal** |

---

## 6. Delivery / data flow

```
ddocs.new useTheme() ──theme──▶ <Dsheet theme>
   <html class> (set by host provider)
        ├─▶ chrome (.color-* utilities)            ── passive CSS, already done (Phases 1–2)
        └─▶ <Dsheet theme> ─▶ editor-context ─▶ Workbook ─▶ engine
                 setActiveGridPalette(theme) ─▶ activePalette
                 jfrefreshgrid(ctx) ─▶ canvas repaints from palette
                 in-cell editor reads activePalette / cell color
```

One source (`useTheme`), two channels (CSS cascade for chrome, prop for grid) — same no-drift
guarantee ddoc has. ddocs.new integration is then `<Dsheet theme={theme} />`, identical to its
`<DdocEditor theme={theme} />` call (a later integration spec).

---

## 7. Canvas literal catalog (paint sites to convert)

From `src/sheet-engine/core/canvas.ts` (~81 color literals; the implementation plan enumerates
exact lines). Mapping to slots:

| Literal(s) | Role → slot |
|---|---|
| `defaultStyle.fillStyle = '#000000'`, default text spots | `cellText` |
| `defaultStyle.strokeStyle = '#e8ebec'` (gridlines) | `gridLine` |
| `'#F8F9FA'` (header bg) | `headerBg` |
| `'#000000'` (header text) | `headerText` |
| `'#FFFFFF'`/`'#ffffff'` (unset cell bg / canvas clear) | `cellBg` (fallback branch only) |
| `'rgba(232, 235, 236, 1)'` (on-canvas chip) | `secondaryFill` |
| freeze-line stroke | `freezeLine` |
| `'#EFC703'` (selection/fill handle) | `SELECTION_ACCENT` (constant) |

**Stay literal (feature/semantic/user data):** error-red `#ff0000`, forced-string green `#487f1e`,
chevron/checkbox glyph fills, conditional-format `cellColor`, user cell `bg`/`fc`, pivot-table
placeholder block.

---

## 8. Risks & observations

- **`ThemeKey` now declared in a 3rd place** (ddoc, dsheet chrome already, dsheet core). Copy
  verbatim with a comment pointing at `fileverse-ddoc/package/types.ts`. A shared constants package
  is the real fix (out of scope) — same risk THEMES.md §9 flags.
- **Module-level `activePalette` is a singleton.** Multiple workbooks with different themes on one
  page would share it. dsheet renders one editor per page (like ddoc), so acceptable; documented.
  If multi-instance is ever needed, move the palette onto `sheetCtx`.
- **`jfrefreshgrid` repaints the whole grid.** Theme switches are rare (user action), so a full
  repaint is fine; no need for partial invalidation.
- **In-cell editor color must track the JS-resolved cell color**, so it can't be a pure CSS token —
  it reads the active palette / cell data. Slightly more involved than the chrome CSS swaps.
- **Non-light palette hex are placeholders** until design sign-off; the mechanism is independent of
  the exact values, so engineering is not blocked.
- **Patchwork by design:** literal user-colored cells will appear as bright islands on a dark grid.
  This is the accepted consequence of decision #2 (preserve user data over visual cohesion).

---

## 9. Scope / non-goals

- **In:** `canvas.ts` palette conversion, `theme.ts` palette module, `theme` prop threading +
  `jfrefreshgrid` redraw wiring, in-cell editor (`InputBox`/`ContentEditable` + their CSS).
- **Out:** chrome (done, Phases 1–2); per-cell color inversion / `getResponsiveColor` (rejected);
  final non-light palette hex (design deliverable); theming `#EFC703`; feature/semantic canvas
  colors; conditional-format / user data colors; ddocs.new app integration (separate spec); any
  theme beyond the five.

---

## 10. Key file map

| Concern | Location |
|---|---|
| Grid color literals (convert) | `src/sheet-engine/core/canvas.ts` |
| New palette module | `src/sheet-engine/core/theme.ts` (new) |
| Targeted repaint | `src/sheet-engine/core/modules/refresh.ts` (`jfrefreshgrid`) |
| `theme` prop type | `src/editor/types.ts` (`DsheetProps`) |
| Editor context (thread theme) | `src/editor/contexts/editor-context.tsx` |
| Workbook usage | `src/editor/components/editor-workbook.tsx` |
| In-cell editor | `src/sheet-engine/react/components/SheetOverlay/InputBox.tsx`, `ContentEditable.tsx` (+ CSS) |
| ddoc parity references | `fileverse-ddoc/package/types.ts`, `package/context/editor-context.tsx`, `package/ddoc-editor.tsx` |

---

## 11. Implementation notes (as built)

Where the built solution differs from or refines the design above:

- **Palette = exact `@fileverse/ui` token values.** The four non-light `GRID_THEMES` palettes use the ui chrome tokens' HSL values verbatim (`cellBg`=`--color-bg-default`, `cellText`=`--color-text-default`, `gridLine`/`freezeLine`=`--color-border-default`, `headerBg`/`secondaryFill`=`--color-bg-secondary`, `headerText`=`--color-text-default`) as `hsla(...)` strings, so grid, chrome, and editor are pixel-consistent per theme. `light` keeps the exact original hex (regression guard). This realizes decision #9's "token-derived" better than arbitrary hex; if ui token values change, refresh these to match.

- **In-cell editor uses published CSS vars, not `editor*` palette slots.** The GridPalette has no `editorBg`/`editorText`/`editorBorder`. Instead the Workbook theme effect publishes `--grid-cell-bg` / `--grid-cell-text` (from `activePalette`) on `document.documentElement`, and `.luckysheet-input-box-inner` reads `var(--grid-cell-bg, …)` / `var(--grid-cell-text, …)`. The editor therefore matches the canvas cell using the **same value source**. Editing a user-*colored* cell still shows the default themed surface (luckysheet's own inline style governs that case) — a known, minor follow-up.

- **Default cell text needed two fixes beyond the canvas paint sites.** The `cellText` default lived in `modules/text.ts` (inline-string builder `!fc ? '#000'`) and at three `canvas.ts` sites via `normalizedAttr(...,'fc')` (which defaults unset `fc` to `#000000` in `modules/cell.ts`). Both were themed to `activePalette.cellText` **only when `fc` is unset** — user-set colors (including deliberate black) stay literal, and the `value !== '#000000'` styled-cell detection elsewhere is untouched.

- **Theme signal path (as wired):** `theme?: ThemeKey` on `DsheetProps` → `SpreadsheetEditor` → `EditorContent` (added to its `Pick`) → `EditorWorkbook` (added to `EditorWorkbookProps` + memo deps) → `Workbook` (`AdditionalProps`) → effect `setActiveGridPalette(theme)` + `jfrefreshgrid(ctx, null, undefined)`. Redraw only when the palette changed; **no remount** (scroll/selection preserved). Demo passes `useTheme().theme`.

- **Files touched:** `src/sheet-engine/core/theme.ts` (new), `src/sheet-engine/core/canvas.ts`, `src/sheet-engine/core/modules/text.ts`, `src/sheet-engine/react/components/Workbook/index.tsx`, `src/sheet-engine/react/components/SheetOverlay/index.css`, `src/editor/types.ts`, `src/editor/dsheet-editor.tsx`, `src/editor/components/editor-workbook.tsx`, `demo/src/App.tsx`.

- **Left as-is (dead):** `canvas.ts` `defaultStyle.fillStyle/strokeStyle/rowFillStyle` are now unused (all reads replaced by `activePalette.*`). Harmless; optional cleanup.

- **Feature/semantic canvas colors confirmed literal:** error red (`#ff0000`), error border (`#FB3449`), forced-string green (`#487f1e`), checkbox glyphs (`#000`/`#fff`), gradient stop, pivot-table placeholder; selection accent routed through `SELECTION_ACCENT` (`#EFC703`). Formula bar (`FxEditor`) was already themed in Phase 2.
