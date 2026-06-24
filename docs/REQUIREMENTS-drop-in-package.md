# Requirements: Make `@fileverse-dev/dsheet` a Complete Drop-In Package

## Context for the LLM

You are working across two repos:

- **Package:** `/Users/maitrakhatri/Developer/fileverse-dsheet` — published as `@fileverse-dev/dsheet`
- **Consumer app:** `/Users/maitrakhatri/Developer/dsheets.new` — Next.js app that uses the package

The package exports a `<DSheetEditor>` React component (spreadsheet editor). Right now it is NOT a true drop-in — critical UI lives in `dsheets.new` and any third-party consumer has to re-implement it. The goal is to move that UI into the package so a new consumer gets a fully functional editor with near-zero wiring.

**Do NOT commit. The user commits manually.**

---

## What Needs to Move

These components live in `dsheets.new` and must move into the package:

| Feature | Source in dsheets.new | Destination in package |
|---|---|---|
| Right sidebar system | `components/right-sidebar-wrapper/` | `src/editor/components/sidebar/` (internal) |
| Data Validation UI | `components/right-sidebar-wrapper/data-verification.tsx` | `src/editor/components/sidebars/data-verification.tsx` |
| Conditional Formatting UI | `components/right-sidebar-wrapper/conditional-format.tsx` | `src/editor/components/sidebars/conditional-format.tsx` |
| Templates Sidebar | `components/template/templates.tsx` (+ `template-ui.tsx`) | `src/editor/components/sidebars/templates.tsx` |
| Function Learn More Sidebar | `components/function/function-content.tsx` (+ all files in `components/function/`) | `src/editor/components/sidebars/function-content.tsx` |
| Comments Sidebar UI | `components/comment-section/components/comment-sidebar.tsx` (+ supporting files) | `src/editor/components/comments/comment-sidebar.tsx` |
| Comment Cell Popup UI | `components/comment-section/components/comment-cell-popup/` | `src/editor/components/comments/comment-cell-popup.tsx` |

> **Navbar is NOT migrated.** All navbar menus (file/edit/view/insert/format/data/help) and app-specific navbar items stay in `dsheets.new`. The existing navbar keeps calling `openPanel`, now sourced from `editorValues` (Phase 1).

---

## What Stays in dsheets.new (Do NOT Move)

- **The entire navbar** (`components/navbar/` — all menus and app-specific items). The consumer keeps its own navbar and wires items to `openPanel` from `editorValues`.
- Comment storage, syncing, crypto, IPFS utilities (`components/comment-section/hooks/`, `components/comment-section/utils/`)
- Comment types that reference `@/db/comments/types` (app-specific DB layer)
- Auth providers, wallet providers, RTC provider

---

## Migration Strategy: 2 Phases

Work through phases in order. Each phase must leave `dsheets.new` working.

**Out of scope:** Navbar menu components are NOT migrated (see above).

---

## PHASE 1: Sidebar Infrastructure

### Goal
Add a sidebar system inside the package. No panel content yet — just the infrastructure and the extensibility API.

### New Files to Create in Package

**`src/editor/components/sidebar/use-right-panels.ts`**

Adapted from `dsheets.new/components/right-sidebar-wrapper/use-right-panels.ts`. Remove all app-specific dependencies:
- Remove `useAccountContext` import
- Remove `useSearchParams` (Next.js specific)
- Remove `removeQuery` import
- Remove the `identityInitialized` guard and `searchQuery` URL-based panel opening (those are app-specific)
- Remove `SIDEBAR_STATE_KEY` from dsheets constants — use a local constant `'dsheets-active-panel-state'`
- Keep: localStorage persistence, mobile detection, isReadMode logic, openPanel/closePanel/togglePanel/isActive

```ts
export type BuiltInPanelType =
  | 'templates'
  | 'comments'
  | 'functions'
  | 'data-verification'
  | 'conditional-format';

export type PanelId = BuiltInPanelType | string; // string allows custom panels
```

**`src/editor/components/sidebar/sidebar-context.tsx`**

React context wrapping `useRightPanels`. Provides `openPanel`, `closePanel`, `togglePanel`, `activePanel`, `isOpen`, `isActive`. Integrated into `EditorProvider` (see below).

**`src/editor/components/sidebar/right-sidebar.tsx`**

Adapted from `dsheets.new/components/right-sidebar-wrapper/right-sidebar-layout.tsx`. Keep the `RightSidebar`, `RightSidebarHeader`, `RightSidebarContent` components. Remove Next.js `'use client'` directives (package is framework-agnostic). The `top` and `height` offsets currently hardcoded for preview vs edit mode (`83px` vs `44px`) should be driven by props or CSS variables.

**`src/editor/components/sidebar/editor-right-sidebar.tsx`**

Adapted from `dsheets.new/components/dsheet-editor/right-sidebar.tsx`. Renders `RightSidebar` + `RightSidebarHeader` with close button + `activePanelConfig.content`. Takes `isOpen`, `activePanelConfig`, `onClose` props.

### Changes to Existing Package Files

**`src/editor/contexts/editor-context.tsx`**

Wrap the context provider with `SidebarProvider` so all components in the editor tree (including those rendered via `renderNavbar`) can call `openPanel`. The `EditorProvider` already wraps everything — add `SidebarProvider` inside it.

**`src/editor/dsheet-editor.tsx`**

1. Add `customPanels?: PanelConfig[]` to `DsheetProps`
2. Add `openPanel` and `closePanel` to `EditorValues` (the object passed to `renderNavbar`)
3. Render `<EditorRightSidebar>` inside `EditorContent`, driven by sidebar context state
4. Pass `customPanels` into the sidebar system for rendering

**`src/editor/types.ts`**

Add new exported types:

```ts
export interface PanelConfig {
  id: string;
  header: {
    title: string;
    subtitle?: string;
  };
  width?: string; // default: '380px'
  content: React.ReactNode;
}

// Update EditorValues:
export interface EditorValues {
  sheetEditorRef: RefObject<WorkbookInstance>;
  currentDataRef: React.MutableRefObject<Sheet[] | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  openPanel: (panelId: string) => void;   // NEW
  closePanel: () => void;                  // NEW
}
```

**`src/index.ts`**

Export `PanelConfig` type.

### Remove from dsheets.new (after Phase 1 migration)

Do NOT remove yet — wait until all phases are complete. See "dsheets.new migration" section at bottom.

### Phase 1 Verification

Consumer can pass `customPanels` and call `openPanel('my-panel')` from `renderNavbar`:

```tsx
<DSheetEditor
  customPanels={[{
    id: 'my-panel',
    header: { title: 'Custom Panel' },
    content: <div>Hello</div>,
  }]}
  renderNavbar={({ openPanel }) => (
    <button onClick={() => openPanel('my-panel')}>Open Panel</button>
  )}
/>
```

---

## PHASE 2: Panel Content + Comments UI

### Goal
Move all sidebar panel contents and comment UI into the package. Wire them into the built-in sidebar. Update `DsheetProps` API.

### Key Technical Note: Hidden DOM Button Pattern

Currently `dsheets.new` has hidden `<button>` elements that FortuneCore fires via `document.getElementById(...).click()`:

```tsx
<button id="data-verification-button" onClick={() => togglePanel('data-verification')} className="hidden" />
<button id="conditional-format-button" onClick={() => openPanel('conditional-format')} className="hidden" />
<button id="function-button" onClick={() => { openPanel('functions'); setShouldHandleSuggestionFromCell(prev => prev + 1); }} className="hidden" />
```

**Phase 2 removes these hidden buttons.** Replace by wiring `openPanel` from `SidebarContext` inside the package. The `FortuneCore` sheet engine fires DOM click events on these IDs — find where in `@sheet-engine/core` or `@sheet-engine/react` these IDs are referenced and replace with direct context calls or keep the IDs but render the hidden buttons internally inside `EditorContent` in the package (simpler and safer).

**Recommended:** Keep the hidden buttons but render them inside the package's `EditorContent` component (not in `dsheets.new`). They call `openPanel` from sidebar context. This avoids touching `@sheet-engine/core`.

### New Files to Create in Package

**`src/editor/components/sidebars/data-verification.tsx`**

Direct copy from `dsheets.new/components/right-sidebar-wrapper/data-verification.tsx`. Currently a placeholder `<div id="placeholder-data-verification">` — FortuneCore mounts its own UI into this DOM node. Keep the placeholder div with the same ID.

**`src/editor/components/sidebars/conditional-format.tsx`**

Direct copy from `dsheets.new/components/right-sidebar-wrapper/conditional-format.tsx`. Same as above — placeholder div with `id="placeholder-conditional-format"`.

**`src/editor/components/sidebars/templates.tsx`**

Adapted from `dsheets.new/components/template/templates.tsx`. Also needs `template-ui.tsx` (the `TemplateCard`, `TemplatePreview`, `Template` type). Copy both. Dependencies: `@fileverse-dev/dsheets-templates` (already in package's `package.json`), `@fileverse/ui`. No app-specific imports.

The `Templates` component needs two props from the package internals:
- `setSelectedTemplate: (slug: string | null) => void` — called when user picks a template; package wires this to `useApplyTemplatesBtn` (already in package)
- `setHoveredTemplate` — for the preview card

Since `setSelectedTemplate` in the package hooks into `useApplyTemplatesBtn` (already exists at `src/editor/hooks/use-apply-templates.tsx`), wire via context rather than props. Or pass via the built-in panel config.

**`src/editor/components/sidebars/function-content.tsx`** (+ supporting files)

Adapted from `dsheets.new/components/function/`. Move all files:
- `function-content.tsx` → `src/editor/components/sidebars/function-content.tsx`
- `function-categories.tsx` → `src/editor/components/sidebars/function/function-categories.tsx`
- `function-categories-logic.ts` → same
- `function-metadata.tsx` → same
- `functionList.tsx` → same
- `hooks/use-functions.tsx` → same
- `types.ts` → same
- `api-keys/local-storage-helper.ts` → `src/editor/utils/api-keys-local-storage.ts`

Dependencies: `@fileverse-dev/formulajs` (already in package), `@fileverse/ui`. No app-specific imports.

**`src/editor/components/comments/comment-sidebar.tsx`**

Adapted from `dsheets.new/components/comment-section/components/comment-sidebar.tsx`.

**Strip these app-specific imports:**
- `useENSName` — remove ENS name resolution. Just render `userName` as-is.
- `useRTCContext` — remove. The RTC collab avatar display in the comments sidebar is app-specific.
- `Image` from `next/image` — replace with `<img>` tag.
- `CommentsItem` from `@/db/comments/types` — define a local `CommentThread` type in the package (see types section below).

The component takes `CommentsContentProps` — these props are provided by the consumer via `commentsConfig`.

**`src/editor/components/comments/comment-cell-popup.tsx`**

Adapted from `dsheets.new/components/comment-section/components/comment-cell-popup/comment-cell-popup.tsx` and `use-comment-cell-popup.ts`.

Strip app-specific imports. Add `unauthenticatedFallback?: ReactNode` prop — render it when consumer doesn't pass comment handlers (i.e. user not authenticated from consumer's perspective).

Also copy supporting comment UI components (they have no app-specific deps):
- `comment-input.tsx` → `src/editor/components/comments/comment-input.tsx`
- `comment-item.tsx` → `src/editor/components/comments/comment-item.tsx`
- `comment-actions-dropdown.tsx` → same
- `comment-sidebar-empty.tsx` → same

> **Shortcuts modal is NOT migrated.** `components/shortcuts-popup/shortcuts-popup.tsx` stays in `dsheets.new` — it is triggered by the consumer-owned help menu (`window` CustomEvent `'openShortcuts'`).

### New Types in Package

Add to `src/editor/types.ts` (or a new `src/editor/types/comments.ts`):

```ts
// Minimal comment thread type for package UI
// Consumer's full Comment type (with blockchain fields etc.) should extend this
export interface CommentThread {
  id: string;
  key: string;
  username: string;
  content: string;
  createdAt: string;
  replies: CommentReply[];
  isResolved?: boolean;
  isDeleted?: boolean;
}

export interface CommentReply {
  id: string;
  username: string;
  content: string;
  createdAt: string;
  commentIndex: number;
}

export enum CommentAction {
  RESOLVE = 'resolve',
  UNRESOLVE = 'unresolve',
  DELETE = 'delete',
}

export interface CommentActionParams {
  action: CommentAction;
  commentId: string;
  dsheetId: string;
  commentKey: string;
  isReply?: boolean;
  parentCommentId?: string;
  row: number;
  col: number;
}

export interface CommentsConfig {
  commentsData: Record<string, CommentThread>;
  onSendComment: (key: string, textareaId: string) => void;
  onCommentAction: (action: CommentActionParams) => void;
  userName?: string;
  ownerAddress?: string;
  unauthenticatedFallback?: React.ReactNode;
}
```

### Changes to `DsheetProps` in `src/editor/types.ts`

**Remove:**
- `commentData?: Object`
- `getCommentCellUI?: ComponentProps<typeof Workbook>['getCommentCellUI']`
- `allowComments?: boolean`
- `toggleTemplateSidebar?: () => void`
- `isTemplateOpen?: boolean`

**Add:**
- `commentsConfig?: CommentsConfig`
- `customPanels?: PanelConfig[]` (from Phase 1)

**Unchanged (keep all of these):**
- `dsheetId`, `isNewSheet`, `onChange`, `isReadOnly`, `allowSheetDownload`
- `collaboration`, `username`, `portalContent`, `enableIndexeddbSync`
- `renderNavbar`, `sheetEditorRef`, `editorStateRef`
- `isAuthorized`, `getDocumentTitle`, `updateDocumentTitle`
- `onboardingComplete`, `onboardingCompleteLocalStorageKey`, `onboardingHandler`
- `dataBlockApiKeyHandler`, `storeApiKey`
- `setFetchingURLData`, `setShowFetchURLModal`, `setInputFetchURLDataBlock`
- `setShowSmartContractModal`, `handleSmartContractQuery`
- `onDataBlockApiResponse`, `onDuneChartEmbed`, `onSheetCountChange`
- `enableLiveQuery`, `liveQueryRefreshRate`
- `setSelectedTemplate` (keep for backward compat — how consumer sets the selected template from outside)

### Built-in Panel Registration (inside `src/editor/dsheet-editor.tsx`)

The package auto-registers 5 built-in panels. Consumer gets them for free. Add inside `EditorContent`:

```tsx
const builtInPanels: PanelConfig[] = [
  {
    id: 'comments',
    header: { title: 'Comments' },
    width: '380px',
    content: commentsConfig ? (
      <CommentsContent
        sheetEditorRef={sheetEditorRef}
        userName={commentsConfig.userName}
        commentsData={commentsConfig.commentsData}
        onSendComment={commentsConfig.onSendComment}
        onCommentAction={commentsConfig.onCommentAction}
        ownerAddress={commentsConfig.ownerAddress}
      />
    ) : null,
  },
  {
    id: 'templates',
    header: { title: 'Templates', subtitle: 'Start with pre-built templates...' },
    width: '380px',
    content: <Templates setSelectedTemplate={...} setHoveredTemplate={...} />,
  },
  {
    id: 'data-verification',
    header: { title: 'Data Validation' },
    width: '380px',
    content: <DataVerification />,
  },
  {
    id: 'conditional-format',
    header: { title: 'Conditional Formatting' },
    width: '380px',
    content: <ConditionalFormat />,
  },
  {
    id: 'functions',
    header: { title: 'Function' },
    width: '380px',
    content: <FunctionContent sheetEditorRef={sheetEditorRef} shouldHandleSuggestionFromCell={...} />,
  },
  ...(customPanels ?? []),
];
```

If `commentsConfig` is not passed → `comments` panel is omitted from the list (not rendered, comment markers disabled).

### Hidden Buttons (replace the DOM trigger pattern)

Inside `EditorContent` in the package, render these hidden buttons wired to sidebar context:

```tsx
<button id="function-button" className="hidden" onClick={() => openPanel('functions')} />
<button id="data-verification-button" className="hidden" onClick={() => togglePanel('data-verification')} />
<button id="conditional-format-button" className="hidden" onClick={() => openPanel('conditional-format')} />
<button id="smartcontract-button" className="hidden" onClick={() => openPanel('smart-contract-list-view')} />
```

Note: `smart-contract-list-view` is dsheets.new-specific. The button for it should still be rendered (FortuneCore fires it), but the panel won't be registered unless consumer passes it via `customPanels`. The `openPanel` call will no-op if the panel ID isn't registered.

### Wire `getCommentCellUI` inside the package

`@sheet-engine/react`'s `<Workbook>` component accepts `getCommentCellUI`. Currently dsheets.new passes this prop from outside. After Phase 2, the package builds it internally using `CommentsConfig`:

Inside `EditorWorkbook` (at `src/editor/components/editor-workbook.tsx`), construct `getCommentCellUI` from `commentsConfig`:

```ts
const getCommentCellUI = commentsConfig
  ? (row, col, dragHandler, isHover) => (
      <CommentCellUI
        row={row}
        col={col}
        sheetId={getCurrentSheetId(sheetEditorRef)}
        comment={commentsConfig.commentsData[`${sheetId}_${row}_${col}`]}
        onSendComment={(key, textareaId) => commentsConfig.onSendComment(key, textareaId)}
        onAction={commentsConfig.onCommentAction}
        ownerAddress={commentsConfig.ownerAddress}
        sheetEditorRef={sheetEditorRef}
        unauthenticatedFallback={commentsConfig.unauthenticatedFallback}
        dragHandler={dragHandler}
        isHover={isHover}
      />
    )
  : undefined;
```

### Exports to Add to `src/index.ts`

```ts
// Exported components (consumers can use these standalone)
export { CommentsContent } from './editor/components/comments/comment-sidebar';
export { CommentCellUI } from './editor/components/comments/comment-cell-popup';

// Exported types
export type {
  CommentsConfig,
  CommentThread,
  CommentReply,
  CommentAction,
  CommentActionParams,
  PanelConfig,
} from './editor/types';
```

### Phase 2 Verification

```tsx
<DSheetEditor
  dsheetId={id}
  isAuthorized={true}
  isNewSheet={false}
  onChange={handleChange}
  commentsConfig={{
    commentsData: myCommentsData,
    onSendComment: handleSendComment,
    onCommentAction: handleCommentAction,
    userName: 'alice',
    unauthenticatedFallback: <p>Please log in to comment</p>,
  }}
/>
// Templates, DataVerification, ConditionalFormat, FunctionContent sidebars
// all work with zero additional wiring.
```

---

## dsheets.new Migration (after both phases)

After both phases are complete, update `dsheets.new` to remove the duplicated code and use the package-exported versions. The navbar is left untouched.

### Files to Delete from dsheets.new

```
components/right-sidebar-wrapper/use-right-panels.ts
components/right-sidebar-wrapper/right-panels-context.tsx
components/right-sidebar-wrapper/right-sidebar-layout.tsx
components/right-sidebar-wrapper/data-verification.tsx
components/right-sidebar-wrapper/conditional-format.tsx
components/right-sidebar-wrapper/sidebar-panel-config.ts
components/template/templates.tsx
components/template/template-ui.tsx
components/function/function-content.tsx
components/function/function-categories.tsx
components/function/function-categories-logic.ts
components/function/function-metadata.tsx
components/function/functionList.tsx
components/function/hooks/use-functions.tsx
components/function/types.ts
components/comment-section/components/comment-sidebar.tsx
components/comment-section/components/comment-cell-popup/comment-cell-popup.tsx
components/comment-section/components/comment-cell-popup/use-comment-cell-popup.ts
components/comment-section/components/comment-input.tsx
components/comment-section/components/comment-item.tsx
components/comment-section/components/comment-actions-dropdown.tsx
components/comment-section/components/comment-sidebar-empty.tsx
```

> Navbar files (`components/navbar/**`) and `components/shortcuts-popup/` are NOT deleted — the navbar and shortcuts modal stay in `dsheets.new` as-is.

**Keep in dsheets.new:**
```
components/navbar/                      (entire navbar — all menus + app-specific items, unchanged)
components/comment-section/hooks/       (all comment storage/sync logic — stays forever)
components/comment-section/utils/       (same)
components/comment-section/types/comment-types.ts  (app's extended Comment type — stays)
```

### Changes to `dsheets.new/components/dsheet-editor/dsheet-editor.tsx`

Replace current sidebar management with the package's built-in system:

1. **Remove** `useRightPanelsContext`, `RightSidebarContent`, `EditorRightSidebar`, `sidebarPanels`, `activePanelConfig`
2. **Remove** all `createXxxSidebarPanel` calls
3. **Remove** `isOpen`, `activePanel`, `togglePanel`, `openPanel`, `closePanel` from local state (these now live inside `DSheetEditor`)
4. **Remove** props from `DSheetEditor` call: `commentData`, `getCommentCellUI`, `allowComments`, `toggleTemplateSidebar`, `isTemplateOpen`
5. **Add** `commentsConfig` prop built from existing `useComments` hook
6. **Add** `customPanels` for dsheets.new-specific panels (smart-contract-list-view stays as a custom panel)
7. **Add** `openPanel` from `renderNavbar`'s `editorValues` → pass to `<Navbar>`
8. **Remove** hidden DOM buttons (they move into the package)

For the `smart-contract-list-view` panel (dsheets.new-specific, NOT in package):

```tsx
customPanels={[
  {
    id: 'smart-contract-list-view',
    header: { title: 'My smart contracts' },
    width: '380px',
    content: <SmartContractListView ... />,
  }
]}
```

---

## Important Technical Notes

### `@sheet-engine/react` and `@sheet-engine/core`

These are internal/private packages that back the spreadsheet engine (LuckySheet-based). You cannot modify them. All interaction is via the exported API from the package (`WorkbookInstance`, FortuneCore functions). Do not add new peer dependencies on these packages in the package's `package.json`.

### Framework Agnosticism

The package is framework-agnostic (React only, no Next.js). When adapting components from `dsheets.new`:
- Remove all `'use client'` directives
- Replace `next/image` with `<img>`
- Replace `next/navigation` hooks with nothing (or browser APIs)
- Replace `@/` path aliases with relative imports

### Dependency Boundaries

The package already has these deps — safe to use in migrated components:
- `@fileverse/ui` (UI components: Button, IconButton, DynamicModal, Popover, etc.)
- `@fileverse-dev/dsheets-templates` (template data)
- `@fileverse-dev/formulajs` (formula functions)
- `@sheet-engine/react` and `@sheet-engine/core` (already internal)
- `yjs`, `classnames`, `dayjs`, `lodash`, `react`

Do NOT add new dependencies without checking `package.json` first.

### Build System

Package uses Vite + `vite-plugin-dts`. Run `npm run build` from `fileverse-dsheet/` to verify. After changes, run `npm run dev:link` to copy dist to `dsheets.new/node_modules/@fileverse-dev/dsheet/dist/` for local testing.

### DataVerification and ConditionalFormat Are Placeholders

`data-verification.tsx` and `conditional-format.tsx` are currently just empty `<div>` placeholders with specific IDs (`placeholder-data-verification`, `placeholder-conditional-format`). FortuneCore mounts its own UI into these DOM nodes via ID. Keep the IDs exactly as-is when moving these components.

---

## Spec File Reference

Full design doc with rationale: `docs/superpowers/specs/2026-06-12-dsheet-drop-in-package-design.md`
