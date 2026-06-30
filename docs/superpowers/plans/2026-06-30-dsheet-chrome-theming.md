# dsheet Chrome Theming (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all dsheet-level chrome (toolbar wrapper, sidebars, comments, dialogs, chips in `src/editor/**` + dsheet-authored `index.css`) follow the active theme across all five themes by replacing hardcoded colors with `@fileverse/ui` `.color-*` semantic utilities.

**Architecture:** Chrome themes by pure CSS cascade off the `<html>` class — no `theme` prop, no provider, no JS. `@fileverse/ui` already ships token blocks (`light`/`dark`/`theme-sepia`/`theme-pink`/`theme-green`) and `.color-*` utilities; `src/editor/styles/index.css` already imports them. The work is gap-filling: 56 spots already use `.color-*`; ~90 spots still hardcode colors or use ad-hoc `dark:` variants. We convert those. The canvas grid (`src/sheet-engine/**`) is explicitly **out of scope** (deferred Phase 2).

**Tech Stack:** React + TypeScript, Tailwind, `@fileverse/ui` design tokens, Vite (demo HMR).

**Spec:** `docs/superpowers/specs/2026-06-30-dsheet-themes-design.md`

---

## Conventions for this plan

**No automated tests.** These are CSS/className changes; the only meaningful verification is visual, across all five themes, plus the package still building. Every task ends with a **visual verify** step and a **stop-point** for manual testing.

**Commits:** This repo's owner commits manually (standing rule: the assistant never commits). Each task is a clean stop-point — commit yourself if you want, or just eyeball and continue.

**Verification harness (set up in Task 0, keep running the whole time):**
```bash
cd /Users/maitrakhatri/Developer/fileverse-dsheet/demo && npm run dev
# open http://localhost:5000 — Vite HMR reflects src/editor edits instantly
```

**Canonical color mapping** — apply consistently everywhere unless a task says otherwise:

| Hardcoded (any of) | Replace with |
|---|---|
| `bg-white` | `color-bg-default` |
| `bg-gray-50`, `bg-gray-100`, `bg-[#F8F9FA]`, `bg-[#f8f9fa]`, `bg-[#F2F4F5]`, `bg-[#f2f4f5]` | `color-bg-secondary` |
| `bg-gray-200` (skeleton shimmer / hover) | `color-bg-secondary` |
| `hover:bg-gray-200` | `hover:color-bg-default-hover` |
| `text-black`, `text-[#363B3F]`, `text-gray-800` | `color-text-default` |
| `text-gray-600`, `text-gray-500`, `text-[#77818A]`, `text-[#77818a]` | `color-text-secondary` |
| `border-white`, `border-gray-200`, `border-gray-700`, `border-[#E8EBEC]`, `border-[#e8ebec]`, `border-[#F8F9FA]` | `color-border-default` |
| `!bg-[#000] !text-[#fff]` (selected pill) | `!color-bg-default-inverse !color-text-inverse` |
| `text-[#FB3449]`, `!text-[#FB3449]`, `!text-[#FB...]` (danger red) | `color-text-danger` |
| `bg-green-100` / `text-green-800` (success badge) | `color-bg-success` / `color-text-success` |
| inline `background: '#ffffff'` / `backgroundColor: '#fff'` | remove inline color; add `className="color-bg-default"` |
| inline `backgroundColor: '#F8F9FA'` | remove inline; add `className="color-bg-secondary"` |
| inline `border: '1px solid #E8EBEC'` | remove inline; add `className="border color-border-default"` |

**Keep LITERAL (do NOT convert — confirmed brand/feature accents):**
- `custom-toolbar-item.tsx`: fetch-url `#1977E4*`, template `#CF1C82*`.
- `smart-contract.tsx`: `#fef2ef`, `#F95738` (feature accent).
- `function-metadata.tsx`: `text-[#5c0aff]` (purple feature accent).
- `import-button-ui.tsx`: `bg-[#F5A623]/20 text-[#7A4F00]` (warning banner — no warning token).
- API-key-set green `bg-[#177E23]` indicator → see Task 6 (maps to success, not a brand exception).
- `#efc703` selection accent (only appears in `index.css` / canvas).

**Leave / out of scope:** `backgroundColor: 'red!important'` in `import-button-ui.tsx:119` and `read-only-export-button.tsx:33` — invalid inline CSS (the `!important` makes it a no-op), a dev leftover, not a theming concern. Do not touch in this plan.

---

## Task 0: Verification harness — demo navbar ThemeToggle

**Files:**
- Modify: `demo/src/App.tsx` (import `ThemeToggle`; render in `renderNavbar`)

- [ ] **Step 1: Add the import**

In `demo/src/App.tsx`, the editor primitives are imported from `../../src/index`. `ThemeToggle` lives in `@fileverse/ui`. Add near the other `@fileverse/ui` imports (or add a new import line):

```tsx
import { ThemeToggle } from '@fileverse/ui';
```

- [ ] **Step 2: Render it in the navbar**

`renderNavbar` is the `useCallback` at `demo/src/App.tsx:285`. Inside the returned navbar JSX, near the existing more-actions buttons (~L331), add:

```tsx
<ThemeToggle />
```

Place it as a sibling of the existing navbar action buttons so it shows in the top bar (mirrors `fileverse-ddoc` `demo/src/App.tsx:469`).

- [ ] **Step 3: Run the demo and verify the toggle works**

```bash
cd /Users/maitrakhatri/Developer/fileverse-dsheet/demo && npm run dev
```
Open http://localhost:5000. Click the theme toggle and cycle: Light → Dark → Sepia → Keith → Naomiii.
Expected: `<html>` class changes (inspect element), and chrome that already uses `.color-*` (56 spots) repaints. The grid canvas stays light (expected — Phase 2). Some chrome looks broken in non-light themes (white boxes, black text) — that is exactly what the next tasks fix.

- [ ] **Step 4: STOP — manual test.** Confirm the toggle cycles all five themes and the `<html>` class updates. Commit if desired.

---

## Task 1: `index.css` fortune-DOM overrides

**Files:**
- Modify: `src/editor/styles/index.css`

- [ ] **Step 1: Theme the inline-comment popup**

Find `.luckysheet-postil-show-main` (~L128). Replace its hardcoded surface/border:

```css
/* before */
background-color: white !important;
border: 1px solid #e8ebec !important;

/* after */
background-color: hsl(var(--color-bg-default)) !important;
border: 1px solid hsl(var(--color-border-default)) !important;
```
Leave the `box-shadow`, `border-radius`, `padding`, sizing untouched.

- [ ] **Step 2: Theme the fortune tooltip**

Find `.fortune-tooltip` (~L81). Replace:

```css
/* before */
background: black !important;

/* after */
background: hsl(var(--color-bg-tooltip)) !important;
```
Leave `top`, `border-radius` untouched. (Tooltip text, if any rule sets it, should use `hsl(var(--color-text-tooltip))` — add only if a text-color rule exists; do not invent one.)

- [ ] **Step 3: Confirm selection accent + brand accents untouched**

Do NOT change `#efc703` (`.luckysheet-cs-fillhandle`, `.fortune-cell-selected-move/extend`, `.luckysheet-input-box-inner`, `.fortune-row/col-header-selected`), `.fetch-url-button` `#1977e4`, or `.template-button:hover` `#cf1c821f`. These are intentional constants/brand accents.

- [ ] **Step 4: Visual verify**

In the running demo, open a cell comment (inline popup) in Dark and Sepia. Expected: popup background + border follow the theme (no white box on dark). Hover something with a fortune tooltip; expected dark-surface tooltip uses the token.

- [ ] **Step 5: STOP — manual test.** Commit if desired.

---

## Task 2: Simple chips & comment controls

**Files:**
- Modify: `src/editor/components/collab-status-chip.tsx`
- Modify: `src/editor/components/permission-chip.tsx`
- Modify: `src/editor/components/comments/comment-input.tsx`
- Modify: `src/editor/components/comments/comment-actions-dropdown.tsx`
- Modify: `src/editor/components/comments/comment-cell-popup.tsx`

- [ ] **Step 1: `collab-status-chip.tsx:32`** — drop the `dark:` variant, use a token:

```tsx
// before
<div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 select-none">
// after
<div className="flex items-center gap-1.5 text-xs font-medium color-text-secondary select-none">
```

- [ ] **Step 2: `permission-chip.tsx`** — lines 20, 23, 38, 40:

```tsx
// L20, L38:  text-gray-800  → color-text-default   (LucideIcon className)
// L23, L40:  text-black     → color-text-default
```
Replace `text-gray-800` with `color-text-default` and `text-black` with `color-text-default` in those four classNames (keep all other classes like `w-4 h-4`, `text-xs`, `dsheet-text--chip`).

- [ ] **Step 3: `comment-input.tsx:113`**:

```tsx
// before
className="bg-white max-h-[76px] !h-[76px]"
// after
className="color-bg-default max-h-[76px] !h-[76px]"
```

- [ ] **Step 4: `comment-actions-dropdown.tsx`** — lines 123, 124:

```tsx
// L123: hover:bg-gray-200 → hover:color-bg-default-hover
// L124: text-gray-500     → color-text-secondary
```

- [ ] **Step 5: `comment-cell-popup.tsx`** — lines 102, 149, 158:

```tsx
// L102: text-[#363B3F] → color-text-default
// L149: text-gray-600  → color-text-secondary
// L158: text-gray-600  → color-text-secondary
```

- [ ] **Step 6: Visual verify**

In Dark + Naomiii: open the comment cell popup and the comment sidebar input. Confirm the "Comments" heading, secondary meta text, dropdown hover, permission chip text, and collab chip text are all legible (no black-on-dark).

- [ ] **Step 7: STOP — manual test.** Commit if desired.

---

## Task 3: `comment-item.tsx` & `comment-sidebar.tsx`

**Files:**
- Modify: `src/editor/components/comments/comment-item.tsx`
- Modify: `src/editor/components/comments/comment-sidebar.tsx`

- [ ] **Step 1: `comment-item.tsx:121`** — hover/border:

```tsx
// before
isHovered && !isCellPopup ? 'border-[#F8F9FA]' : 'border-white',
// after
isHovered && !isCellPopup ? 'color-border-default' : 'color-border-default',
```
(Both branches become the themed border; if a visible hover distinction is wanted, use `color-bg-default-hover` on the container instead — keep simple: themed border both states.)

- [ ] **Step 2: `comment-item.tsx:127`** — body text:

```tsx
// text-[#363B3F] → color-text-default
```

- [ ] **Step 3: `comment-item.tsx:310-311`** — overlay + card:

```tsx
// L310: bg-white/70 → color-bg-default/70
// L311: bg-white    → color-bg-default   (keep the existing `color-border-default`)
```

- [ ] **Step 4: `comment-item.tsx:329`** — danger action:

```tsx
// !text-[#FB3449] → color-text-danger   (keep the leading `!` only if needed for specificity: !color-text-danger)
```
Use `!color-text-danger` to preserve the `!important`-style override behavior.

- [ ] **Step 5: `comment-sidebar.tsx`** — lines 423, 424:

```tsx
// L423: bg-gray-50 → color-bg-secondary   (keep `border` → ensure themed: add color-border-default if a bare `border` is present)
// L424: text-gray-600 → color-text-secondary
```
At L423 the element has `border rounded-lg`; change bare `border` styling by adding `color-border-default` so the border is themed: `mt-3 p-3 color-bg-secondary border color-border-default rounded-lg`.

- [ ] **Step 6: Visual verify**

In Dark + Keith: open the comment sidebar with at least one comment, hover a comment, open the delete/confirm card. Confirm card background, body text, the resolved/empty info block, and the danger (delete) text are all themed and legible.

- [ ] **Step 7: STOP — manual test.** Commit if desired.

---

## Task 4: `skeleton-loader.tsx`

**Files:**
- Modify: `src/editor/components/skeleton-loader.tsx`

- [ ] **Step 1: Replace all gray shimmer surfaces with tokens**

Apply per the canonical mapping to every line:

```tsx
// L59:  bg-gray-50  → color-bg-secondary
// L63:  bg-gray-200 → color-bg-secondary
// L100: bg-gray-50  → color-bg-secondary
// L110: bg-gray-200 → color-bg-secondary
// L120: bg-gray-200 → color-bg-secondary
// L140: bg-gray-100 → color-bg-secondary
// L144: bg-gray-100 → color-bg-secondary ; text-gray-500 → color-text-secondary
// L158: bg-gray-100 → color-bg-secondary ; text-gray-500 → color-text-secondary
// L164: bg-white    → color-bg-default
// L171: bg-gray-200 → color-bg-secondary
```

- [ ] **Step 2: Fix the inline white background at L168**

```tsx
// before
style={{
  background: '#ffffff',
  ...
}}
// after — remove the background line from style, add the class to className
```
Remove `background: '#ffffff',` from the inline `style` object and add `color-bg-default` to that element's `className`.

- [ ] **Step 3: Visual verify**

Force the skeleton to show (reload the demo so the loader appears, or temporarily render it). In Dark + Naomiii: confirm shimmer blocks and the grid-header placeholder read as themed neutral surfaces, not light-gray-on-dark.

- [ ] **Step 4: STOP — manual test.** Commit if desired.

---

## Task 5: Sidebars — `templates.tsx`, `template-ui.tsx`, `right-sidebar.tsx`

**Files:**
- Modify: `src/editor/components/sidebars/templates.tsx`
- Modify: `src/editor/components/sidebars/template-ui.tsx`
- Modify: `src/editor/components/sidebar/right-sidebar.tsx`

- [ ] **Step 1: `templates.tsx:130`** — heading text:

```tsx
// text-[#363B3F] → color-text-default
```

- [ ] **Step 2: `templates.tsx:154,156`** — category pill:

```tsx
// L154: border-[#E8EBEC] → remove (already has color-border-default alongside it); keep color-border-default
// L156 (selected): '!bg-[#000] !text-[#fff] border-none' → '!color-bg-default-inverse !color-text-inverse border-none'
```

- [ ] **Step 3: `template-ui.tsx:27`** — card surface:

```tsx
// bg-white → color-bg-default   (keep hover:color-bg-default-hover, color-border-default, shadows)
```

- [ ] **Step 4: `template-ui.tsx:78`** — preview modal; drop `dark:` variants:

```tsx
// before
className="bg-white dark:bg-gray-800 rounded-lg shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-2 border border-gray-200 dark:border-gray-700 w-[750px] h-[500px] relative transition-all duration-300 ease-in-out"
// after
className="color-bg-default rounded-lg shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-2 border color-border-default w-[750px] h-[500px] relative transition-all duration-300 ease-in-out"
```
(Leave the `shadow-[...]` rgba — shadows stay literal.)

- [ ] **Step 5: `right-sidebar.tsx:22`** — panel container; drop `dark:` variant:

```tsx
// before
'fixed right-0 z-30 bg-[#F8F9FA] border-l transition-all duration-300 ease-in-out overflow-hidden dark:bg-[#1E1E1E] !select-text',
// after
'fixed right-0 z-30 color-bg-secondary border-l color-border-default transition-all duration-300 ease-in-out overflow-hidden !select-text',
```

- [ ] **Step 6: `right-sidebar.tsx:39,41`** — inline styles:

```tsx
// remove `border: '1px solid #E8EBEC',` and `backgroundColor: '#fff',` from the inline style object,
// and add to that element's className: "border color-border-default color-bg-default"
```

- [ ] **Step 7: `right-sidebar.tsx:62`** — header divider:

```tsx
// border-gray-200 → color-border-default
```

- [ ] **Step 8: Visual verify**

In Dark + Sepia + Keith: open the right sidebar (data-verification / conditional-format / functions / templates). Confirm the panel surface, header divider, template cards, the selected category pill (inverse), and the template preview modal are all themed.

- [ ] **Step 9: STOP — manual test.** Commit if desired.

---

## Task 6: Functions sidebar — `function-metadata.tsx`, `functionList.tsx`

**Files:**
- Modify: `src/editor/components/sidebars/function/function-metadata.tsx`
- Modify: `src/editor/components/sidebars/function/functionList.tsx`

- [ ] **Step 1: `function-metadata.tsx` — success badge L65:**

```tsx
// bg-green-100 text-green-800 → color-bg-success color-text-success
```

- [ ] **Step 2: `function-metadata.tsx` — API-key indicator L109,113:**

```tsx
// L109: set → 'bg-[#177E23]' becomes 'color-bg-success' ; unset → 'bg-[#e8ebec]' becomes 'color-bg-secondary'
// L113: set → 'text-white' becomes 'color-text-on-brand' ; unset → 'text-[#77818A]' becomes 'color-text-secondary'
```

- [ ] **Step 3: `function-metadata.tsx` — example block L134:**

```tsx
// bg-[#F2F4F5] → color-bg-secondary
// border-[hsl(var(--color-border-default,#E8EBEC))] → border color-border-default
```

- [ ] **Step 4: `function-metadata.tsx` — fix broken token at L164:**

```tsx
// before (missing closing paren — currently broken):
className="text-[hsl(var(--color-text-default)] font-mono text-sm font-bold leading-5"
// after:
className="color-text-default font-mono text-sm font-bold leading-5"
```

- [ ] **Step 5: `function-metadata.tsx` — examples label L216:**

```tsx
// text-[#77818a] → color-text-secondary
```
Leave L207 `text-[#5c0aff]` (purple feature accent) and the already-correct `hsl(var(--color-text-*))` spots (L131, L142, L156, L167, L232, L260) untouched.

- [ ] **Step 6: `function-metadata.tsx` — example item surface L228:**

```tsx
// bg-[#f8f9fa] → color-bg-secondary
// border-[#e8ebec] → color-border-default  (keep `border border-solid`)
```

- [ ] **Step 7: `functionList.tsx`** — lines 25, 42, 46:

```tsx
// L25: hover:bg-[#F2F4F5] → hover:color-bg-default-hover ; selected 'bg-[#F2F4F5]' → 'color-bg-secondary'
// L42: set 'bg-[#177E23]' → 'color-bg-success' ; unset 'bg-[#e8ebec]' → 'color-bg-secondary'
// L46: set 'text-white' → 'color-text-on-brand' ; unset 'text-[#77818A]' → 'color-text-secondary'
```

- [ ] **Step 8: Visual verify**

In Dark + Naomiii: open the Functions panel. Hover/select a function in the list, open a function's metadata. Confirm list hover/selected states, the API-key indicator (set vs unset), the success badge, example code blocks, and the (now-fixed) bold default text all read correctly. The purple link accent stays as-is.

- [ ] **Step 9: STOP — manual test.** Commit if desired.

---

## Task 7: Misc — `smart-contract.tsx`, `comment-cell-popup` leftovers, `import-button-ui.tsx`

**Files:**
- Modify: `src/editor/components/smart-contract.tsx`
- Modify: `src/editor/components/import-button-ui.tsx`

- [ ] **Step 1: `smart-contract.tsx` — neutral surface only (L56):**

```tsx
// inline style backgroundColor: '#F8F9FA' → remove from style, add className "color-bg-secondary"
```
Leave L23 `bg-[#fef2ef]` and L29 `text-[#F95738]` LITERAL (smart-contract feature accent).

- [ ] **Step 2: `import-button-ui.tsx` — confirm nothing to convert:**

L262 already uses `text-[hsla(var(--color-text-danger))]` (correct). L365 `bg-[#F5A623]/20 text-[#7A4F00]` is the warning banner — KEEP LITERAL (no warning token). L119 `backgroundColor: 'red!important'` — leave (invalid dev leftover, out of scope). No edits needed in this file unless Step 1 review finds a neutral gray.

- [ ] **Step 3: Visual verify**

In Dark: trigger the smart-contract block (its neutral inner surface should be themed; the orange accent stays). Open the import flow and the warning banner — banner stays amber (intentional), error text uses the danger token.

- [ ] **Step 4: STOP — manual test.** Commit if desired.

---

## Task 8: Full sweep + build gate

**Files:** none (verification only)

- [ ] **Step 1: Re-scan for any missed hardcoded chrome colors**

```bash
cd /Users/maitrakhatri/Developer/fileverse-dsheet
grep -rnE "bg-white|bg-black|text-white|text-black|text-gray-[0-9]|bg-gray-[0-9]|border-gray-[0-9]|border-white|bg-green-|text-green-|dark:" src/editor --include="*.tsx" --include="*.ts" \
  | grep -vE "xlsx-|csv-import|formula-ui-sync|xlsx-hyperlink"
```
Expected: no results, except any spot deliberately kept literal (none of these patterns should remain — brand accents use `#hex`/arbitrary values, not these utility classes). Investigate and convert anything that appears.

- [ ] **Step 2: Confirm brand/feature accents are the only remaining hex**

```bash
grep -rnE "#[0-9a-fA-F]{3,6}|bg-\[#|text-\[#" src/editor --include="*.tsx" \
  | grep -vE "xlsx-|csv-import|formula-ui-sync|xlsx-hyperlink|hsl\(var"
```
Expected remaining (allowed): `#1977E4*`, `#CF1C82*` (custom-toolbar-item), `#fef2ef`/`#F95738` (smart-contract), `#5c0aff` (function-metadata), `#F5A623`/`#7A4F00` (import warning), and any `'red!important'` leftovers. Anything else → convert.

- [ ] **Step 3: Package build gate**

```bash
cd /Users/maitrakhatri/Developer/fileverse-dsheet && npm run build
```
Expected: `tsc && vite build` completes with no errors. (className edits shouldn't affect types; this confirms nothing else broke.)

- [ ] **Step 4: Full five-theme visual pass**

In the demo, cycle Light → Dark → Sepia → Keith → Naomiii and walk every chrome surface: toolbar wrapper, all four right-sidebar panels, comment sidebar + cell popup + inline popup, permission/collab chips, skeleton loader, import/export menus, smart-contract block, dialogs. Confirm: no white-on-white, no black-on-black, no stuck light/dark surfaces. Selection accent (`#efc703`) and brand accents look correct on every background. Grid canvas stays light (expected — Phase 2).

- [ ] **Step 5: STOP — final manual test.** Commit if desired.

---

## Notes for the executor

- If a needed semantic token genuinely doesn't exist in `@fileverse/ui`, prefer the closest existing `.color-*` over re-introducing a hardcoded value, and flag it — do not invent token names. Available families (from THEMES.md §4.2): `color-bg-{default,hover,active,selected,secondary,brand,danger,default-inverse,tertiary,success,info-light}`, `color-text-{default,secondary,disabled,danger,success,inverse,link,on-brand}`, `color-border-{default,hover,active,focused,danger,success,info,disabled}`, `color-icon-{...}`, `color-bg-tooltip`, `color-text-tooltip`.
- Grid/canvas (`src/sheet-engine/**`) is Phase 2 — do not touch it in this plan.
```
