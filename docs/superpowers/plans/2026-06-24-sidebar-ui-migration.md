# Sidebar UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the right-sidebar system and its four built-in panels (data-verification, conditional-format, templates, functions) from the `dsheets.new` consumer into the `@fileverse-dev/dsheet` package, so a consumer gets a working sidebar with zero sidebar code.

**Architecture:** A package-internal `SidebarProvider` (wrapping a ported `useRightPanels` hook) is mounted inside `EditorProvider`. Any component in the editor tree — including the consumer's `renderNavbar` — opens panels by calling `openPanel`, now handed out via `editorValues`. `EditorContent` renders the sliding `EditorRightSidebar`, auto-registers the four built-in panels, spreads in consumer `customPanels`, and renders the hidden DOM buttons FortuneCore clicks by id. All checkpoints run against the package's own `demo/` app via `npm run dev`.

**Tech Stack:** React 18, TypeScript, Vite (+ `vite-plugin-dts`), `@fileverse/ui`, `@fileverse-dev/dsheets-templates`, `@fileverse-dev/formulajs`, `yjs`. No test harness exists for this UI — verification is **run-the-app** at each checkpoint.

---

## Scope

**In scope (this plan):**
- Phase 1 — sidebar infrastructure (hook, context, layout, `EditorRightSidebar`, `editorValues.openPanel`, `customPanels`, `PanelConfig`).
- Phase 2 panels (no comments) — `data-verification`, `conditional-format`, `templates`, `functions`, plus the hidden DOM-button triggers.

**Out of scope (separate plans):**
- Comments sidebar + `comment-cell-popup` + `commentsConfig` + `getCommentCellUI`.
- Navbar menus and shortcuts modal (stay in `dsheets.new`).
- Deleting the duplicated code from `dsheets.new` and rewiring the consumer. This plan builds and verifies everything **inside the package**; the consumer switchover is a later effort.

---

## Conventions (apply to every ported file)

When copying a file from `dsheets.new` into the package, always:
- Delete any `'use client';` directive (package is framework-agnostic).
- Replace `next/image` `<Image>` with a plain `<img>`.
- Remove `next/navigation` imports (`useSearchParams`, `useRouter`); replace usage with `window`/`URLSearchParams` reads or drop the app-only behavior (noted per task).
- Replace `@/...` path-alias imports with package-relative imports or package-internal equivalents (noted per task).
- Keep all `data-testid`, element `id`s, and class names **exactly** — FortuneCore and styling depend on them.

**Commits:** Each checkpoint ends with a commit step. Per repo policy the **user runs commits manually** — an agent executing this plan should stop at the commit step and let the user commit, not run `git commit` itself.

---

## Checkpoint Protocol (referenced by every CHECKPOINT step)

The package builds to `dist/` and the `demo/` app imports directly from `../../src/index` (source, not `dist`), so for in-package testing you only need the Vite dev server:

1. From `fileverse-dsheet/`, run: `npm run dev`
2. Open the printed local URL (Vite default `http://localhost:5173`).
3. Wait ~5s for the sheet to load (the demo flips `isNewSheet` after 5s).
4. Perform the checkpoint's **Verify** actions in the browser.
5. Open DevTools console — there must be **no red errors** related to the editor/sidebar.

`npm run build` (`tsc && vite build`) must also pass — it is the type-check gate. Run it whenever a step says "build must pass."

> `npm run dev:link` (build + copy `dist/` into `dsheets.new/node_modules`) is only needed when you later test inside `dsheets.new`. Not required for any checkpoint in this plan.

---

## File Structure

**Created in package:**
```
src/editor/components/sidebar/
  use-right-panels.ts        # ported hook: activePanel state + open/close/toggle + persistence
  sidebar-context.tsx        # SidebarProvider + useSidebar()
  right-sidebar.tsx          # RightSidebar / RightSidebarHeader layout primitives
  editor-right-sidebar.tsx   # EditorRightSidebar: header + close + active panel content
src/editor/components/sidebars/
  data-verification.tsx      # placeholder div #placeholder-data-verification
  conditional-format.tsx     # placeholder div #placeholder-conditional-format
  templates.tsx              # Templates panel
  template-ui.tsx            # Template type + TemplateCard + TemplatePreview
  function-content.tsx       # FunctionContent panel
  function/
    function-categories.tsx
    function-categories-logic.ts
    function-metadata.tsx
    functionList.tsx
    types.ts
    use-functions.tsx
src/editor/utils/api-keys-local-storage.ts   # ported ApiKeyStorageHelper (localStorage only)
```

**Modified in package:**
```
src/editor/types.ts                     # EditorValues += openPanel/closePanel; new PanelConfig, PanelId, BuiltInPanelType
src/editor/contexts/editor-context.tsx  # wrap children in <SidebarProvider>
src/editor/dsheet-editor.tsx            # render sidebar, builtInPanels, customPanels, hidden buttons, openPanel→editorValues
src/index.ts                            # export PanelConfig type
demo/src/App.tsx                        # checkpoint-only test wiring (openPanel buttons)
```

---

# PART A — Phase 1: Sidebar Infrastructure

## Task 1: Port the `useRightPanels` hook

**Files:**
- Create: `src/editor/components/sidebar/use-right-panels.ts`

Strips the app-specific bits from `dsheets.new/components/right-sidebar-wrapper/use-right-panels.ts`: `useAccountContext`, `next/navigation` `useSearchParams`, `removeQuery`, the `identityInitialized` guard, the `sc/dune/lq/price` URL auto-open, the `isRtcShareRoute` joiner logic, and the imported `SIDEBAR_STATE_KEY`. Keeps localStorage persistence, mobile detection, read-mode gating, first-time templates auto-open, and `openPanel/closePanel/togglePanel/isActive`.

- [ ] **Step 1: Write the file**

```ts
import { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'usehooks-ts';

export type BuiltInPanelType =
  | 'templates'
  | 'comments'
  | 'functions'
  | 'data-verification'
  | 'conditional-format';

// string allows consumer custom panels (e.g. 'smart-contract-list-view')
export type PanelId = BuiltInPanelType | string;

interface UseRightPanelsReturn {
  activePanel: PanelId | null;
  isOpen: boolean;
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelId) => void;
  isActive: (panel: PanelId) => boolean;
}

// Local constants (previously SIDEBAR_STATE_KEY came from app constants).
const ACTIVE_PANEL_KEY = 'dsheets-active-panel';
const SIDEBAR_STATE_KEY = 'dsheets-active-panel-state';

export const useRightPanels = (
  isReadMode: boolean = false,
): UseRightPanelsReturn => {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isPanelAllowed = useCallback(
    (panel: PanelId) => {
      if (isReadMode) return panel === 'comments';
      return true;
    },
    [isReadMode],
  );

  const isMobile = useMediaQuery('(max-width: 840px)', { defaultValue: false });

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedPanel = localStorage.getItem(ACTIVE_PANEL_KEY) as PanelId | null;
    const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);

    if (
      savedPanel &&
      savedState === 'true' &&
      savedPanel !== 'data-verification' &&
      savedPanel !== 'conditional-format'
    ) {
      if (isReadMode && savedPanel !== 'comments') {
        setActivePanel('comments');
      } else {
        setActivePanel(savedPanel);
      }
      setIsOpen(true);
    } else if (savedState === null) {
      // First-time user — auto-open templates on the owner editor only.
      if (!isReadMode && !isMobile) {
        setActivePanel('templates');
        setIsOpen(true);
      }
    }
    // savedState === 'false' → stay closed.
  }, [isReadMode, isMobile]);

  // Keep isOpen in sync with activePanel
  useEffect(() => {
    setIsOpen(activePanel !== null);
  }, [activePanel]);

  // Persist panel + open state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activePanel) {
      localStorage.setItem(ACTIVE_PANEL_KEY, activePanel);
      localStorage.setItem(SIDEBAR_STATE_KEY, 'true');
    } else {
      localStorage.removeItem(ACTIVE_PANEL_KEY);
      localStorage.setItem(SIDEBAR_STATE_KEY, 'false');
    }
  }, [activePanel]);

  const openPanel = useCallback(
    (panel: PanelId) => {
      if (!isPanelAllowed(panel)) return;
      setActivePanel(panel);
    },
    [isPanelAllowed],
  );

  const closePanel = useCallback(() => setActivePanel(null), []);

  const togglePanel = useCallback(
    (panel: PanelId) => {
      if (!isPanelAllowed(panel)) return;
      setActivePanel((current) => (current === panel ? null : panel));
    },
    [isPanelAllowed],
  );

  const isActive = useCallback(
    (panel: PanelId) => activePanel === panel,
    [activePanel],
  );

  return { activePanel, isOpen, openPanel, closePanel, togglePanel, isActive };
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS (no type errors). `usehooks-ts` is already a dependency (used by `demo/`); confirm it resolves — if `tsc` reports it missing, add it to package `dependencies` and re-run.

---

## Task 2: Port the sidebar layout primitives

**Files:**
- Create: `src/editor/components/sidebar/right-sidebar.tsx`

Ported from `dsheets.new/components/right-sidebar-wrapper/right-sidebar-layout.tsx`. Drops `'use client'`. The hardcoded `83px`/`44px` preview offsets become props (`top`, `height`) defaulting to the package navbar height (44px). Keeps only the two primitives this plan needs: `RightSidebar` and `RightSidebarHeader`.

- [ ] **Step 1: Write the file**

```tsx
import { type ReactNode } from 'react';
import { cn } from '@fileverse/ui';

export function RightSidebar({
  width = '380px',
  className,
  children,
  isOpen = false,
  top = '44px',
  height = 'calc(100vh - 44px)',
}: Readonly<{
  width?: string;
  className?: string;
  children: ReactNode;
  isOpen?: boolean;
  top?: string;
  height?: string;
}>) {
  return (
    <aside
      className={cn(
        'fixed right-0 z-30 bg-[#F8F9FA] border-l transition-all duration-300 ease-in-out overflow-hidden dark:bg-[#1E1E1E] !select-text',
        className,
      )}
      data-state={isOpen ? 'open' : 'closed'}
      aria-hidden={!isOpen}
      style={{
        top,
        height,
        width,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px', height: '100%', boxSizing: 'border-box' }}>
        <div
          style={{
            border: '1px solid #E8EBEC',
            borderRadius: '12px',
            backgroundColor: '#fff',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </aside>
  );
}

export function RightSidebarHeader({
  className,
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <header
      className={cn(
        'relative z-50 px-4 py-2 border-b border-gray-200 shrink-0',
        className,
      )}
    >
      {children}
    </header>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

---

## Task 3: Create the sidebar context

**Files:**
- Create: `src/editor/components/sidebar/sidebar-context.tsx`

Wraps `useRightPanels` in a context so `renderNavbar` (and the hidden buttons) can call `openPanel` without prop-drilling. Reads `isReadOnly` from the editor context so `isReadMode` is wired automatically.

- [ ] **Step 1: Write the file**

```tsx
import { createContext, useContext, ReactNode } from 'react';
import { useRightPanels, PanelId } from './use-right-panels';

interface SidebarContextType {
  activePanel: PanelId | null;
  isOpen: boolean;
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelId) => void;
  isActive: (panel: PanelId) => boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({
  children,
  isReadMode = false,
}: Readonly<{ children: ReactNode; isReadMode?: boolean }>) {
  const panelsState = useRightPanels(isReadMode);
  return (
    <SidebarContext.Provider value={panelsState}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextType {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

---

## Task 4: Create `EditorRightSidebar`

**Files:**
- Create: `src/editor/components/sidebar/editor-right-sidebar.tsx`

Ported from `dsheets.new/components/dsheet-editor/right-sidebar.tsx`, but generalized: instead of importing `DataVerification`/`ConditionalFormat` directly and special-casing them, it renders whatever `content` the active `PanelConfig` carries. The DV/CF "never unmount" behavior is preserved by the auto-registration in Task 11 (both placeholder panels stay mounted via `hidden` wrappers there is **not** needed — FortuneCore mounts into the placeholder div by id once it exists; rendering the active panel's content is sufficient because the panel content is just the placeholder div). Keep it simple: header + close button + active content.

- [ ] **Step 1: Write the file**

```tsx
import { IconButton } from '@fileverse/ui';
import { ReactNode } from 'react';
import { RightSidebar, RightSidebarHeader } from './right-sidebar';

export interface ActivePanelConfig {
  id: string;
  width: string;
  header: { title: string; subtitle?: string };
  content: ReactNode;
}

interface EditorRightSidebarProps {
  isOpen: boolean;
  activePanelConfig: ActivePanelConfig | null;
  onClose: () => void;
}

export const EditorRightSidebar = ({
  isOpen,
  activePanelConfig,
  onClose,
}: EditorRightSidebarProps) => {
  return (
    <RightSidebar width={activePanelConfig?.width} isOpen={isOpen}>
      <RightSidebarHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-heading-sm leading-[22px]">
            {activePanelConfig?.header.title}
          </h2>
          <IconButton
            variant="ghost"
            icon="X"
            size="sm"
            onClick={onClose}
            aria-label={`Close ${activePanelConfig?.header.title ?? ''} panel`}
          />
        </div>
      </RightSidebarHeader>
      {activePanelConfig?.content}
    </RightSidebar>
  );
};
```

> **Note on DV/CF unmounting:** The consumer version kept DV/CF permanently mounted because FortuneCore portals into their placeholder ids and never re-mounts. In Task 11 the built-in panel list keeps the SAME placeholder ids, and the sidebar slides (translateX) rather than unmounting its `<aside>`, so the placeholder divs persist in the DOM whenever their panel is the active one. If, during CHECKPOINT 2, the DV/CF UI fails to re-render after closing and reopening, revisit this by always-mounting DV/CF inside the sidebar (mirror the consumer's `hidden`-wrapper approach). Do not pre-optimize — verify first.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

---

## Task 5: Add types — `PanelConfig`, `EditorValues.openPanel`

**Files:**
- Modify: `src/editor/types.ts`

- [ ] **Step 1: Extend `EditorValues` and add `PanelConfig`**

Find the existing `EditorValues` interface (currently lines ~14-18) and replace it, then add `PanelConfig` + re-export the panel id types right after it:

```ts
export interface EditorValues {
  sheetEditorRef: RefObject<WorkbookInstance>;
  currentDataRef: React.MutableRefObject<Sheet[] | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  openPanel: (panelId: string) => void; // NEW
  closePanel: () => void; // NEW
}

export interface PanelConfig {
  id: string;
  header: {
    title: string;
    subtitle?: string;
  };
  width?: string; // default: '380px'
  content: React.ReactNode;
}

export type { PanelId, BuiltInPanelType } from './components/sidebar/use-right-panels';
```

- [ ] **Step 2: Add `customPanels` to `DsheetProps`**

In the `DsheetProps` interface, add this line (next to the other optional props, e.g. after `liveQueryRefreshRate`):

```ts
  customPanels?: PanelConfig[];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: FAIL — `src/editor/dsheet-editor.tsx` no longer satisfies `EditorValues` (it builds `editorValues` without `openPanel`/`closePanel`). That failure is expected and is fixed in Task 7. Note the error message and continue.

---

## Task 6: Mount `SidebarProvider` inside `EditorProvider`

**Files:**
- Modify: `src/editor/contexts/editor-context.tsx`

`EditorProvider` already wraps the tree in `EditorContext.Provider`. Wrap its children with `SidebarProvider` so every descendant (including `EditorContent` and `renderNavbar`) can call `useSidebar()`. `SidebarProvider` is rendered *inside* `EditorContext.Provider`, so it can read `isReadOnly` — but it's simpler to pass `isReadMode` from the provider's own `isReadOnly` prop, which is already in scope.

- [ ] **Step 1: Import `SidebarProvider`**

Add near the top with the other imports:

```ts
import { SidebarProvider } from '../components/sidebar/sidebar-context';
```

- [ ] **Step 2: Wrap children**

Find the provider return (currently lines ~486-490):

```tsx
  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
```

Replace with:

```tsx
  return (
    <EditorContext.Provider value={contextValue}>
      <SidebarProvider isReadMode={isReadOnly}>{children}</SidebarProvider>
    </EditorContext.Provider>
  );
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: still FAILS on the same `EditorValues` error from Task 5 (fixed next). No *new* errors from this file.

---

## Task 7: Wire the sidebar into `EditorContent`

**Files:**
- Modify: `src/editor/dsheet-editor.tsx`
- Modify: `src/index.ts`

This task delivers Phase 1: `editorValues.openPanel`/`closePanel`, `customPanels` rendering through `EditorRightSidebar`, and the exported `PanelConfig` type. Built-in panels come in Part B; for now only `customPanels` populate the sidebar.

- [ ] **Step 1: Add imports to `dsheet-editor.tsx`**

Add near the existing imports:

```ts
import { useSidebar } from './components/sidebar/sidebar-context';
import { EditorRightSidebar } from './components/sidebar/editor-right-sidebar';
import { PanelConfig } from './types';
```

- [ ] **Step 2: Thread `customPanels` through props**

In `SpreadsheetEditor`'s destructured `DsheetProps`, add `customPanels`. Then pass it into `<EditorContent customPanels={customPanels} ... />`. In `EditorContent`'s prop type (the `Pick<DsheetProps, ...>` + inline type), add:

```ts
  customPanels?: PanelConfig[];
```
and add `customPanels` to its destructured params.

- [ ] **Step 3: Consume sidebar context and build the panel list**

Inside `EditorContent`, after the `useEditor()` destructure, add:

```ts
  const { activePanel, isOpen, openPanel, closePanel } = useSidebar();

  const allPanels: PanelConfig[] = [...(customPanels ?? [])];

  const activePanelConfig = (() => {
    const panel = allPanels.find((p) => p.id === activePanel);
    if (!panel) return null;
    return {
      id: panel.id,
      width: panel.width ?? '380px',
      header: panel.header,
      content: panel.content,
    };
  })();
```

- [ ] **Step 4: Add `openPanel`/`closePanel` to `editorValues`**

Replace the existing `editorValues` object (currently lines ~122-126):

```ts
  const editorValues: EditorValues = {
    sheetEditorRef,
    currentDataRef,
    ydocRef,
    openPanel,
    closePanel,
  };
```

- [ ] **Step 5: Render the sidebar**

Inside `EditorContent`'s returned JSX, just before the closing `</div>` of the root `.dsheet-editor` wrapper (after the `.dsheet-editor-main` block), add:

```tsx
      <EditorRightSidebar
        isOpen={isOpen && activePanelConfig !== null}
        activePanelConfig={activePanelConfig}
        onClose={closePanel}
      />
```

> The `&& activePanelConfig !== null` guard keeps the sidebar closed when the persisted/active panel id is not registered (e.g. first-load `'templates'` before Part B registers it, or a `smart-contract-list-view` id no consumer supplied). Without it you get an empty ghost sidebar.

- [ ] **Step 6: Export `PanelConfig` from the package**

In `src/index.ts`, add under the `// Types` section:

```ts
export type { PanelConfig, PanelId, BuiltInPanelType } from './editor/types';
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: PASS. The `EditorValues` error from Task 5 is now resolved.

---

## Task 8: CHECKPOINT 1 — custom panel opens and closes

**Files:**
- Modify: `demo/src/App.tsx` (checkpoint-only test wiring)

- [ ] **Step 1: Give the demo a custom panel + an open button**

In `demo/src/App.tsx`:

a) Pass a `customPanels` prop to `<DSheetEditor>`:

```tsx
                customPanels={[
                  {
                    id: 'demo-panel',
                    header: { title: 'Demo Panel', subtitle: 'checkpoint 1' },
                    width: '380px',
                    content: <div style={{ padding: 16 }}>Hello from a custom panel</div>,
                  },
                ]}
```

b) Change `renderNavbar` to accept `editorValues` and add a test button. Update the signature:

```tsx
  const renderNavbar = useCallback((editorValues?: any): JSX.Element => {
```
and inside the first `<div className="flex items-center gap-[12px]">`, add as the first child:

```tsx
          <button
            type="button"
            onClick={() => editorValues?.openPanel('demo-panel')}
            style={{ border: '1px solid #ccc', borderRadius: 6, padding: '2px 8px' }}
          >
            Open Demo Panel
          </button>
```
Add `// eslint-disable-next-line` above the `useCallback` if the `any` trips linting; this wiring is temporary.

- [ ] **Step 2: Run the app (Checkpoint Protocol)**

Run: `npm run dev`, open the URL, wait for the sheet.

- [ ] **Step 3: Verify**

- Click **Open Demo Panel** → the right sidebar slides in, header reads "Demo Panel", body shows "Hello from a custom panel".
- Click the header **X** → sidebar slides out.
- On the very first load (cleared localStorage), the sidebar stays **closed** even though the hook auto-selects `'templates'` — that id isn't registered yet, so the guard keeps it shut. This is expected until Part B adds the templates panel.
- Open the demo panel, reload → it reopens (active id `demo-panel` is persisted and registered). Close it, reload → stays closed.
- Console: no red errors.

- [ ] **Step 4: Commit (user runs)**

```bash
git add src/editor/components/sidebar src/editor/types.ts \
        src/editor/contexts/editor-context.tsx src/editor/dsheet-editor.tsx \
        src/index.ts demo/src/App.tsx
git commit -m "feat(sidebar): phase 1 sidebar infrastructure + customPanels"
```

---

# PART B — Phase 2 Panels (no comments)

## Task 9: `data-verification` + `conditional-format` panels + hidden buttons

**Files:**
- Create: `src/editor/components/sidebars/data-verification.tsx`
- Create: `src/editor/components/sidebars/conditional-format.tsx`
- Modify: `src/editor/dsheet-editor.tsx`

Both are placeholder divs FortuneCore portals into by id. FortuneCore opens them by dispatching DOM clicks on hidden buttons (`#data-verification-button`, `#conditional-format-button`). Those buttons move into the package's `EditorContent`.

- [ ] **Step 1: Create `data-verification.tsx`** (verbatim — keep the id)

```tsx
const DataVerification = () => {
  return (
    <div
      id="placeholder-data-verification"
      className="h-[calc(100vh-200px)] overflow-y-auto no-scrollbar"
    ></div>
  );
};

export { DataVerification };
```

- [ ] **Step 2: Create `conditional-format.tsx`** (verbatim — keep the id)

```tsx
const ConditionalFormat = () => {
  return (
    <div
      id="placeholder-conditional-format"
      className="h-[calc(100vh-200px)] overflow-y-auto no-scrollbar"
      style={{ padding: '16px' }}
    ></div>
  );
};

export { ConditionalFormat };
```

- [ ] **Step 3: Register the two built-in panels**

In `dsheet-editor.tsx`, import them:

```ts
import { DataVerification } from './components/sidebars/data-verification';
import { ConditionalFormat } from './components/sidebars/conditional-format';
```

Replace the `allPanels` line from Task 7 Step 3 with a built-in list spread before custom panels:

```ts
  const builtInPanels: PanelConfig[] = [
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
  ];

  const allPanels: PanelConfig[] = [...builtInPanels, ...(customPanels ?? [])];
```

- [ ] **Step 4: Render the hidden trigger buttons**

`useSidebar()` already gives `openPanel`. Also pull `togglePanel`:

```ts
  const { activePanel, isOpen, openPanel, closePanel, togglePanel } = useSidebar();
```

Inside `EditorContent`'s returned JSX, right after the opening `<div className={cn('dsheet-editor', ...)}>`, add the hidden buttons. (`smartcontract-button` is rendered so FortuneCore can fire it; the panel only exists if a consumer registers `'smart-contract-list-view'` via `customPanels`, otherwise `openPanel` no-ops.)

```tsx
      {/* Hidden DOM triggers — FortuneCore fires these by id via element.click() */}
      <button
        id="data-verification-button"
        className="hidden"
        onClick={() => togglePanel('data-verification')}
      />
      <button
        id="conditional-format-button"
        className="hidden"
        onClick={() => openPanel('conditional-format')}
      />
      <button
        id="smartcontract-button"
        className="hidden"
        onClick={() => openPanel('smart-contract-list-view')}
      />
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: CHECKPOINT 2 — Data Validation & Conditional Formatting**

Run the app (Checkpoint Protocol). Then in the sheet:
- Select a cell. Open FortuneCore's **Data → Data validation** (or right-click menu path that triggers validation) so it fires `#data-verification-button`. The sidebar opens titled "Data Validation" and FortuneCore's validation UI appears inside the placeholder div.
- Trigger **Conditional formatting** similarly → sidebar opens titled "Conditional Formatting" with FortuneCore's UI mounted.
- Close and reopen each once. The FortuneCore UI must still render (see the DV/CF note in Task 4 — if it does not, apply the always-mounted fallback there).
- Console: no red errors.

> If you cannot find the in-sheet trigger, simulate FortuneCore's click in the DevTools console: `document.getElementById('data-verification-button').click()` — the sidebar should open. This confirms the wiring even if the menu path is unclear.

- [ ] **Step 7: Commit (user runs)**

```bash
git add src/editor/components/sidebars src/editor/dsheet-editor.tsx
git commit -m "feat(sidebar): data-verification + conditional-format panels"
```

---

## Task 10: `templates` panel

**Files:**
- Create: `src/editor/components/sidebars/template-ui.tsx`
- Create: `src/editor/components/sidebars/templates.tsx`
- Modify: `src/editor/dsheet-editor.tsx`

`Templates` lets the user pick a template; selection feeds the package's existing `useApplyTemplatesBtn` (already wired in `EditorContent` via the `selectedTemplate` prop + context setter). We add internal selection state so the panel is self-contained, and render a hover `TemplatePreview`.

- [ ] **Step 1: Create `template-ui.tsx`**

Copy `dsheets.new/components/template/template-ui.tsx` verbatim, then apply the Conventions: replace `import Image from 'next/image'` and every `<Image .../>` with a plain `<img .../>` (map `width`/`height` props to the `<img>` attributes; drop Next-only props like `priority`). It exports `interface Template`, `TemplateCard`, and `TemplatePreview`, importing only `Tag` from `@fileverse/ui`.

- [ ] **Step 2: Verify build of `template-ui.tsx`**

Run: `npm run build`
Expected: PASS (no `next/image` resolution error).

- [ ] **Step 3: Create `templates.tsx`**

Copy `dsheets.new/components/template/templates.tsx` verbatim, then:
- Delete `'use client';`.
- Change the import to the new sibling path: `import { Template, TemplateCard } from './template-ui';`.

Its props stay `{ setSelectedTemplate: (template: string) => void; setHoveredTemplate: React.Dispatch<React.SetStateAction<Template | null>> }`. It already lazy-imports `@fileverse-dev/dsheets-templates/template-metadata-list` (a package dependency) and uses only `@fileverse/ui`.

- [ ] **Step 4: Wire the templates panel in `EditorContent`**

Import in `dsheet-editor.tsx`:

```ts
import { Templates } from './components/sidebars/templates';
import { TemplatePreview, Template } from './components/sidebars/template-ui';
import { useMediaQuery } from 'usehooks-ts';
```

Add internal state inside `EditorContent` (near the top, after `useSidebar()`):

```ts
  const [internalSelectedTemplate, setInternalSelectedTemplate] = useState<string | null>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<Template | null>(null);
  const isMobile = useMediaQuery('(max-width: 840px)', { defaultValue: false });
```

The existing `useApplyTemplatesBtn(...)` call uses `selectedTemplate` (the prop) + `setSelectedTemplate: contextSetSelectedTemplate`. Change its `selectedTemplate` argument to prefer internal state:

```ts
    selectedTemplate: internalSelectedTemplate ?? selectedTemplate,
```
and change its `setSelectedTemplate` argument to clear internal state too:

```ts
    setSelectedTemplate: (slug) => {
      setInternalSelectedTemplate(null);
      contextSetSelectedTemplate?.(slug as any);
    },
```

Add the `templates` panel to `builtInPanels` (from Task 9 Step 3), before `data-verification`:

```ts
    {
      id: 'templates',
      header: {
        title: 'Templates',
        subtitle:
          'Start with pre-built templates. Includes smart contract analysis, real time coins price and much more for blockchain analytics',
      },
      width: '380px',
      content: (
        <Templates
          setSelectedTemplate={(slug) => setInternalSelectedTemplate(slug)}
          setHoveredTemplate={setHoveredTemplate}
        />
      ),
    },
```

Render the hover preview next to `<EditorRightSidebar ...>`:

```tsx
      {hoveredTemplate && !isMobile && <TemplatePreview template={hoveredTemplate} />}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: CHECKPOINT 3 — Templates**

Run the app. Add a temporary demo button (like Checkpoint 1) wired to `editorValues.openPanel('templates')`, OR rely on the first-time auto-open (clear localStorage keys `dsheets-active-panel` / `dsheets-active-panel-state` and reload — templates should auto-open). Then:
- Sidebar opens titled "Templates"; the search box, category tags, and template cards render.
- Hover a card → a `TemplatePreview` appears (desktop width only).
- Click a template → a new sheet/tab is appended with that template's data (this exercises `useApplyTemplatesBtn`). The selected template clears so the same one can be re-applied.
- Console: no red errors.

- [ ] **Step 7: Commit (user runs)**

```bash
git add src/editor/components/sidebars/templates.tsx \
        src/editor/components/sidebars/template-ui.tsx src/editor/dsheet-editor.tsx
git commit -m "feat(sidebar): templates panel"
```

---

## Task 11: `functions` panel

**Files:**
- Create: `src/editor/utils/api-keys-local-storage.ts`
- Create: `src/editor/components/sidebars/function-content.tsx`
- Create: `src/editor/components/sidebars/function/function-categories.tsx`
- Create: `src/editor/components/sidebars/function/function-categories-logic.ts`
- Create: `src/editor/components/sidebars/function/function-metadata.tsx`
- Create: `src/editor/components/sidebars/function/functionList.tsx`
- Create: `src/editor/components/sidebars/function/types.ts`
- Create: `src/editor/components/sidebars/function/use-functions.tsx`
- Modify: `src/editor/dsheet-editor.tsx`

The function panel ("Learn More") is the only coupled panel. Four app-imports must be resolved (the requirements doc claimed "no app-specific imports" — that is incorrect; these exist):

| App import | Where | Resolution |
|---|---|---|
| `@/db/db` `KeyStoreCache` (type only) | `api-keys/local-storage-helper.ts` | Replace `KeyStoreCache['apiKeys']` with `Record<string, string>` |
| `next/navigation` `useSearchParams` | `hooks/use-functions.tsx` | Replace with a `window.location.search` read |
| `@/utils/constants` `API_KEY_PLACEHOLDER` | `function-metadata.tsx`, `functionList.tsx` | Import from the package: it already exists at `src/sheet-engine/react/constants.ts` |
| `@/utils/proxy-service` `ProxyService` | `function-metadata.tsx` | Replace `ProxyService.isProxyEnabled()` with `process.env.NEXT_PUBLIC_PROXY_MODE === 'true'` |

- [ ] **Step 1: Create `api-keys-local-storage.ts`**

Copy `dsheets.new/components/function/api-keys/local-storage-helper.ts` verbatim, then change the one type usage. Replace:

```ts
import { KeyStoreCache } from '@/db/db';
```
with: (delete the import) and in `getAllSupportedApiKeys`, change:

```ts
    const result: KeyStoreCache['apiKeys'] = {};
```
to:

```ts
    const result: Record<string, string> = {};
```

Everything else (localStorage logic, `DATABLOCK_API_KEYS`, proxy fallback via `process.env.NEXT_PUBLIC_PROXY_MODE`) is already framework-agnostic.

- [ ] **Step 2: Copy the function support files**

Copy verbatim into `src/editor/components/sidebars/function/`:
- `function-categories.tsx`
- `function-categories-logic.ts`
- `types.ts`

These have no app imports (`function-categories-logic.ts` and `types.ts` are pure TS; `function-categories.tsx` uses only `@fileverse/ui`). Verify by grepping each copied file for `@/` and `next/` — there should be zero matches.

- [ ] **Step 3: Create `use-functions.tsx`**

Copy `dsheets.new/components/function/hooks/use-functions.tsx` into `src/editor/components/sidebars/function/use-functions.tsx`, then:
- Change `import type { WorkbookInstance } from '@fileverse-dev/dsheet';` to `import type { WorkbookInstance } from '@sheet-engine/react';`.
- Delete `import { useSearchParams } from 'next/navigation';`.
- Replace the `const searchQuery = useSearchParams();` + its `useEffect` (the `dune`/`lq`/`price` block, lines ~125-146) with a one-shot window read:

```ts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dune')) setSearchText('dune');
    else if (params.get('lq')) setSearchText('coingecko');
    else if (params.get('price')) setSearchText('price');
  }, []);
```

- [ ] **Step 4: Create `functionList.tsx`**

Copy `dsheets.new/components/function/functionList.tsx`, then replace:

```ts
import { API_KEY_PLACEHOLDER } from '@/utils/constants';
```
with the package-internal source:

```ts
import { API_KEY_PLACEHOLDER } from '../../../../sheet-engine/react/constants';
```

> Confirm the relative depth: from `src/editor/components/sidebars/function/functionList.tsx` to `src/sheet-engine/react/constants.ts` is `../../../../sheet-engine/react/constants`. Adjust if `tsc` reports an unresolved path.

- [ ] **Step 5: Create `function-metadata.tsx`**

Copy `dsheets.new/components/function/function-metadata.tsx`, then:
- Replace `import { API_KEY_PLACEHOLDER } from '@/utils/constants';` with `import { API_KEY_PLACEHOLDER } from '../../../../sheet-engine/react/constants';`.
- Delete `import { ProxyService } from '@/utils/proxy-service';`.
- Replace the single usage `ProxyService.isProxyEnabled()` (line ~33) with `process.env.NEXT_PUBLIC_PROXY_MODE === 'true'`.
- Change its `getApiKey, saveApiKey` import (from `./api-keys/local-storage-helper`) to point at the new util: `import { getApiKey, saveApiKey } from '../../../utils/api-keys-local-storage';`.

- [ ] **Step 6: Create `function-content.tsx`**

Copy `dsheets.new/components/function/function-content.tsx` into `src/editor/components/sidebars/function-content.tsx`, then:
- Change `import type { WorkbookInstance } from '@fileverse-dev/dsheet';` to `import type { WorkbookInstance } from '@sheet-engine/react';`.
- Fix child import paths to the `function/` subfolder: `./function-metadata` → `./function/function-metadata`, `./function-categories` → `./function/function-categories`, `./functionList` → `./function/functionList`, `./hooks/use-functions` → `./function/use-functions`, `./function-categories-logic` → `./function/function-categories-logic`.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: PASS. If any `@/` or `next/` import remains, `tsc`/Vite will flag it — fix per the table above.

- [ ] **Step 8: Register the functions panel + its hidden button**

In `dsheet-editor.tsx`:

```ts
import FunctionContent from './components/sidebars/function-content';
```

Add state for the "learn more from cell" suggestion counter (near the other `EditorContent` state):

```ts
  const [shouldHandleSuggestionFromCell, setShouldHandleSuggestionFromCell] = useState(0);
```

Add the `functions` panel to `builtInPanels`:

```ts
    {
      id: 'functions',
      header: { title: 'Function' },
      width: '380px',
      content: (
        <FunctionContent
          sheetEditorRef={sheetEditorRef}
          shouldHandleSuggestionFromCell={shouldHandleSuggestionFromCell}
        />
      ),
    },
```

Add the hidden function button alongside the others from Task 9 Step 4:

```tsx
      <button
        id="function-button"
        className="hidden"
        onClick={() => {
          openPanel('functions');
          setShouldHandleSuggestionFromCell((p) => p + 1);
        }}
      />
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 10: CHECKPOINT 4 — Functions**

Run the app. Open the functions panel via a temporary demo button wired to `editorValues.openPanel('functions')`, or via console `document.getElementById('function-button').click()`. Then:
- Sidebar opens titled "Function"; the search box, category chips, and function list render.
- Type a query (e.g. `SUM`) → the list filters; selecting a function shows its metadata.
- Click **Insert** on a selected function → it inserts into the active cell (exercises `sheetEditorRef.current.insertFunction`).
- For a data-block function with an `API_KEY`, the API-key field shows the placeholder from `API_KEY_PLACEHOLDER` and typing a key persists to localStorage.
- Console: no red errors.

- [ ] **Step 11: Commit (user runs)**

```bash
git add src/editor/utils/api-keys-local-storage.ts \
        src/editor/components/sidebars/function-content.tsx \
        src/editor/components/sidebars/function src/editor/dsheet-editor.tsx
git commit -m "feat(sidebar): functions panel"
```

---

## Task 12: Final cleanup + full verification

**Files:**
- Modify: `demo/src/App.tsx`

- [ ] **Step 1: Decide on demo wiring**

Keep the demo's `openPanel` test buttons if useful for ongoing manual testing, OR revert the temporary `customPanels`/test-button edits if you want the demo clean. If keeping, leave a clear comment that they are demo-only. Either way the demo must compile.

- [ ] **Step 2: Full build + dev smoke**

Run: `npm run build` → PASS.
Run: `npm run dev`, open the app, and in one session verify all four panels open without console errors: templates (auto-open or button), data-verification (`#data-verification-button`), conditional-format (`#conditional-format-button`), functions (`#function-button`). Confirm the sidebar's slide-in/out animation and the X-close work for each.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (the lint script auto-fixes; commit any formatting changes). Remove any temporary `eslint-disable` lines added for demo `any` typing if you reverted that wiring.

- [ ] **Step 4: Commit (user runs)**

```bash
git add -A
git commit -m "chore(sidebar): finalize phase 1+2 sidebar migration (panels, no comments)"
```

---

## Done — what this delivers

- A package-internal sidebar system: `useRightPanels` → `SidebarProvider` → `EditorRightSidebar`, mounted by `EditorProvider`/`EditorContent`.
- `editorValues.openPanel` / `closePanel` available to any `renderNavbar`.
- `customPanels` prop + exported `PanelConfig` type for consumer panels.
- Four built-in panels working with zero consumer wiring: `templates`, `data-verification`, `conditional-format`, `functions`.
- Hidden DOM triggers (`#data-verification-button`, `#conditional-format-button`, `#function-button`, `#smartcontract-button`) rendered inside the package, so FortuneCore's click-by-id keeps working.

**Not included (next plans):** comments sidebar + `commentsConfig` + `getCommentCellUI`; deleting the duplicated code in `dsheets.new` and switching the consumer over to the package sidebar.
