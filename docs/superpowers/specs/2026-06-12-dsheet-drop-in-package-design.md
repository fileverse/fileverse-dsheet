# dsheet Drop-In Package Design

**Date:** 2026-06-12  
**Status:** Approved  
**Repo:** `fileverse-dev/dsheet` (package) + `dsheets.new` (consumer reference)

---

## Goal

Make `@fileverse-dev/dsheet` a complete drop-in package. A new consumer should be able to install it, render `<DSheetEditor>`, and get a fully functional spreadsheet editor — including sidebar panels (comments, templates, data validation, conditional formatting, function reference) — with minimal wiring. The consumer supplies their own navbar and shortcuts modal, and wires navbar items to the package's `openPanel`.

Currently, critical UI (all sidebar panels, comment UI) lives in the `dsheets.new` consumer app. Any third-party consumer must re-implement all of it. (The navbar and shortcuts modal stay consumer-owned by design — see "Out of scope" below.)

---

## What Moves from Consumer → Package

| Feature | Consumer location today | Destination |
|---|---|---|
| Right sidebar system | `components/right-sidebar-wrapper/` | `src/editor/components/sidebar/` (internal) |
| Data Validation UI | `right-sidebar-wrapper/data-verification.tsx` | `src/editor/components/sidebars/data-verification.tsx` |
| Conditional Formatting UI | `right-sidebar-wrapper/conditional-format.tsx` | `src/editor/components/sidebars/conditional-format.tsx` |
| Templates Sidebar | `components/template/templates.tsx` | `src/editor/components/sidebars/templates.tsx` |
| Function Learn More Sidebar | `components/function/function-content.tsx` | `src/editor/components/sidebars/function-content.tsx` |
| Comments Sidebar UI | `components/comment-section/components/comment-sidebar.tsx` | `src/editor/components/comments/comment-sidebar.tsx` |
| Comment Cell Popup UI | `components/comment-section/components/comment-cell-popup/` | `src/editor/components/comments/comment-cell-popup.tsx` |

**Comment storage/state stays consumer-side.** Package provides UI only.  
**The entire navbar stays consumer-side.** All menus (File/Edit/View/Insert/Format/Data/Help) and app-specific items (share, publish, delete, auth) remain in `dsheets.new` and are NOT migrated. The consumer's existing navbar keeps calling `openPanel` — now sourced from `editorValues` (Phase 1) instead of consumer-local sidebar state.

---

## Migration Strategy: 2 Phases

### Phase 1 — Sidebar Infrastructure
### Phase 2 — Panel Content + Comments UI

Each phase ships independently. `dsheets.new` keeps working throughout. Regressions are isolated to each phase's diff.

**Out of scope:** Navbar menu components are NOT migrated. The edit/view/insert/format/data/help menus (and file menu) stay in `dsheets.new` as-is. The shortcuts modal also stays consumer-side (it is triggered by the consumer-owned help menu).

---

## Phase 1: Sidebar Infrastructure

### New Internal Components

**`useRightPanels` hook** (internal to package):
- State: `activePanel: string | null`, `isOpen: boolean`
- API: `openPanel(id: string)`, `closePanel()`, `togglePanel(id: string)`

**`RightSidebarLayout` component** (internal):
- Sliding drawer anchored right
- Renders header (title + optional subtitle) + content slot
- Width driven by active panel config

**`RightSidebarProvider` context** (internal):
- Provided by `EditorProvider`
- Any component in the editor tree can call `openPanel` via context
- Replaces all hidden DOM button triggers (`#data-verification-button`, `#conditional-format-button`, `#function-button`, `#smartcontract-button`)

### API Changes to `DSheetEditor`

**`EditorValues`** — extended with panel controls passed to `renderNavbar`:

```ts
interface EditorValues {
  sheetEditorRef: RefObject<WorkbookInstance>;
  currentDataRef: MutableRefObject<Sheet[] | null>;
  ydocRef: RefObject<Y.Doc | null>;
  openPanel: (panelId: string) => void;   // NEW
  closePanel: () => void;                  // NEW
}
```

**`PanelConfig`** — new exported type for custom panels:

```ts
export interface PanelConfig {
  id: string;
  header: {
    title: string;
    subtitle?: string;
  };
  width?: string;       // default: '380px'
  content: ReactNode;
}
```

**`DsheetProps`** — new `customPanels` prop:

```ts
customPanels?: PanelConfig[];
```

Custom panels render inside the same sidebar alongside built-in panels. Consumer uses any non-reserved string as the panel ID and calls `openPanel('my-panel-id')` from their `renderNavbar`.

**Reserved built-in panel IDs:** `'comments'` `'templates'` `'data-verification'` `'conditional-format'` `'functions'`

### Phase 1 Deliverable

`<DSheetEditor customPanels={[{ id: 'my-panel', header: { title: 'Custom' }, content: <div>hello</div> }]} />` renders a working sidebar. Consumer can open/close it via `openPanel` from `editorValues`. No panel content migrated yet.

---

## Phase 2: Panel Content + Comments UI

### File Structure

```
src/editor/components/
  sidebars/
    data-verification.tsx
    conditional-format.tsx
    templates.tsx
    function-content.tsx
  comments/
    comment-sidebar.tsx
    comment-cell-popup.tsx
```

### Built-in Panel Auto-Registration

Package auto-registers these inside `DSheetEditor`. No consumer config needed to get them:

| Panel ID | Component | Opens when |
|---|---|---|
| `comments` | `CommentsContent` | consumer calls `openPanel('comments')` |
| `templates` | `Templates` | consumer calls `openPanel('templates')` |
| `data-verification` | `DataVerification` | FortuneCore fires internally via context |
| `conditional-format` | `ConditionalFormat` | FortuneCore fires internally via context |
| `functions` | `FunctionContent` | FortuneCore fires internally via context |

`data-verification`, `conditional-format`, `functions` previously relied on hidden DOM buttons. Phase 2 removes those and replaces them with direct `openPanel` calls via `RightSidebarProvider` context.

### Comments API

**Removed props:** `commentData`, `getCommentCellUI`, `allowComments`, `toggleTemplateSidebar`, `isTemplateOpen`

**New prop:**

```ts
export interface CommentsConfig {
  commentsData: Record<string, CommentThread>;
  onSendComment: (key: string, textareaId: string) => void;
  onCommentAction: (action: CommentActionParams) => void;
  userName?: string;
  ownerAddress?: string;
  unauthenticatedFallback?: ReactNode;
}

// on DsheetProps:
commentsConfig?: CommentsConfig;
```

- `commentsData` — map of `sheetId_row_col` → comment thread. Consumer owns fetching/syncing.
- `onSendComment` / `onCommentAction` — consumer owns persistence.
- `unauthenticatedFallback` — rendered inside `CommentCellUI` when user is not authenticated. Replaces hardcoded `<AuthCTA />`. If omitted, comment cell popup shows nothing.
- If `commentsConfig` is omitted entirely — comments panel hidden, inline comment markers disabled.

### Exported Components

```ts
// sidebar panel contents (for consumers who want to use them standalone)
export { CommentsContent } from './editor/components/comments/comment-sidebar';
export { CommentCellUI } from './editor/components/comments/comment-cell-popup';
```

The shortcuts modal is NOT migrated — it stays consumer-side (triggered by the consumer-owned help menu).

### Exported Types

```ts
export type { CommentsConfig, PanelConfig, CommentThread, CommentActionParams }
```

### Phase 2 Deliverable

A consumer with no sidebar code in their app gets comments, templates, data validation, conditional formatting, and function reference sidebar for free. Only `commentsConfig` needs wiring.

---

## Final Drop-In Usage (New Consumer)

The navbar is consumer-owned. A consumer builds their own navbar and calls `openPanel` (from `editorValues`) to drive the built-in sidebar panels.

```tsx
import { DSheetEditor } from '@fileverse-dev/dsheet';

function App() {
  return (
    <DSheetEditor
      dsheetId={id}
      isAuthorized={true}
      isNewSheet={false}
      onChange={handleChange}
      enableIndexeddbSync={true}
      commentsConfig={{
        commentsData,
        onSendComment,
        onCommentAction,
        userName,
        unauthenticatedFallback: <LoginPrompt />,
      }}
      customPanels={[]}
      renderNavbar={({ sheetEditorRef, openPanel }) => (
        <>
          {/* Consumer owns the navbar + shortcuts modal. Wire items to openPanel: */}
          <button onClick={() => openPanel('comments')}>Comments</button>
          <button onClick={() => openPanel('templates')}>Templates</button>
          <input placeholder="Untitled" />
          <button>Share</button>
        </>
      )}
    />
  );
}
```

Comments sidebar, templates, data validation, conditional formatting, function reference — all work with zero additional wiring beyond `commentsConfig`. The consumer only needs to wire their own navbar buttons to `openPanel`.

---

## dsheets.new Migration Plan (per phase)

**After Phase 1:**
- Remove `right-sidebar-wrapper/use-right-panels.ts` internal usage
- Remove `right-sidebar-wrapper/right-sidebar-layout.tsx`  
- Remove `right-sidebar-wrapper/right-panels-context.tsx`
- Pass `customPanels` for app-specific panels (smart-contract-list-view)
- Wire `openPanel` from `editorValues` into `<Navbar>`

**After Phase 2:**
- Remove `components/comment-section/components/comment-sidebar.tsx`
- Remove `components/comment-section/components/comment-cell-popup/`
- Remove `components/right-sidebar-wrapper/data-verification.tsx`
- Remove `components/right-sidebar-wrapper/conditional-format.tsx`
- Remove `components/template/templates.tsx`
- Remove `components/function/function-content.tsx`
- Replace `commentData` + `getCommentCellUI` props with `commentsConfig`
- Remove `toggleTemplateSidebar`, `isTemplateOpen` props

**Navbar:** unchanged. `components/navbar/` (all menus + app-specific items) stays in `dsheets.new`. It keeps calling `openPanel`, now passed in from `editorValues`.

---

## Breaking Changes Summary

| Removed prop | Replacement |
|---|---|
| `commentData` | `commentsConfig.commentsData` |
| `getCommentCellUI` | `commentsConfig` (package renders `CommentCellUI` internally) |
| `allowComments` | omit `commentsConfig` to disable |
| `toggleTemplateSidebar` | `openPanel('templates')` via `editorValues` |
| `isTemplateOpen` | internal sidebar state |

All other existing props (`dsheetId`, `onChange`, `isReadOnly`, `collaboration`, `enableIndexeddbSync`, `renderNavbar`, etc.) unchanged.
