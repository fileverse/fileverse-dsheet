# Sidebar UI Migration — What Moved Into `@fileverse-dev/dsheet`

**Date:** 2026-06-24
**Status:** Done (in-package), verified against the `demo/` app
**Related:** [`docs/superpowers/specs/2026-06-12-dsheet-drop-in-package-design.md`](./superpowers/specs/2026-06-12-dsheet-drop-in-package-design.md), [`docs/superpowers/plans/2026-06-24-sidebar-ui-migration.md`](./superpowers/plans/2026-06-24-sidebar-ui-migration.md)

This records what was moved from the `dsheets.new` consumer into the package so the package ships a working right-sidebar with zero consumer wiring. The consumer-side cleanup (deleting the now-duplicated code) is tracked separately in `dsheets.new/docs/sidebar-migration-cleanup.md`.

---

## Scope

**Migrated:** the right-sidebar system + 4 built-in panels — `templates`, `data-verification`, `conditional-format`, `functions`.

**NOT migrated (still owned by `dsheets.new`):**
- Comments sidebar + comment-cell popup (own future migration; tangled with crypto/IPFS/ENS/RTC).
- Navbar menus (file/edit/view/insert/format/data/help) and the shortcuts modal.
- `smart-contract-list-view` panel (app-specific; stays a consumer `customPanel`).

---

## New public API

### `editorValues` (passed to `renderNavbar`)
Two new members:
```ts
interface EditorValues {
  sheetEditorRef: RefObject<WorkbookInstance>;
  currentDataRef: MutableRefObject<Sheet[] | null>;
  ydocRef: RefObject<Y.Doc | null>;
  openPanel: (panelId: string) => void;   // NEW
  closePanel: () => void;                  // NEW
}
```

### `customPanels` prop on `<DSheetEditor>`
```ts
customPanels?: PanelConfig[];

interface PanelConfig {
  id: string;
  header: { title: string; subtitle?: string };
  width?: string;        // default '380px'
  content: React.ReactNode;
}
```
Custom panels render in the same sidebar alongside built-ins. Open them via `openPanel('<id>')`. Opening an unregistered id is a no-op (the sidebar stays closed via an `activePanelConfig !== null` guard).

### New exports (`src/index.ts`)
```ts
export type { PanelConfig, PanelId, BuiltInPanelType } from './editor/types';
```

`BuiltInPanelType = 'templates' | 'comments' | 'functions' | 'data-verification' | 'conditional-format'`
`PanelId = BuiltInPanelType | string`

---

## Architecture

```
EditorProvider (existing)
└─ SidebarProvider (NEW — wraps children, reads isReadOnly)
   └─ EditorContent
      ├─ <nav> renderNavbar(editorValues)         // consumer navbar, now gets openPanel
      ├─ React.memo(EditorWorkbook)               // FortuneCore sheet — memoized so panel
      │                                            //   toggles never re-render it
      ├─ hidden <button>s                          // FortuneCore fires these by id
      │    #data-verification-button  → togglePanel('data-verification')
      │    #conditional-format-button → openPanel('conditional-format')
      │    #function-button           → openPanel('functions') + bump suggestion counter
      │    #smartcontract-button      → openPanel('smart-contract-list-view')  // no-op unless consumer registers it
      └─ EditorRightSidebar                        // sliding drawer; renders activePanelConfig
```

- **`useRightPanels`** owns `activePanel`/`isOpen` + `openPanel/closePanel/togglePanel/isActive`, localStorage persistence (keys `dsheets-active-panel`, `dsheets-active-panel-state`), mobile detection, read-mode gating (read mode allows only `comments`), and first-load auto-open of `templates` on the owner editor.
- **`SidebarProvider`/`useSidebar`** expose that state to the whole editor tree (including `renderNavbar`).
- **`EditorRightSidebar`** picks `top`/`height` by mode (edit: `top 83px` = 44px navbar + ~39px toolbar; read: `top 44px`) so it never overlaps the FortuneCore toolbar.

---

## Files created

| File | Responsibility |
|---|---|
| `src/editor/components/sidebar/use-right-panels.ts` | panel state hook (ported, app deps stripped) |
| `src/editor/components/sidebar/sidebar-context.tsx` | `SidebarProvider` + `useSidebar()` |
| `src/editor/components/sidebar/right-sidebar.tsx` | `RightSidebar` + `RightSidebarHeader` layout primitives |
| `src/editor/components/sidebar/editor-right-sidebar.tsx` | drawer: header + close + active panel content; mode-based offsets |
| `src/editor/components/sidebars/data-verification.tsx` | placeholder `#placeholder-data-verification` (FortuneCore portals in) |
| `src/editor/components/sidebars/conditional-format.tsx` | placeholder `#placeholder-conditional-format` |
| `src/editor/components/sidebars/templates.tsx` | Templates panel (search/categories/cards) |
| `src/editor/components/sidebars/template-ui.tsx` | `Template` type, `TemplateCard`, `TemplatePreview` |
| `src/editor/components/sidebars/function-content.tsx` | Functions ("Learn More") panel |
| `src/editor/components/sidebars/function/function-categories.tsx` | function category chips |
| `src/editor/components/sidebars/function/function-categories-logic.ts` | category grouping logic |
| `src/editor/components/sidebars/function/function-metadata.tsx` | selected-function detail + API-key entry |
| `src/editor/components/sidebars/function/functionList.tsx` | function list |
| `src/editor/components/sidebars/function/types.ts` | function types |
| `src/editor/components/sidebars/function/use-functions.tsx` | functions state hook |
| `src/editor/utils/api-keys-local-storage.ts` | `ApiKeyStorageHelper` (localStorage; data-block API keys) |

## Files modified

| File | Change |
|---|---|
| `src/editor/types.ts` | `EditorValues` += `openPanel`/`closePanel`; new `PanelConfig`; `DsheetProps` += `customPanels`; re-export `PanelId`/`BuiltInPanelType` |
| `src/editor/contexts/editor-context.tsx` | wrap children in `<SidebarProvider isReadMode={isReadOnly}>` |
| `src/editor/dsheet-editor.tsx` | consume `useSidebar`; build `builtInPanels`/`activePanelConfig`; add `openPanel`/`closePanel` to `editorValues`; render `EditorRightSidebar`; hidden trigger buttons; `openTemplatesPanel` (`useCallback`) into the toolbar; functions suggestion counter |
| `src/editor/components/editor-workbook.tsx` | wrap export in `React.memo` (stops panel-toggle glitch) |
| `src/editor/styles/index.css` | add `.no-scrollbar` utility (was consumer-only) |
| `src/index.ts` | export `PanelConfig`, `PanelId`, `BuiltInPanelType` |

> `src/editor/utils/custom-toolbar-item.tsx` was **not** changed — its Templates button already called `toggleTemplateSidebar`; `EditorContent` now passes `() => togglePanel('templates')` into that slot.

---

## App-specific couplings resolved (functions panel)

The function panel was the only coupled panel. Four consumer imports were replaced:

| Consumer import | Replacement |
|---|---|
| `@/db/db` `KeyStoreCache` (type) | `Record<string, string>` |
| `next/navigation` `useSearchParams` | one-shot `new URLSearchParams(window.location.search)` read |
| `@/utils/constants` `API_KEY_PLACEHOLDER` | package's existing `src/sheet-engine/react/constants.ts` |
| `@/utils/proxy-service` `ProxyService.isProxyEnabled()` | `process.env.NEXT_PUBLIC_PROXY_MODE === 'true'` |

---

## Fixes discovered during verification

- **`no-scrollbar`** was a consumer-only CSS utility — added to the package CSS so migrated placeholder divs don't show native scrollbars.
- **Panel width** — FortuneCore's data-validation UI is hard-coded `345px`; panel widths set so the card fits it without a right-side gap.
- **Sidebar overlapped the toolbar** — `EditorRightSidebar` now offsets `top`/`height` by `isReadOnly`.
- **UI glitch on panel toggle** — panel state lives in `EditorContent`, which was re-rendering the heavy FortuneCore `<Workbook>`. Fixed by `React.memo(EditorWorkbook)` (it subscribes only to `EditorContext`, not the sidebar context) + stabilizing the toolbar callback.

---

## Notes

- `usehooks-ts` (`useMediaQuery`) is used by the new hook but is **bundled** by Vite (not in `rollupOptions.external`), so no new consumer dependency is required.
- Lint: the migrated files carry a few `any`/`@ts-ignore` findings inherited verbatim from the consumer source, consistent with the package's existing lint state.
