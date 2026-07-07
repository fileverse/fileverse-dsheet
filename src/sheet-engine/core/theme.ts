/**
 * Grid (canvas) theming — the single source of truth for the JS-painted grid's per-theme colors.
 *
 * The chrome (toolbar, sidebars, comments) themes passively via `@fileverse/ui` `.color-*`
 * utilities + the `<html>` class. The canvas grid cannot read CSS variables, so `canvas.ts`
 * resolves its colors from `activePalette` here. On theme change the host threads a `theme` prop
 * to the engine, which calls `setActiveGridPalette` and repaints via `jfrefreshgrid`.
 *
 * `ThemeKey` is copied verbatim from `fileverse-ddoc` `package/types.ts` so the dsheet `theme`
 * prop is type-identical to ddoc's and a host app can pass the same value to both editors.
 *
 * See docs/superpowers/specs/2026-06-30-dsheet-canvas-theming-design.md
 */

export type ThemeKey =
  | 'light'
  | 'dark'
  | 'theme-sepia'
  | 'theme-pink'
  | 'theme-green';

export const DEFAULT_THEME: ThemeKey = 'light';

/**
 * dsheet selection-accent brand color. Constant across all five themes (readable on every
 * background) — intentionally NOT a per-theme palette slot. Used for the fill handle, selection
 * border, and marching ants.
 */
export const SELECTION_ACCENT = '#EFC703';

/**
 * One slot per neutral grid-chrome color role painted in `canvas.ts`. User-authored cell colors
 * (cell `bg`/`fc`/border, conditional-format colors) are NOT here — they render literally in every
 * theme and are read straight from cell data.
 */
export interface GridPalette {
  /** Unset cell background + main-area canvas clear (the `!fillStyle` fallback branch). */
  cellBg: string;
  /** Gridlines. */
  gridLine: string;
  /** Default cell text (cells with no user `fc`). */
  cellText: string;
  /** Row/column header background. */
  headerBg: string;
  /** Row/column header text. */
  headerText: string;
  /** Secondary fill for on-canvas chips (e.g. data-verification dropdown). */
  secondaryFill: string;
  /** Frozen-pane divider line. */
  freezeLine: string;
}

/**
 * Per-theme grid palettes.
 *
 * `light` holds the EXACT pre-theming hex from `canvas.ts`, so the default theme renders
 * pixel-identical to before this change (regression guard).
 *
 * [Unverified] The four non-light palettes are reasonable design-guess values derived from each
 * theme's surface swatch — NOT final brand colors; they need design sign-off. The mechanism is
 * independent of the exact values.
 */
export const GRID_THEMES: Record<ThemeKey, GridPalette> = {
  light: {
    cellBg: '#FFFFFF',
    gridLine: '#e8ebec',
    cellText: '#000000',
    headerBg: '#F8F9FA',
    headerText: '#000000',
    secondaryFill: 'rgba(232, 235, 236, 1)',
    freezeLine: '#ccc',
  },
  // Non-light palettes mirror the `@fileverse/ui` chrome tokens EXACTLY (same HSL values), so the
  // grid, the chrome, and the in-cell editor (which reads cellBg via --grid-cell-bg) are pixel
  // consistent per theme. Slot → ui token: cellBg=--color-bg-default, cellText=--color-text-default,
  // gridLine/freezeLine=--color-border-default, headerBg/secondaryFill=--color-bg-secondary,
  // headerText=--color-text-default. If ui token values change, refresh these to match.
  dark: {
    cellBg: 'hsla(0, 0%, 18%, 1)',
    gridLine: 'hsla(0, 0%, 25%, 1)',
    cellText: 'hsla(0, 0%, 91%, 1)',
    headerBg: 'hsla(0, 0%, 12%, 1)',
    headerText: 'hsla(0, 0%, 91%, 1)',
    secondaryFill: 'hsla(0, 0%, 12%, 1)',
    freezeLine: 'hsla(0, 0%, 25%, 1)',
  },
  'theme-sepia': {
    cellBg: 'hsla(41, 61%, 84%, 1)',
    gridLine: 'hsla(41, 49%, 76%, 1)',
    cellText: 'hsla(28, 16%, 21%, 1)',
    headerBg: 'hsla(41, 61%, 80%, 1)',
    headerText: 'hsla(28, 16%, 21%, 1)',
    secondaryFill: 'hsla(41, 61%, 80%, 1)',
    freezeLine: 'hsla(41, 49%, 76%, 1)',
  },
  'theme-pink': {
    cellBg: 'hsla(346, 100%, 95%, 1)',
    gridLine: 'hsla(346, 100%, 90%, 1)',
    cellText: 'hsla(3, 88%, 26%, 1)',
    headerBg: 'hsla(346, 100%, 92%, 1)',
    headerText: 'hsla(3, 88%, 26%, 1)',
    secondaryFill: 'hsla(346, 100%, 92%, 1)',
    freezeLine: 'hsla(346, 100%, 90%, 1)',
  },
  'theme-green': {
    cellBg: 'hsla(120, 9%, 24%, 1)',
    gridLine: 'hsla(120, 8%, 30%, 1)',
    cellText: 'hsla(63, 27%, 83%, 1)',
    headerBg: 'hsla(120, 6%, 16%, 1)',
    headerText: 'hsla(63, 27%, 83%, 1)',
    secondaryFill: 'hsla(120, 6%, 16%, 1)',
    freezeLine: 'hsla(120, 8%, 30%, 1)',
  },
};

export const resolveGridPalette = (theme?: ThemeKey): GridPalette =>
  GRID_THEMES[theme ?? DEFAULT_THEME] ?? GRID_THEMES[DEFAULT_THEME];

/**
 * The palette the canvas paints from. Module-level so the imperative canvas reads it on every
 * repaint without prop threading inside the engine. `canvas.ts` imports this as a live binding and
 * reads `activePalette.<slot>` at paint time; reassigning it here updates every reader.
 *
 * NOTE: this is a module singleton — multiple workbooks with different themes on one page would
 * share it. dsheet renders one editor per page (like ddoc), so this is acceptable. If multi-instance
 * is ever needed, move the palette onto `sheetCtx`.
 */
export let activePalette: GridPalette = GRID_THEMES[DEFAULT_THEME];

let activeTheme: ThemeKey = DEFAULT_THEME;

/** Swap the active grid palette. Returns true if it actually changed (caller decides to repaint). */
export const setActiveGridPalette = (theme?: ThemeKey): boolean => {
  const next = theme ?? DEFAULT_THEME;
  if (next === activeTheme) return false;
  activeTheme = next;
  activePalette = resolveGridPalette(next);
  return true;
};

export const getActiveTheme = (): ThemeKey => activeTheme;
