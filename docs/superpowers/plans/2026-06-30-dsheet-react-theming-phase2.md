# dsheet sheet-engine React Theming (Phase 2a) Implementation Plan

> **For agentic workers:** executed via superpowers:subagent-driven-development — fresh subagent per task cluster, review after each. Steps use `- [ ]`.

**Status:** 🟡 **Largely landed & committed** (commits `e31e56f`, `244c94e`, `560e8d9`). Hardcoded chrome grays (`#363b3f`/`#525c6f`/`#535a68` etc.) are gone across all of `src/sheet-engine/react/**`; Toolbar + ContextMenu fully done. Tooltip trap fixed (`.fortune-tooltip` kept literal dark, NOT `color-*-inverse`). **Remaining before calling Phase 2a closed:** (1) final holistic review + `npm run build` gate; (2) human visual QA across all 5 themes; (3) confirm the in-cell editor (`SheetOverlay/InputBox.tsx`, `ContentEditable.tsx`) + cell-editor CSS selectors were correctly left untouched. **Deferred:** in-cell editor (Phase 2b), grid canvas (`src/sheet-engine/core/**`, spec §7), `#0188fb` blue-accent token decision.

**Goal:** Theme the sheet-engine **React/DOM components** (`src/sheet-engine/react/**`) — toolbar, context menu, dialogs, overlays, tabs, data tools — across all 5 themes by replacing hardcoded colors (in both `.tsx` classNames and component `.css` files) with `@fileverse/ui` `.color-*` utilities / `hsl(var(--color-*))`.

**Out of scope (do NOT touch):**
- `src/sheet-engine/core/**` — the canvas/cell renderer (separate future phase).
- The in-cell editor: `SheetOverlay/InputBox.tsx`, `SheetOverlay/ContentEditable.tsx`, and any CSS selector targeting the cell input / rich-text editor (`.luckysheet-input-box*`, `.luckysheet-rich-text-editor`, `.fortune-input*`).
- Brand/feature accents (kept literal, see below).

**Tech Stack:** React + TS, Tailwind, `@fileverse/ui` ≥5.1.8 tokens (all 5 theme blocks present), Vite.

**Prereq met:** `@fileverse/ui` is on 5.1.x (Phase 1 decision #10) — sepia/pink/green token blocks exist.

---

## Conventions

**No automated tests** — className/CSS edits; verification = build (`npm run build`) + grep sweep + human visual QA across 5 themes.

**No commits** — owner commits manually. Each task is a clean stop-point.

**Rules for every subagent:**
- Repo `/Users/maitrakhatri/Developer/fileverse-dsheet`, branch `maitra/drop-in-package`.
- DO NOT commit. DO NOT touch `src/sheet-engine/core/**`. DO NOT touch excluded in-cell-editor files/selectors.
- TWO working dirs in session (dsheet + ddoc) — use absolute paths under the dsheet path; prefer Read; confirm edits with Read. (Do not run per-file git diff repeatedly.)
- Edit ONLY color-related classes/properties; preserve all other classes, layout, behavior; no reformatting.
- For each assigned file: convert every hardcoded chrome color using the mapping; LEAVE listed accents literal and report them; if a color's role is ambiguous, leave it and report rather than guess.

**Canonical mapping (tsx `.color-*` / css `hsl(var(--color-*))`):**

| Hardcoded | Token |
|---|---|
| `#fff`, `#ffffff`, `white`, `bg-white` (surface) | `color-bg-default` |
| `#f8f9fa`, `#f2f4f5`, `gray-50/100` (light surface) | `color-bg-secondary` |
| `#363b3f`, `#000`, `#000000`, `#333`, `text-black`, `text-gray-800` | `color-text-default` |
| `#525c6f`, `#535a68`, `#77818a`, `text-gray-500/600` | `color-text-secondary` |
| `#ccced2`, `#d4d4d4`, `#e8ebec`, `border-gray-*`, `border-white` | `color-border-default` |
| gray-100/200 used as hover | `color-bg-default-hover` |
| danger red (`#ff0000`, `#fb3449`, `red`) text/icon ; bg | `color-text-danger` ; `color-bg-danger` |
| success green text/bg/border | `color-text-success` / `color-bg-success` / `color-border-success` |
| `#000` bg + `#fff` text (inverse pill) | `color-bg-default-inverse` + `color-text-inverse` |
| white text/icon ON a colored (brand/success/danger) fill | `color-text-inverse` (NOT `color-text-on-brand`, which is near-black) |

CSS: replace e.g. `color: #363b3f;` → `color: hsl(var(--color-text-default));`, `background: #fff;` → `background: hsl(var(--color-bg-default));`, `border: 1px solid #e8ebec;` → `border: 1px solid hsl(var(--color-border-default));`.

**KEEP LITERAL (report each occurrence, do not convert):**
- `#efc703` / `#EFC703` — selection accent, constant across themes.
- `#0188fb` (and similar interactive blues) — active/link/selection-blue accent. Leave literal this round and report; a follow-up can decide `color-text-link` / `color-border-active`.
- Any obvious brand accent hex; SVG `fill="#..."` path colors in `SVGDefines.tsx` / `SVGIcon.tsx` / icon components (leave — icons mostly use currentColor or are brand glyphs).
- Drop ad-hoc `dark:` Tailwind variants in favor of the base `.color-*`.

**Token validity:** before using a token, it must exist in `node_modules/@fileverse/ui/dist/index.css`. Available families: `color-bg-{default,default-hover,default-active,default-inverse,secondary,secondary-hover,tertiary,brand,brand-hover,brand-light,success,success-light,danger,danger-light,disabled}`, `color-text-{default,secondary,disabled,danger,success,inverse,link,on-brand}`, `color-border-{default,hover,active,focused,danger,success,info,disabled,success}`, `color-icon-{default,secondary,...}`. If a needed surface has no exact token, use the closest and report; never invent.

---

## Task 1: Toolbar/ (largest — 92 spots)
**Files:** all `.tsx` + `src/sheet-engine/react/components/Toolbar/index.css` (and any nested css) under `src/sheet-engine/react/components/Toolbar/`.
- [ ] Convert hardcoded chrome colors (tsx classNames + css) per mapping. Leave `#efc703`/`#0188fb`/brand accents literal + report. Drop `dark:` variants.
- [ ] Re-read each edited file (Read) to confirm; no `src/sheet-engine/core/**` touched.
- [ ] Report: files changed, accents left literal (with locations), any ambiguous spots left.
- [ ] STOP-point (no commit).

## Task 2: ContextMenu/
**Files:** `src/sheet-engine/react/components/ContextMenu/**` `.tsx` + `index.css`.
- [ ] Same conversion + report. (Context menu rows, hover, separators, icons.)

## Task 3: SheetOverlay/ — EXCLUDING in-cell editor
**Files:** `src/sheet-engine/react/components/SheetOverlay/**` `.tsx` + `.css`, EXCEPT:
- SKIP `InputBox.tsx`, `ContentEditable.tsx`.
- In `SheetOverlay/index.css` and `index.tsx`: SKIP any selector/element for the cell input / rich-text editor (`.luckysheet-input-box*`, `.luckysheet-rich-text-editor`, `.fortune-input*`). Convert the rest (scrollbar, formula hint, formula search, date picker, column/row header overlays, drag-and-drop helpers).
- [ ] Convert per mapping; leave accents literal + report; confirm InputBox.tsx/ContentEditable.tsx and cell-editor selectors untouched.
- [ ] Report explicitly which selectors you skipped as in-cell-editor.

## Task 4: Modals & search
**Files (tsx + each dir's css):** `Dialog/`, `MessageBox/`, `QuickSearch/`, `SearchReplace/`, `FormatSearch/`, `DuneChartsInputModal/`, `DunePreview/`, `LinkEidtCard/`.
- [ ] Convert per mapping + report.

## Task 5: Data tools
**Files (tsx + css):** `ConditionFormat/` (incl. `formating.css`), `DataVerification/`, `FilterOption/`, `CustomSort/`, `RemoveDuplicates/`, `SplitColumn/`, `LocationCondition/`, `ResetColumnWidth/`, `ResetRowHeight/`, `ChangeColor/`, `CryptoDenominationSelector/`.
- [ ] Convert per mapping + report. (Validation states may use success/danger tokens.)

## Task 6: Bottom bar & misc
**Files (tsx + css):** `SheetTab/`, `SheetList/`, `ZoomControl/`, `NotationBoxes/`, `ErrorState/`, `IFrameBoxs/`, `ImgBoxs/`, `Sheet/`, `SidebarPanelPortals/`, `Workbook/` (incl. `index.css`). For `SVGDefines.tsx` / `SVGIcon.tsx`: leave SVG path fills literal unless a fill is plainly a themable chrome surface — report what you find, convert nothing risky.
- [ ] Convert per mapping + report.

## Task 7: Top-level react stylesheet
**Files:** `src/sheet-engine/react/index.css`.
- [ ] Convert hardcoded chrome colors → `hsl(var(--color-*))`; leave `#efc703` + accents; skip any cell-editor selectors. Report.

## Task 8: Sweep + build gate
- [ ] Sweep (from repo root):
  ```
  grep -rnE "bg-white|bg-black|text-white|text-black|text-gray-[0-9]|bg-gray-[0-9]|border-gray-[0-9]|dark:|#[0-9a-fA-F]{3,6}" src/sheet-engine/react --include="*.tsx" --include="*.ts" --include="*.css"
  ```
  Review remaining hits: each must be an allowed accent (`#efc703`, `#0188fb`/blues, brand, SVG fills) or an excluded in-cell-editor selector. Convert any genuinely-missed chrome color; report the rest.
- [ ] Build gate: `cd /Users/maitrakhatri/Developer/fileverse-dsheet && npm run build` → expect success (only pre-existing sheet-engine circular-reexport warnings).
- [ ] Report final disposition. No commit.

---

## After all tasks
- Final holistic review of the whole `src/sheet-engine/react/**` diff (consistency, no canvas/core touched, no in-cell-editor touched, tokens valid, build green).
- Human visual QA across all 5 themes in the demo (`cd demo && npm run dev`): toolbar, context menu (right-click), dialogs, search, tabs/zoom, data-verification & conditional-format panels, formula hint/search, scrollbars. In-cell editing box may still look light — expected (excluded). Canvas grid still light — expected (core deferred).

## Notes
- `#0188fb` blue accent left literal this round is the main known follow-up (decide link/active token later).
- If any task's dir is unexpectedly large/tangled, the subagent reports DONE_WITH_CONCERNS rather than splitting unilaterally.
