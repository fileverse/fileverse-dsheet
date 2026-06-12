# dsheet Drop-In Package Design

**Date:** 2026-06-12  
**Status:** Approved  
**Repo:** `fileverse-dev/dsheet` (package) + `dsheets.new` (consumer reference)

---

## Goal

Make `@fileverse-dev/dsheet` a complete drop-in package. A new consumer should be able to install it, render `<DSheetEditor>`, and get a fully functional spreadsheet editor — including navbar menus, sidebar panels (comments, templates, data validation, conditional formatting, function reference), and a shortcuts modal — with minimal wiring.

Currently, critical UI (navbar menus, all sidebar panels, comment UI, shortcuts) lives in the `dsheets.new` consumer app. Any third-party consumer must re-implement all of it.

---

## What Moves from Consumer → Package

| Feature | Consumer location today | Destination |
|---|---|---|
| Navbar menus (File/Edit/View/Insert/Format/Data/Help) | `components/navbar/` | `src/editor/components/navbar/` |
| Right sidebar system | `components/right-sidebar-wrapper/` | `src/editor/components/sidebar/` (internal) |
| Data Validation UI | `right-sidebar-wrapper/data-verification.tsx` | `src/editor/components/sidebars/data-verification.tsx` |
| Conditional Formatting UI | `right-sidebar-wrapper/conditional-format.tsx` | `src/editor/components/sidebars/conditional-format.tsx` |
| Templates Sidebar | `components/template/templates.tsx` | `src/editor/components/sidebars/templates.tsx` |
| Function Learn More Sidebar | `components/function/function-content.tsx` | `src/editor/components/sidebars/function-content.tsx` |
| Comments Sidebar UI | `components/comment-section/components/comment-sidebar.tsx` | `src/editor/components/comments/comment-sidebar.tsx` |
| Comment Cell Popup UI | `components/comment-section/components/comment-cell-popup/` | `src/editor/components/comments/comment-cell-popup.tsx` |
| Shortcuts Modal | `components/shortcuts-popup/shortcuts-popup.tsx` | `src/editor/components/shortcuts-modal.tsx` |

**Comment storage/state stays consumer-side.** Package provides UI only.  
**App-specific navbar items** (share, publish, delete, auth) stay consumer-side.

---

## Migration Strategy: 3 Phases

### Phase 1 — Sidebar Infrastructure
### Phase 2 — Panel Content + Comments UI
### Phase 3 — Navbar Menu Components

Each phase ships independently. `dsheets.new` keeps working throughout. Regressions are isolated to each phase's diff.

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

// standalone modal (not a sidebar panel)
export { ShortcutsModal } from './editor/components/shortcuts-modal';
```

**`ShortcutsModal`** is exported as a standalone component. Consumer controls open/close state and renders it wherever they want. It does not appear in the sidebar.

### Exported Types

```ts
export type { CommentsConfig, PanelConfig, CommentThread, CommentActionParams }
```

### Phase 2 Deliverable

A consumer with no sidebar code in their app gets comments, templates, data validation, conditional formatting, and function reference sidebar for free. Only `commentsConfig` needs wiring.

---

## Phase 3: Navbar Menu Components

### File Structure

```
src/editor/components/navbar/
  file-menu.tsx
  edit-menu.tsx
  view-menu.tsx
  insert-menu.tsx
  format-menu.tsx
  data-menu.tsx
  help-menu.tsx
  nav-menu-bar.tsx       // convenience wrapper — composes all 7
  use-nav-menu-state.ts  // shared open/close coordination hook
```

### Scope of Package Menus

Each menu contains only **sheet operation items** backed by FortuneCore functions. App-specific items are stripped:

| Menu | Included | Excluded (stays consumer-side) |
|---|---|---|
| File | Import CSV/XLSX, Export CSV/XLSX/JSON, New sheet | Delete sheet, Share, Publish |
| Edit | Undo, Redo, Copy, Cut, Paste, Delete row/col | — |
| View | Freeze rows/cols | — |
| Insert | Insert row/col, Image, Link | — |
| Format | Cell format, Merge, Align, Text size, Clear format | — |
| Data | Sort, Filter | — |
| Help | Shortcuts (fires `onShortcutsOpen`) | Community, Feedback |

### Menu Component Props

Each menu is self-contained. Shared open/close coordination (one menu open at a time) uses `useNavMenuState`:

```ts
// hook exported from package
export const useNavMenuState = () => {
  const [currentMenu, setCurrentMenu] = useState<string | undefined>();
  return { currentMenu, setCurrentMenu };
};

// individual menu usage
const { currentMenu, setCurrentMenu } = useNavMenuState();

<EditMenu
  sheetEditorRef={sheetEditorRef}
  openPanel={openPanel}
  currentMenu={currentMenu}
  setCurrentMenu={setCurrentMenu}
/>
```

### `NavMenuBar` Convenience Wrapper

Composes all 7 menus with internal `useNavMenuState`. Consumer passes only `sheetEditorRef` + `openPanel`:

```tsx
<NavMenuBar
  sheetEditorRef={sheetEditorRef}
  openPanel={openPanel}
  onShortcutsOpen={() => setShortcutsOpen(true)}
/>
```

### `HelpMenu` + `ShortcutsModal` Wiring

```tsx
const [shortcutsOpen, setShortcutsOpen] = useState(false);

// inside renderNavbar:
<HelpMenu
  currentMenu={currentMenu}
  setCurrentMenu={setCurrentMenu}
  onShortcutsOpen={() => setShortcutsOpen(true)}
/>
<ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
```

### Phase 3 Deliverable

Package exports `NavMenuBar` (drop-in) and all 7 individual menu components. Consumer can use `NavMenuBar` for zero-config menus, or compose individual menus for custom ordering/filtering.

---

## Final Drop-In Usage (New Consumer)

```tsx
import {
  DSheetEditor,
  NavMenuBar,
  ShortcutsModal,
} from '@fileverse-dev/dsheet';

function App() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
          <NavMenuBar
            sheetEditorRef={sheetEditorRef}
            openPanel={openPanel}
            onShortcutsOpen={() => setShortcutsOpen(true)}
          />
          <input placeholder="Untitled" />
          <button>Share</button>
          <ShortcutsModal
            open={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />
        </>
      )}
    />
  );
}
```

Comments sidebar, templates, data validation, conditional formatting, function reference — all work with zero additional wiring beyond `commentsConfig`.

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
- Remove `components/shortcuts-popup/shortcuts-popup.tsx`
- Replace `commentData` + `getCommentCellUI` props with `commentsConfig`
- Remove `toggleTemplateSidebar`, `isTemplateOpen` props

**After Phase 3:**
- Replace `components/navbar/edit/edit-menu.tsx` etc. with package-exported versions
- Keep only dsheets.new-specific navbar items (share, publish, auth, collaborators)

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
