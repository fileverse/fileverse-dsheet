# `@fileverse-dev/dsheet` — Drop-In Package & Theming

**Consolidated reference for the `maitra/drop-in-package` branch.**
Covers four workstreams: the drop-in package migration (sidebar + panels + comments), data block package ownership, smart contract package ownership, and theming (chrome + engine chrome + canvas).

**Status:** all workstreams implemented. Consumer (`dsheets.new`) switchover is tracked separately.
**Repos:** `fileverse-dev/dsheet` (the package) · `dsheets.new` (the flagship consumer app) · `fileverse-ddoc` (parity reference for theming).

**Audience:** this document is written for both humans (product + engineering) and LLM agents. Product rationale comes first in each section; technical contracts, file maps, and as-built notes follow.

**This file supersedes and replaces** (all deleted):

| Deleted file | Folded into |
|---|---|
| `docs/PRODUCT-drop-in-package.md` | §1, §2 |
| `docs/REQUIREMENTS-drop-in-package.md` | §3, §4, §9 |
| `docs/MIGRATION-sidebar-ui.md` | §3 |
| `docs/PRODUCT-datablock-package-ownership.md` | §5 |
| `docs/PRODUCT-smart-contract-package-ownership.md` | §6 |
| `docs/superpowers/specs/2026-06-12-dsheet-drop-in-package-design.md` | §2, §3, §4 |
| `docs/superpowers/specs/2026-06-15-datablock-package-ownership-design.md` | §5 |
| `docs/superpowers/specs/2026-06-18-smart-contract-package-ownership-design.md` | §6 |
| `docs/superpowers/specs/2026-06-30-dsheet-themes-design.md` | §7 |
| `docs/superpowers/specs/2026-06-30-dsheet-canvas-theming-design.md` | §7 |
| `docs/superpowers/plans/2026-06-24-sidebar-ui-migration.md` | §3 |
| `docs/superpowers/plans/2026-06-24-comments-migration.md` | §4 |
| `docs/superpowers/plans/2026-06-30-dsheet-chrome-theming.md` | §7 |
| `docs/superpowers/plans/2026-06-30-dsheet-react-theming-phase2.md` | §7 |

**Not superseded, still live:** `docs/RTC_FLOW.md`, `docs/collab-stale-ydoc-split-bug-summary.md`, `docs/superpowers/specs/2026-07-09-collab-stale-ydoc-split-design.md` — these belong to the collaboration effort (merged from `main`), not to this branch.

---

## Contents

1. [Product overview — why any of this exists](#1-product-overview--why-any-of-this-exists)
2. [The ownership principle](#2-the-ownership-principle)
3. [Sidebar system + built-in panels](#3-sidebar-system--built-in-panels)
4. [Comments](#4-comments)
5. [Data blocks](#5-data-blocks)
6. [Smart contracts](#6-smart-contracts)
7. [Theming](#7-theming)
8. [Consolidated public API](#8-consolidated-public-api)
9. [Engineering conventions & constraints](#9-engineering-conventions--constraints)
10. [Consumer (`dsheets.new`) migration](#10-consumer-dsheetsnew-migration)
11. [Known gaps, risks, and follow-ups](#11-known-gaps-risks-and-follow-ups)

---

## 1. Product overview — why any of this exists

The spreadsheet editor is offered as a reusable product other applications embed. Before this work it was not truly self-contained: the core engine shipped inside the package, but most of the surrounding interface lived inside our own flagship app (`dsheets.new`). Any team adopting the editor got a bare grid and had to rebuild the rest.

Three consequences:

- A third-party adopter had to re-create side panels, comments, API-key prompts, and smart-contract UI from scratch.
- Functionality and design drifted, because every adopter reinvented the same features differently.
- Maintenance was duplicated — improvements in one place didn't benefit anyone else.

**The goal:** a genuine drop-in. A new adopter installs the package, renders `<DSheetEditor>`, and immediately gets a working spreadsheet — side panels, comments, templates, data blocks, smart contracts, function reference — with near-zero wiring, while still being free to add their own app-specific touches on top.

**What success looks like.** A new team embeds the editor and, with only a few lines of setup, gets:

- Side panels for templates, functions, data validation, and conditional formatting — functional immediately, zero config.
- A full commenting experience (sidebar + in-cell), as long as they supply their own comment storage.
- Data blocks that work out of the box, including the API-key prompt and key storage.
- Smart contract reading, once they supply network access and answer definition lookups.
- Five themes that follow the host app's theme with no per-theme code.
- Freedom to add their own panels and navbar items on top.

---

## 2. The ownership principle

**The package owns the interface and the interactions. The adopter owns their data, identity, and business-specific actions.**

This one sentence explains every decision below. Everything the user *sees and does* moved into the package. Everything about *where bytes live and who the user is* stayed with the adopter.

### What moved into the package

| Area | What |
|---|---|
| Sidebar system | The framework that opens/closes/switches panels alongside the grid |
| Data validation panel | Where users set rules for what can be entered into cells |
| Conditional formatting panel | Where users define rules that change how cells look |
| Templates panel | Browsable gallery of ready-made templates, with hover previews |
| Functions / "Learn more" panel | Formula reference, organized by category |
| Comments sidebar | Lists comment threads; read and reply |
| In-cell comment popup | The small comment UI on a cell — empty states, input, items, action menus |
| Data block error handling | Catching failures, deciding what to do, driving recovery |
| API key prompt + storage | The modal, its input, rate-limit guidance, and default local storage |
| Smart contract UI + execution | Import flow, contract list panel, intro screen, error notices, the chain call |
| Theming | All five themes, chrome and canvas |

### What stays with the adopter

| Area | Why |
|---|---|
| Comment storage and syncing | How comments are saved, encrypted, shared, kept in sync. The package renders comments; it does not dictate transport. |
| Account and identity behavior | Login, wallet, user system — app-specific by nature. |
| App-specific navbar actions | Sharing, publishing, sign-in, collaborator indicators, community links. |
| Destructive/app-specific sheet actions | Deleting, renaming, creating documents — depends on how the app manages files. |
| Real-time collaboration plumbing | Connection and presence systems are app-specific. |
| Smart contract storage + ABI resolution | Where saved contracts live; turning a stored pointer into a full definition. |
| The entire navbar | Deliberately consumer-owned. See below. |

### The navbar is deliberately NOT migrated

An earlier plan proposed migrating the toolbar menus (File/Edit/View/Insert/Format/Data/Help) into the package as reusable pieces. **That was dropped.** The whole navbar — every menu plus app-specific items (share, publish, delete, auth) — stays in `dsheets.new`. The shortcuts modal stays too (it's triggered by the consumer-owned help menu via a `window` CustomEvent `'openShortcuts'`).

The consumer's navbar keeps calling `openPanel`, now sourced from `editorValues` rather than consumer-local sidebar state. That's the entire integration surface.

### Guiding principles and constraints

- **Framework-agnostic.** The package must work in any standard React setting — no Next.js, no app-specific tooling.
- **No new heavy dependencies.** Rely on what the package already has. (`@fileverse/ens` and externalized `viem` are the two deliberate exceptions; see §4 and §6.)
- **Defaults with escape hatches.** Everything works out of the box; adopters extend via `customPanels` and navbar composition.
- **Each stage stands alone.** `dsheets.new` must remain fully working after every stage — never half-migrated.
- **Deliberate non-customizability.** The API-key modal, the smart-contract import flow, the contract list panel, and the intro screen are intentionally *not* overridable. Keeping them owned and consistent means every adopter's users get the same reliable experience.

---

## 3. Sidebar system + built-in panels

**Status:** done in-package, verified against the `demo/` app.

### Product view

The panel system itself lives in the package: how panels open, close, toggle, switch, remember their state across reloads, and behave on mobile and in read-only mode. On top of it sit four built-in panels every adopter gets for free (templates, data validation, conditional formatting, functions), plus a fifth (comments, §4) that appears only when comment config is supplied. Adopters can register their own panels alongside the built-ins.

**Done when:** an adopter can define a custom panel and open it from a navbar button, and the four built-in panels work with no extra setup.

### Architecture

```
EditorProvider (existing)
└─ SidebarProvider (NEW — wraps children, reads isReadOnly)
   └─ EditorContent
      ├─ <nav> renderNavbar(editorValues)         // consumer navbar, now gets openPanel
      ├─ React.memo(EditorWorkbook)               // FortuneCore sheet — memoized so panel
      │                                           //   toggles never re-render it
      ├─ hidden <button>s                         // FortuneCore fires these by id
      │    #data-verification-button  → togglePanel('data-verification')
      │    #conditional-format-button → openPanel('conditional-format')
      │    #function-button           → openPanel('functions') + bump suggestion counter
      │    #smartcontract-button      → openPanel('smart-contract-list-view')
      └─ EditorRightSidebar                       // sliding drawer; renders activePanelConfig
```

- **`useRightPanels`** owns `activePanel` / `isOpen` + `openPanel` / `closePanel` / `togglePanel` / `isActive`, localStorage persistence (keys `dsheets-active-panel`, `dsheets-active-panel-state`), mobile detection (`useMediaQuery('(max-width: 840px)')`), read-mode gating (read mode allows only `comments`), and first-load auto-open of `templates` on the owner editor (desktop only).
- **`SidebarProvider` / `useSidebar()`** expose that state to the whole editor tree, including `renderNavbar`.
- **`EditorRightSidebar`** picks `top`/`height` by mode (edit: `top 83px` = 44px navbar + ~39px toolbar; read: `top 44px`) so it never overlaps the FortuneCore toolbar.
- **Unregistered panel ids are a no-op.** An `activePanelConfig !== null` guard keeps the sidebar shut rather than showing an empty ghost drawer. This is why `#smartcontract-button` can be rendered unconditionally — if no consumer registered `'smart-contract-list-view'`, clicking it does nothing.

### The hidden-DOM-button decision

FortuneCore opens data-validation, conditional-formatting, and the function reference by dispatching `document.getElementById(...).click()` on hidden buttons. Two options were on the table: (a) find the id references in `@sheet-engine/**` and replace them with direct context calls, or (b) keep the ids and render the hidden buttons inside the package's `EditorContent`.

**(b) was chosen** — simpler, safer, avoids touching the engine. Keep every `id`, `data-testid`, and class name **exactly** as-is when porting; FortuneCore and styling depend on them.

### Files created

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

### Files modified

| File | Change |
|---|---|
| `src/editor/types.ts` | `EditorValues` += `openPanel`/`closePanel`; new `PanelConfig`; `DsheetProps` += `customPanels`; re-export `PanelId`/`BuiltInPanelType` |
| `src/editor/contexts/editor-context.tsx` | wrap children in `<SidebarProvider isReadMode={isReadOnly}>` |
| `src/editor/dsheet-editor.tsx` | consume `useSidebar`; build `builtInPanels`/`activePanelConfig`; add `openPanel`/`closePanel` to `editorValues`; render `EditorRightSidebar`; hidden trigger buttons; `openTemplatesPanel` (`useCallback`) into the toolbar; functions suggestion counter |
| `src/editor/components/editor-workbook.tsx` | wrap export in `React.memo` (stops panel-toggle glitch) |
| `src/editor/styles/index.css` | add `.no-scrollbar` utility (was consumer-only) |
| `src/index.ts` | export `PanelConfig`, `PanelId`, `BuiltInPanelType` |

> `src/editor/utils/custom-toolbar-item.tsx` was **not** changed — its Templates button already called `toggleTemplateSidebar`; `EditorContent` now passes `() => togglePanel('templates')` into that slot.

### App couplings resolved (functions panel)

The functions panel was the only coupled panel — an earlier requirements doc claimed "no app-specific imports," which was **wrong**. Four consumer imports had to be replaced:

| Consumer import | Replacement |
|---|---|
| `@/db/db` `KeyStoreCache` (type only) | `Record<string, string>` |
| `next/navigation` `useSearchParams` | one-shot `new URLSearchParams(window.location.search)` read |
| `@/utils/constants` `API_KEY_PLACEHOLDER` | package's existing `src/sheet-engine/react/constants.ts` |
| `@/utils/proxy-service` `ProxyService.isProxyEnabled()` | `process.env.NEXT_PUBLIC_PROXY_MODE === 'true'` |

The URL auto-open behavior (`?dune` / `?lq` / `?price` pre-filling the function search) was preserved as a one-shot `window.location.search` read in `use-functions.tsx`. The app-specific bits dropped from `useRightPanels`: `useAccountContext`, `removeQuery`, the `identityInitialized` guard, the `sc/dune/lq/price` URL auto-open, the `isRtcShareRoute` joiner logic, and the imported `SIDEBAR_STATE_KEY`.

### Fixes discovered during verification

- **`no-scrollbar`** was a consumer-only CSS utility — added to package CSS so migrated placeholder divs don't show native scrollbars.
- **Panel width** — FortuneCore's data-validation UI is hard-coded `345px`; panel widths were set so the card fits without a right-side gap.
- **Sidebar overlapped the toolbar** — `EditorRightSidebar` now offsets `top`/`height` by `isReadOnly`.
- **UI glitch on panel toggle** — panel state lives in `EditorContent`, which was re-rendering the heavy FortuneCore `<Workbook>` on every toggle. Fixed by `React.memo(EditorWorkbook)` (it subscribes only to `EditorContext`, not the sidebar context) plus stabilizing the toolbar callback.
- **DV/CF blank panel + CF default form state** — a later refactor moved the portal registry to `activePanel`; see commit `5028596`.

> **Why DV/CF don't unmount:** the consumer version kept them permanently mounted because FortuneCore portals into their placeholder ids and never re-mounts. In the package, the built-in panel list keeps the same placeholder ids and the sidebar slides (`translateX`) rather than unmounting its `<aside>`, so the placeholder divs persist in the DOM whenever their panel is active.

### Notes

- `usehooks-ts` (`useMediaQuery`) is used by the new hook but is **bundled** by Vite (not in `rollupOptions.external`), so no new consumer dependency is required.
- Lint: migrated files carry a few `any`/`@ts-ignore` findings inherited verbatim from consumer source, consistent with the package's existing lint state.

---

## 4. Comments

**Status:** done in-package. Consumer switchover separate.

### Product view

The comments *interface* — sidebar and in-cell popup — is the package's. The adopter supplies the comment data to display plus handlers for sending a comment and for resolve/unresolve/delete. They can also provide a fallback shown when a user isn't signed in (e.g. "Please log in to comment"). If no comment configuration is provided, comments are simply off and cell markers don't appear.

Everything about *storage* — saving, encrypting, sharing between collaborators, syncing, IPFS, the indexer — stays with the adopter, forever. That is not a phase; it is the design.

### The `commentsConfig` API

```ts
export interface CommentThread {
  id: string;
  key: string;
  dsheetId: string;
  username: string;
  content: string;
  createdAt: string;
  commentIndex: number;
  cellContent?: string;
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
  isResolved?: boolean;
  isDeleted?: boolean;
}

export enum CommentAction { RESOLVE = 'resolve', UNRESOLVE = 'unresolve', DELETE = 'delete' }

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
  commentsData: Record<string, CommentThread>;   // key: `${sheetId}_${row}_${col}` or `WITHOUT_CELL_n`
  onSendComment: (key: string, textareaId: string) => void;
  onCommentAction: (action: CommentActionParams) => void;
  userName?: string;
  ownerAddress?: string;
  currentUserAddress?: string;   // for permission author-match
  isOwner?: boolean;             // owner can delete/resolve anything
  isAuthenticated?: boolean;     // default true; false → unauthenticatedFallback in the cell popup
  unauthenticatedFallback?: React.ReactNode;
  ensResolutionUrl?: string;     // mainnet RPC URL; enables ENS name + verified badge. Omit → raw names.
}
```

Omit `commentsConfig` entirely → no `comments` panel, no cell markers, no `getCommentCellUI`.

### `getCommentCellUI` is built inside the package

`<Workbook>` accepts a `getCommentCellUI` prop. It used to come from the consumer. Now `EditorWorkbook` builds it internally from `commentsConfig`:

```ts
const removeCommentFromCell = useCallback((row, col) => {
  hideCellCommentMarker(sheetEditorRef, row, col);
}, [sheetEditorRef]);

const getCommentCellUI = useMemo(() => {
  if (!commentsConfig) return undefined;
  const isAuthed = commentsConfig.isAuthenticated ?? true;
  return (row, col, dragHandler, isHover) => {
    const sheetId = getCurrentSheetIdSafe(sheetEditorRef);
    const key = `${sheetId}_${row}_${col}`;
    const comment = commentsConfig.commentsData[key];
    if (!isAuthed) return commentsConfig.unauthenticatedFallback ?? null;
    return <CommentCellUI row={row} col={col} sheetId={sheetId} comment={comment} /* … */ />;
  };
}, [commentsConfig, sheetEditorRef, removeCommentFromCell]);
```

`editor-context.tsx` derives the legacy internals from config:

```ts
const commentData = commentsConfig?.commentsData;
const allowComments = !!commentsConfig;
```

### ENS resolution — handled in-package

A comment/reply `username` is either free text or a `0x…` address. When `ensResolutionUrl` is set, the package resolves addresses to ENS names (mainnet) and shows a verified badge; otherwise it renders the raw name/address. Modeled on the ddoc editor:

- **`@fileverse/ens` `getAddressName(address, providerUrl)`** does the lookup. Contract: invalid address → `{ name: address, isEns: false, resolved: false }` (no network); ENS found → `{ name, isEns: true, resolved: true }`; valid address, no ENS → `{ name: address, isEns: false, resolved: true }`; error → `{ …, resolved: false }`.
- **A module-level cache singleton** (`ens/ens-cache.ts`) — not a React store, the package has none. Holds the configured URL, an in-memory `Map`, an in-flight `Set` for de-dup, subscriber callbacks, and persists to `localStorage['dsheet-ens-cache']`. Only `resolved: true` results are cached (transient failures retry).
- **`useEnsStatus(username)`** → `{ name, isEns }`. Cache hit returns immediately; a miss triggers a deduped resolve and re-renders on completion. Plain names short-circuit inside `getAddressName` and never hit the network.
- The URL is pushed into the singleton once from `EditorContent` (`setEnsResolutionUrl(commentsConfig?.ensResolutionUrl)`), which sidesteps prop-drilling/context-scope problems across the FortuneCore popup portal.

The verified badge is **asset-free**: `LucideIcon BadgeCheck` (blue), not the consumer's `verified.svg`. Avatars always render `<Avatar content="text">` — the badge already signals ENS.

### App couplings resolved

| Consumer coupling | Resolution |
|---|---|
| `useENSName` (app hook) | in-package `useEnsStatus` + module cache, gated by `ensResolutionUrl` |
| `useRTCContext` (comment input disabled during RTC) | dropped; package hardcodes `enableCollaboration = false` |
| `usePathname` (`/share` route → collab mode) | dropped |
| `next/image`, `'use client'` | `<img>`; directive deleted |
| `CommentsItem` from `@/db/comments/types` | package-local `CommentThread` |
| Wallet-based `useCommentPermissions` | **pure** hook — `isOwner` / `currentUserAddress` injected from config |
| `usePlausibleEvents` in `comment-input` | removed |
| `selectedComment` / `onCommentSelect` props | now internal `useState` in `CommentsContent` |
| `removeCommentFromCell` (consumer-owned) | package-owned via `cell-comment-marker` |

The permissions hook is deliberately pure:

```ts
export const useCommentPermissions = (
  ownerAddress?, currentUserName?, currentUserAddress?, isOwner = false,
) => useMemo(() => {
  const canModify = (item: { username: string }) =>
    isOwner || currentUserAddress === item.username || currentUserName === item.username;
  return { canDeleteComment: canModify, canResolveComment: canModify,
           canDeleteReply: canModify, canResolveReply: canModify, isOwner };
}, [isOwner, currentUserAddress, currentUserName]);
```

### Files created

```
src/editor/types/comments.ts                       # all comment types + UI prop types
src/editor/utils/comment-key-utils.ts              # pure: parseCellKey, generateWithoutCellKey,
                                                   #   getCellReference, formatCommentDateTime, isCellComment
src/editor/utils/sheet-editor-safe.ts              # moved verbatim (clean)
src/editor/utils/cell-comment-marker.ts            # moved; getFlowdata from @sheet-engine/core
src/editor/components/comments/use-comment-permissions.ts   # PURE
src/editor/components/comments/ens/ens-cache.ts             # module singleton
src/editor/components/comments/ens/use-ens-status.ts
src/editor/components/comments/comment-input.tsx
src/editor/components/comments/comment-actions-dropdown.tsx
src/editor/components/comments/comment-item.tsx
src/editor/components/comments/comment-sidebar-empty.tsx
src/editor/components/comments/comment-sidebar.tsx          # CommentsContent
src/editor/components/comments/comment-cell-popup.tsx       # CommentCellUI
src/editor/components/comments/use-comment-cell-popup.ts
```

New dependency: `@fileverse/ens` `^0.0.4`.

Preserved verbatim (FortuneCore + styling depend on them): `comment-box-${row}_${col}`, `comment-scroll`, `comment-cell`.

### Breaking changes

| Removed prop | Replacement |
|---|---|
| `commentData` | `commentsConfig.commentsData` |
| `getCommentCellUI` | `commentsConfig` (package renders `CommentCellUI` internally) |
| `allowComments` | omit `commentsConfig` to disable |
| `toggleTemplateSidebar` | `openPanel('templates')` via `editorValues` |
| `isTemplateOpen` | internal sidebar state |

---

## 5. Data blocks

**Status:** implemented (commit `8b5d07a` "package cleanup for datablock", plus follow-ups `f83f694`, `4032862`).

### Product view

A data block lets a user pull live external data into a cell by typing a formula — a crypto price, market data, whatever the service offers. Some services need an API key. The experience has to gracefully handle the moment a user needs a key, let them enter it, store it, and continue without losing their work.

**Before:** every embedding product had to build the error-catching logic, build and manage the API-key prompt, track which key was being requested, store and retrieve keys, and keep all of it in sync. A lot of responsibility, complex, repetitive, and any mistake degrades the end-user experience.

**After:** the package owns the whole thing. The product configures **nothing**. It optionally subscribes to one lifecycle event stream for its own analytics.

The user-facing flow:

1. User types a formula that pulls external data.
2. Success → the cell fills with the result.
3. The service needs a key the user hasn't provided:
   - The cell shows a clear "Waiting for API key…" state so the user isn't confused.
   - A prompt appears asking for the key.
   - On save, the key is stored automatically.
   - The formula re-runs on its own and fills the cell.
4. Any other failure → the cell shows a clear error indicator.

The user never loses their place.

### Internal flow (end to end)

```
User types formula in cell
  → @sheet-engine fires afterUpdateCell
  → afterUpdateCell.tsx calls executeStringFunction
    → SUCCESS → formulaResponseUiSync updates cell → onDataBlockEvent({ type: 'success' })
    → ERROR → handleDataBlockError(error, context)
        → if LIVE_QUERY_ERROR: no-op (handled elsewhere)
        → if RATE_LIMIT or MISSING_KEY:
            → onDataBlockEvent({ type: 'error', errorType, functionName })
            → onDataBlockEvent({ type: 'api-key-required', apiKeyName })
            → set cell value to 'Waiting for API key...'
            → open ApiKeyModal via EditorContext (setApiKeyModalState)
            → await user saves key
            → apiKeyStorage.set(name, key)
            → onDataBlockEvent({ type: 'api-key-saved', apiKeyName })
            → onDataBlockEvent({ type: 'retry', functionName })
            → re-execute formula → formulaResponseUiSync
        → else:
            → onDataBlockEvent({ type: 'error', errorType, functionName })
            → set cell value to '#ERROR_TYPE'
```

### A cleaner recovery mechanism

The old `datablockErrorMessagesHandler` polled `openApiKeyModalRef` **every 1ms** until the modal closed. That was replaced by a promise that resolves when the modal's `onSave` fires:

```ts
// old: poll ref every 1ms until false
// new: await a promise that resolves when the user saves the key
const key = await new Promise<string>((resolve) => {
  openApiKeyModal(apiKeyName, (savedKey) => resolve(savedKey));
});
```

Same seamless user-facing result; smoother and far less wasteful.

### API

**Removed props:**

| Prop | Why |
|---|---|
| `dataBlockApiKeyHandler` | Package handles the error flow internally |
| `storeApiKey` | Package handles via `apiKeyStorage.set` |
| `onDataBlockApiResponse` | Replaced by the richer `onDataBlockEvent` (its success case is `type: 'success'`) |

**Added props:**

```ts
apiKeyStorage?: ApiKeyStorage;                       // optional — override where keys are stored
onDataBlockEvent?: (event: DataBlockEvent) => void;  // optional — lifecycle events for analytics/logging
```

**New exported types:**

```ts
export type DataBlockEventType =
  | 'success' | 'error' | 'api-key-required' | 'api-key-saved' | 'retry';

export interface DataBlockEvent {
  type: DataBlockEventType;
  functionName?: string;   // e.g. 'COINGECKO'
  errorType?: string;      // ERROR_MESSAGES_FLAG value on error
  apiKeyName?: string;     // e.g. 'COINGECKO_API_KEY'
}

export interface ApiKeyStorage {
  get: (name: string) => string | null;
  set: (name: string, key: string) => void;
  remove?: (name: string) => void;
}
```

Default storage is local to the user's device:

```ts
export const defaultApiKeyStorage: ApiKeyStorage = {
  get:    (name) => localStorage.getItem(`dsheet-apikey-${name}`),
  set:    (name, key) => localStorage.setItem(`dsheet-apikey-${name}`, key),
  remove: (name) => localStorage.removeItem(`dsheet-apikey-${name}`),
};
```

A product needing keys elsewhere (e.g. its own secure backend) supplies its own `apiKeyStorage`. Most won't.

### `EditorContext` + `afterUpdateCell` changes

`EditorContext` gained imperative modal state:

```ts
interface ApiKeyModalState {
  open: boolean;
  apiKeyName: string;
  onSave: (key: string) => void;
  onClose: () => void;
}

const openApiKeyModal = (apiKeyName: string, onSave: (key: string) => void) => {
  setApiKeyModalState({
    open: true,
    apiKeyName,
    onSave: (key) => { setApiKeyModalState(null); onSave(key); },
    onClose: () => setApiKeyModalState(null),
  });
};
```

`EditorContent` renders `<ApiKeyModal>` driven by that state. `afterUpdateCell`'s params changed from consumer-supplied handlers to internal package deps:

```ts
// BEFORE (from consumer):
dataBlockApiKeyHandler: DataBlockApiKeyHandlerType | undefined;
storeApiKey?: (apiKeyName: string) => void;

// AFTER (internal):
apiKeyStorage: ApiKeyStorage;
openApiKeyModal: (apiKeyName: string, onSave: (key: string) => void) => void;
onDataBlockEvent?: (event: DataBlockEvent) => void;
```

### Files moved, and what was stripped

| Source (dsheets.new) | Destination (package) | Stripped |
|---|---|---|
| `components/api-key-modal/api-key-modal.tsx` | `src/editor/components/api-key-modal/api-key-modal.tsx` | `@sentry/nextjs` `captureException`; `next/image` → `<img>`; `@/public/assets/anime.svg` → package-local `src/editor/assets/anime.svg`; `getApiKey` → `apiKeyStorage.get` |
| `components/api-key-modal/api-key-input.tsx` | `src/editor/components/api-key-modal/api-key-input.tsx` | — |
| `components/api-key-modal/rate-limit-info.tsx` | `src/editor/components/api-key-modal/rate-limit-info.tsx` | — |
| `components/function/api-keys/local-storage-helper.ts` | `src/editor/utils/api-key-storage.ts` | becomes default `ApiKeyStorage` impl |
| `datablockErrorMessagesHandler` (inline) | `src/editor/utils/data-block-error-handler.ts` | Sentry; ref polling → promise; localStorage → adapter |

**The `ApiKeyModal` is not exported.** It is internal only and intentionally not customizable — every product's users get the same reliable key-entry experience.

### Consumer before/after

```tsx
// BEFORE
const { openApiKeyModal, setOpenApiKeyModal, openApiKeyModalRef, contextApiKeyName } = useApiKeyModal();
const { updateKeyStoreWithApiKey } = useApiKeyStore();

<DSheetEditor
  storeApiKey={(keyName) => updateKeyStoreWithApiKey(keyName, getApiKey(keyName))}
  dataBlockApiKeyHandler={(handlerArg) => {
    onDataBlockFailedResponsePlausible(handlerArg.data.functionName || '');
    datablockErrorMessagesHandler({ ...handlerArg, contextApiKeyName, setOpenApiKeyModal, openApiKeyModalRef });
  }}
  onDataBlockApiResponse={(name) => { /* analytics + onboarding side-effect */ }}
/>
<ApiKeyModal onSaveApiKey={updateKeyStoreWithApiKey} openApiKeyModal={openApiKeyModal}
  setOpenApiKeyModal={setOpenApiKeyModal} openApiKeyModalRef={openApiKeyModalRef}
  contextApiKeyName={contextApiKeyName} />

// AFTER
<DSheetEditor
  onDataBlockEvent={(event) => {
    if (event.type === 'success') onDataBlockApiResponsePlausible(event.functionName || '');
    if (event.type === 'error') onDataBlockFailedResponsePlausible(event.functionName || '');
    if (event.type === 'success' && localStorage.getItem('onboardingComplete') === 'processing') {
      setShowMobileViewWarning(true);
    }
  }}
/>
// ApiKeyModal renders automatically inside DSheetEditor. Nothing else needed.
```

Consumer files to delete: `components/api-key-modal/**`, `components/dsheet-editor/hooks/use-api-key-modal.ts`. Check `use-api-key-store.ts` for other call sites before deleting.

---

## 6. Smart contracts

**Status:** implemented (commit `7aaabe0` "Move smart contract UI and execution into the package. (#405)").
**Model:** resolver-callback. This supersedes an earlier inline-ABI design — see "Why resolver-callback" below.

### Product view

Smart contract reading lets a user pull live blockchain data into a cell by typing a formula. The user adds a contract once, then references its functions in formulas.

**Before:** the product built the blockchain-call logic, managed the saved-contract list and its state, wired up the import flow and its open/closed state, supplied the contract list panel, and placed the import flow, intro screen, and error notices itself.

**After:** the package owns the entire user-facing experience *and* the reading logic. The product keeps two things it already does well: **storing** saved contracts, and **looking up** a contract's full definition (ABI) when asked.

**Storage is unchanged, so there is no data migration.** Existing users' saved contracts keep working untouched.

### The ownership split — the core idea

- **The package owns:** the import flow, the contract list panel, the intro screen, error notices, the in-memory registry, and the blockchain read execution.
- **The product owns:** storage (where contracts physically live and how changes persist) and ABI resolution (turning a stored pointer into a full definition).

The package keeps no storage of its own. It works from the list the product hands it, and asks the product to resolve an ABI only when a formula actually reads that contract — once per contract per session, then cached.

### Key decisions (locked)

| Decision | Choice |
|---|---|
| Contract persistence | **Consumer-owned, unchanged.** Package never reads/writes storage. |
| ABI resolution | **Consumer-owned via `resolveAbi(abiHash)`.** Package calls lazily, caches. No IPFS dependency in the package. |
| `ContractConfig` shape | Keeps `abiHash` (reference). **No inline ABI, no migration.** |
| ABI caching | In-memory, one fetch per contract per session. |
| `viem` in bundle | **Externalized** — consumer installs it. |
| Chain config | Consumer passes `rpcConfig: Partial<Record<SupportedChain, string>>`. |
| Popular contracts | Bundled in the package with full ABI inline — no resolver call needed. |
| Input validation | Generic checks (valid address, parseable ABI JSON) in the package; optional `validateAddress` callback for consumer-specific rules. |

### The `smartContracts` prop

```ts
export interface SmartContractConfig {
  // Required: RPC URL per chain. Package creates the viem publicClient from these.
  rpcConfig: Partial<Record<SupportedChain, string>>;

  // Required: consumer-loaded contract REFERENCES (no ABI, just the pointer).
  contracts: ContractConfig[];

  // Required: resolve an ABI from its pointer. Package calls lazily at read time
  // and caches. Consumer implements however it stores ABIs (e.g. IPFS by hash).
  resolveAbi: (abiHash: string) => Promise<Abi>;

  // Package calls when the user imports via the modal. Package hands over the raw
  // ABI; consumer persists however it wants and updates the `contracts` prop.
  onAddContract: (contract: NewContractInput) => Promise<void>;

  // Package calls when the user deletes from the list panel.
  onDeleteContract: (contractName: string) => Promise<void>;

  // Optional: consumer-specific address validation (e.g. portal lookup).
  // Package always runs generic format validation first.
  validateAddress?: (address: string, chain: SupportedChain) => Promise<boolean> | boolean;

  // Optional: lifecycle callbacks for analytics/error logging.
  onSmartContractEvent?: (event: SmartContractEvent) => void;
}
```

Not passed → SC formula cells return `#SC_DISABLED`; the SmartContract button is hidden from the toolbar. Nothing breaks.

### Types

```ts
// Reference — the same shape consumers already store. No conversion of user data.
export interface ContractConfig {
  address: Hex;
  abiHash: string;       // IPFS pointer (or any consumer-defined key). Package never
                         // resolves this itself — it passes it to resolveAbi.
  network: SupportedChain;
  name: string;
}

// What the modal hands the consumer on add — the package gives the raw ABI and lets
// the consumer decide how to turn it into a stored reference. The package never
// produces or stores abiHash.
export interface NewContractInput {
  address: Hex;
  abi: Abi;
  network: SupportedChain;
  name: string;
}

// Internal to the package — not exported.
interface ResolvedContract {
  address: Hex;
  abi: Abi;              // present once resolved (or inline for popular contracts)
  network: SupportedChain;
  name: string;
}

export interface SmartContractEvent {
  type: 'query-success' | 'query-error' | 'contract-added' | 'contract-deleted';
  contractName?: string;
  functionName?: string;
  chainName?: string;
  errorMessage?: string;
}

export enum SupportedChain {
  Ethereum = 'Ethereum',
  Sepolia  = 'Sepolia',
  Gnosis   = 'Gnosis',
  Base     = 'Base',
}
```

**Removed props:** `handleSmartContractQuery` (package implements the call), `setShowSmartContractModal` (package manages modal state via EditorContext).

### Registry + lazy ABI resolution

`src/editor/hooks/use-smart-contract-reading.ts` — no storage, no IPFS. Builds an in-memory registry of references from the `contracts` prop merged with bundled popular contracts, resolving ABIs lazily:

```ts
const referenceMapRef = useRef<Record<string, ContractConfig | ResolvedContract>>({});
const abiCacheRef = useRef<Record<string, Abi>>({});  // keyed by abiHash

useEffect(() => {
  const userMap = Object.fromEntries(contracts.map(c => [c.name, c]));
  referenceMapRef.current = { ...userMap, ...POPULAR_CONTRACTS_MAP };
}, [contracts]);

const getAbi = async (entry): Promise<Abi> => {
  if ('abi' in entry) return entry.abi;                 // popular contract, inline
  if (abiCacheRef.current[entry.abiHash]) return abiCacheRef.current[entry.abiHash];
  const abi = await resolveAbi(entry.abiHash);          // consumer fetches (e.g. IPFS)
  abiCacheRef.current[entry.abiHash] = abi;
  return abi;
};
```

### Read flow (end to end)

```
User types SC formula in cell
  → afterUpdateCell triggers the smart contract handler (from EditorContext)
  → look up reference by name in registry
      → not found → #SC_NOT_FOUND
  → getAbi(entry)
      → inline (popular)         → use directly
      → cached (abiHash seen)    → use cache
      → else                     → await resolveAbi(abiHash) → cache
          → resolveAbi rejects   → #SC_ABI_ERROR + fire query-error
  → createSmartContractClient(network, rpcConfig)
  → executeSmartContractCall(client, address, abi, fn, args)
      → success → write result to cell → fire query-success
      → error   → #SC_* error + fire query-error
```

Client construction is driven by the prop, not a hardcoded map:

```ts
export const createSmartContractClient = (
  chain: SupportedChain,
  rpcConfig: Partial<Record<SupportedChain, string>>
) => {
  const rpcUrl = rpcConfig[chain];
  if (!rpcUrl) throw new UnsupportedChainError(chain);
  return createPublicClient({ chain: SUPPORTED_VIEM_CHAIN_MAP[chain], transport: http(rpcUrl) });
};
```

### Files moved, and what was stripped

| Source (dsheets.new `smart-contract-reading/`) | Destination (package) | Stripped |
|---|---|---|
| `types.ts` | `src/editor/types/smart-contract.ts` | fileverse-specific types |
| `error-helper.ts` | `src/editor/utils/smart-contract/error-helper.ts` | — |
| `helpers.ts` | `src/editor/utils/smart-contract/helpers.ts` | — |
| `smart-contract-reading-utils.ts` | `src/editor/utils/smart-contract/reading-utils.ts` | IPFS fetch, keystore, Sentry, DB cache, ucans, AgentInstance |
| `use-smart-contract-reading.tsx` | `src/editor/hooks/use-smart-contract-reading.ts` | all storage/IPFS — uses `contracts` + `resolveAbi` + callbacks |
| `use-smart-contract-modal.ts` | `src/editor/hooks/use-smart-contract-modal.ts` | app-specific validation deps |
| `smart-contract-modal.tsx`, `smart-contract-modal-ui.tsx`, `modal/*.tsx` | `src/editor/components/smart-contract/**` | `next/image`, `'use client'` |
| `smart-contract-view-list.tsx`, `smart-contract-list-item.tsx` | `src/editor/components/smart-contract/**` | — |
| `smart-contract-reading-intro.tsx` | `src/editor/components/smart-contract/smart-contract-intro.tsx` | `next/image` |
| `error-toast.tsx` | `src/editor/components/smart-contract/error-toast.tsx` | — |
| `constants.ts` | `src/editor/utils/smart-contract/constants.ts` | `RPC_URL_MAP` / `DEV_RPC_URL_MAP` |
| `index.css` | `src/editor/styles/smart-contract.css` | — |

**Removed from the hook:** `useAccountContext` (identity not needed), `KSRInstance`/`getKeyStoreData` (keystore gone), `publicIPFSUpload`/`getIPFSAsset` (IPFS gone), `usePlausibleEvents` (→ `onSmartContractEvent`), `captureException` (→ consumer, via the event stream).

**Stayed in dsheets.new** (these back the consumer callbacks): `getIPFSAsset` (inside `resolveAbi`), the IPFS ABI upload helper (inside `onAddContract`), keystore read/write (loads `contracts`, backs add/delete), portal address validation (inside `validateAddress`).

**Reading-utils changes:** `parseCallSignature` no longer calls `getIPFSAsset` (the ABI is supplied by the caller); `getContractConfig` dropped `getPortalContractConfig` (registry lookup by name only); `pushSmartContractToKeyStore` / `deleteContractFromKeyStore` not moved — replaced by the callbacks. `POPULAR_CONTRACTS_MAP` moved into package constants with **full ABI objects bundled inline**, available to all consumers automatically.

### `viem` as an external dependency

```ts
// vite.config.ts rollupOptions.external
'viem',
'viem/chains',
```

```bash
npm install @fileverse-dev/dsheet viem
```

**Trade-off, deliberate and accepted:** because SC lives in the same entry, *every* `DSheetEditor` consumer must install `viem`, even ones that never touch smart contracts. If this proves painful for teams that don't use the feature, the alternative — deferring SC utils to a dynamic import — can be revisited based on their feedback. Not needed now.

### Built-in panel + modal

Auto-registered when `smartContracts` is present:

```ts
{
  id: 'smart-contract-list-view',
  header: { title: 'My Smart Contracts' },
  width: '380px',
  content: <SmartContractListView userSmartContracts={contracts} onDelete={onDeleteContract}
             handleSearch={handleSearch} setShowSmartContractModal={setShowSmartContractModal} />,
}
```

Import flow: user enters address/chain/ABI JSON/name → package runs generic validation (address format, parseable ABI) → if `validateAddress` is provided, package awaits it → on pass, `onAddContract({ address, network, name, abi })`. The consumer persists (e.g. upload ABI to IPFS, store `abiHash`) and updates `contracts`; the package re-syncs via `useEffect`. **The package never uploads to IPFS or computes a hash.**

`SmartContractListView`, `SmartContractModal`, `SmartContractIntro` are **internal only, not exported** — deliberately not customizable.

### Consumer usage (dsheets.new)

```tsx
const [contracts, setContracts] = useState<ContractConfig[]>([]);

useEffect(() => {
  // load references (with abiHash) from keystore — no ABI fetch here
  getKeyStoreData(portalAddress, hash).then(d =>
    setContracts(Object.values(d.smartContracts || {}))
  );
}, [portalAddress]);

<DSheetEditor
  smartContracts={{
    rpcConfig: {
      Ethereum: process.env.NEXT_PUBLIC_ETH_RPC_URL,
      Base: process.env.NEXT_PUBLIC_BASE_RPC_URL,
      Gnosis: process.env.NEXT_PUBLIC_GNOSIS_RPC_URL,
      Sepolia: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
    },
    contracts,
    resolveAbi: async (abiHash) => getIPFSAsset(abiHash),
    onAddContract: async ({ address, abi, network, name }) => {
      const abiHash = await publicIPFSUpload(JSON.stringify(abi));
      const ref = { address, abiHash, network, name };
      await updateKeyStoreData({ smartContracts: { ...keystoreContracts, [name]: ref } });
      setContracts(prev => [...prev, ref]);
      onSmartContractAdd(); // analytics
    },
    onDeleteContract: async (name) => {
      const updated = contracts.filter(c => c.name !== name);
      await updateKeyStoreData({ smartContracts: Object.fromEntries(updated.map(c => [c.name, c])) });
      setContracts(updated);
    },
    validateAddress: async (address) => isValidPortalAddress(address),
    onSmartContractEvent: (event) => {
      if (event.type === 'query-success') onUseSmartContractReading();
      if (event.type === 'query-error') captureException(new Error(event.errorMessage));
    },
  }}
/>
// Modal, list view, intro, error toast all render inside DSheetEditor automatically
```

### Why resolver-callback (vs inline-ABI)

An earlier revision inlined the full ABI into each `ContractConfig`. This design replaced it.

**Wins**
- **No data migration.** Existing `abiHash` keystores work unchanged.
- **No storage/sync bloat.** References stay ~46-byte hashes, not tens-of-KB ABIs. IPFS content-addressing/dedup is preserved.
- **Lazy.** Only ABIs of contracts actually referenced in formulas are fetched, once per session, then cached.
- The package stays fully IPFS-free.

**Costs**
- First read of each contract per session awaits `resolveAbi` (network latency), then it's instant.
- A `resolveAbi` failure is a per-cell read failure (`#SC_ABI_ERROR`) — isolated by the cache, other contracts unaffected.
- The feature requires the consumer to implement `resolveAbi`; a consumer with no ABI store of its own cannot use SC reading. Acceptable — keeping consumer-owned storage is the explicit premise.

---

## 7. Theming

**Companion cross-repo reference:** `fileverse-ddoc/docs/THEMES.md` — read it for the token system, the five themes, and the `<html>`-class switch mechanism.

### Product view

A doc and a sheet should look consistent in any theme the host app offers. Five themes, full parity with ddoc. A "dark sheet" should look dark — not a bright grid inside a dark frame.

### The five themes

`<html>` class values and labels (must match ddoc):

| Class | Label | Grid family |
|---|---|---|
| `light`       | Light   | light |
| `dark`        | Dark    | dark |
| `theme-sepia` | Sepia   | light |
| `theme-pink`  | Keith   | light |
| `theme-green` | Naomiii | dark |

"Family" only guides palette *authoring* (dark families get dark surfaces + light text). There is **no runtime branching on family** and **no inversion of user data** — the per-theme palette is a static lookup.

### Two rendering worlds, three phases

dsheet has two rendering worlds and they need completely different mechanisms:

| World | What | Themed by | Phase |
|---|---|---|---|
| **Chrome** | toolbar wrapper, sidebars, comments, dialogs, chips — `src/editor/**` | CSS cascade off the `<html>` class via `@fileverse/ui` `.color-*` utilities | **1** ✅ committed (`01c698f`) |
| **Engine chrome** | toolbar, context menu, dialogs, overlays, tabs, data tools — `src/sheet-engine/react/**` | same CSS cascade | **2a** ✅ committed (`e31e56f`, `244c94e`, `560e8d9`) |
| **Canvas/grid** | the Luckysheet/Fortune canvas + in-cell editor — `src/sheet-engine/core/**` + `SheetOverlay` | JS color resolution (canvas can't read CSS vars) + a `theme` prop + explicit repaint | **3** ✅ implemented (`faa7000`) |

**Deferred:** ddocs.new app integration (separate spec); a shared `ThemeKey` constant package across ddoc/dsheet.

### Phase 1 + 2a — chrome by pure CSS cascade

A theme is a class on `<html>`. `@fileverse/ui` ships token blocks for each and `.color-*` utilities that read them. Any markup painted with `.color-*` repaints automatically when the class changes — **no re-render, no prop, no JS**.

The work was pure gap-filling: 56 spots in `src/editor/**` already used `.color-*`; ~90 still hardcoded colors (`bg-white`, `text-black`, `text-gray-600`, `bg-[#363B3F]`, `bg-[#F8F9FA]`, …) or used ad-hoc `dark:` Tailwind variants. Those broke in non-light themes. Phase 2a repeated the exercise across `src/sheet-engine/react/**`.

**No `theme` prop, no provider in the package for chrome.** Chrome needs only the `<html>` class, which the host sets. The demo already wraps in `@fileverse/ui`'s `ThemeProvider` (`demo/src/main.tsx`); ddocs.new already sets the class. Nothing to thread. Integration contract for chrome: **none** — import `@fileverse-dev/dsheet/styles` and render under the app's existing provider.

**Decisions (locked)**

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Theme scope | **All 5** | Parity so a doc and a sheet look consistent. Free once colors are semantic. |
| 2 | How chrome learns the theme | **CSS cascade off `<html>` class** (no prop) | Chrome is DOM/CSS; matches ddoc chrome. |
| 3 | Hardcoded color fix | **Convert to `.color-*` semantic utilities** | The `@fileverse/ui` contract. |
| 4 | Ad-hoc `dark:` variants | **Replace with `.color-*`** | `dark:` only triggers on `.dark`; it ignores sepia/pink/green. |
| 5 | `#efc703` selection accent | **Constant across all themes** | dsheet brand; readable on every background. |
| 6 | Export/data color code | **Out of scope, stays literal** | `xlsx-*` ARGB, `csv-import` hyperlink `rgb(0,0,255)`, `formula-ui-sync` `STATIC_LINE_BG` are file/data values, not UI. |
| 7 | Provider/toggle ownership | **Consume only, no fork** | Avoids multi-place duplication. Demo uses ui's provider; ddocs.new uses its own. |
| 8 | `@fileverse/ui` version | **Bumped 5.0.2 → 5.1.9** (`^5.1.9`, matches ddoc) | **Required precondition, discovered during build.** 5.0.2 ships only `:root` + `.dark` token blocks — no `.theme-sepia`/`.theme-pink`/`.theme-green`. Under those classes `.color-*` falls back to light. 5.1.9 adds all four blocks AND upgrades `ThemeToggle` to the 5-theme selector. **Without this bump Phase 1 themes light+dark only.** |

**Canonical color mapping** (applied consistently; `.color-*` in tsx, `hsl(var(--color-*))` in css):

| Hardcoded | Token |
|---|---|
| `bg-white`, `#fff`, `#ffffff`, `white` (surface) | `color-bg-default` |
| `bg-gray-50/100`, `bg-[#F8F9FA]`, `bg-[#F2F4F5]` | `color-bg-secondary` |
| `hover:bg-gray-200`, gray-100/200 used as hover | `hover:color-bg-default-hover` |
| `text-black`, `text-[#363B3F]`, `text-gray-800`, `#333` | `color-text-default` |
| `text-gray-500/600`, `text-[#77818A]`, `#525c6f`, `#535a68` | `color-text-secondary` |
| `border-white`, `border-gray-*`, `border-[#E8EBEC]`, `#ccced2`, `#d4d4d4` | `color-border-default` |
| `!bg-[#000] !text-[#fff]` (selected pill) | `!color-bg-default-inverse !color-text-inverse` |
| `text-[#FB3449]`, `#ff0000`, `red` (danger text) | `color-text-danger` |
| `bg-green-100` / `text-green-800`, `bg-[#177E23]` | `color-bg-success` / `color-text-success` |
| white text/icon ON a colored (brand/success/danger) fill | `color-text-inverse` — **NOT** `color-text-on-brand`, which is near-black |
| inline `background: '#ffffff'` / `border: '1px solid #E8EBEC'` | remove inline color; add the class |

**Kept literal — confirmed brand/feature accents, do not convert:**

- `#efc703` / `#EFC703` — selection accent, constant across themes.
- `custom-toolbar-item.tsx`: fetch-url `#1977E4*`, template `#CF1C82*`.
- `smart-contract.tsx`: `#fef2ef`, `#F95738` (feature accent).
- `function-metadata.tsx`: `text-[#5c0aff]` (purple feature accent).
- `import-button-ui.tsx`: `bg-[#F5A623]/20 text-[#7A4F00]` (warning banner — no warning token exists).
- `#0188fb` and similar interactive blues in the engine — left literal this round; a follow-up decides `color-text-link` / `color-border-active`.
- `.fortune-tooltip` — **kept literal dark**, NOT `color-*-inverse`. A fixed dark tooltip is theme-agnostic, like the selection accent.
- SVG `fill="#..."` path colors in `SVGDefines.tsx` / `SVGIcon.tsx` — brand glyphs or `currentColor`.
- `backgroundColor: 'red!important'` in `import-button-ui.tsx:119` and `read-only-export-button.tsx:33` — invalid inline CSS (the `!important` makes it a no-op), a dev leftover, out of scope.

**Available token families** (verify against `node_modules/@fileverse/ui/dist/index.css` before using — never invent a token name): `color-bg-{default,default-hover,default-active,default-inverse,secondary,secondary-hover,tertiary,brand,brand-hover,brand-light,success,success-light,danger,danger-light,disabled,tooltip}`, `color-text-{default,secondary,disabled,danger,success,inverse,link,on-brand,tooltip}`, `color-border-{default,hover,active,focused,danger,success,info,disabled}`, `color-icon-{…}`. If a needed surface has no exact token, use the closest and flag it — do not re-introduce a hardcoded value.

**dsheet-authored `index.css` overrides** (in scope — this is dsheet's own stylesheet, not fortune-react component code):

| Selector | Action |
|---|---|
| `.luckysheet-postil-show-main` (inline-comment popup) | `background: white` → `hsl(var(--color-bg-default))`; `border: 1px solid #e8ebec` → `hsl(var(--color-border-default))` |
| `.fortune-tooltip` | keep literal dark (see above) |
| `.fetch-url-button` `#1977e4`, `.template-button:hover` `#cf1c821f` | brand accents — keep |
| `.luckysheet-cs-fillhandle`, `.fortune-cell-selected-*`, `.luckysheet-input-box-inner` (`#efc703`) | selection accent — keep constant |

**Delivery chain (chrome):**

```
@fileverse/ui  dist/index.css  (token blocks + .color-*)
      ▼  (already imported)
@fileverse-dev/dsheet
   src/editor/styles/index.css : @import '@fileverse/ui/styles'
   src/editor/** + src/sheet-engine/react/** : .color-* utilities  → chrome themed
      ▼
host (demo today, ddocs.new later)
   <html class> set by provider → chrome repaints via CSS cascade. Zero dsheet wiring.
```

**Sweep commands** used as the gate (chrome should produce no hits beyond allowed accents):

```bash
# editor chrome
grep -rnE "bg-white|bg-black|text-white|text-black|text-gray-[0-9]|bg-gray-[0-9]|border-gray-[0-9]|border-white|bg-green-|text-green-|dark:" \
  src/editor --include="*.tsx" --include="*.ts" | grep -vE "xlsx-|csv-import|formula-ui-sync|xlsx-hyperlink"

# engine chrome
grep -rnE "bg-white|bg-black|text-white|text-black|text-gray-[0-9]|bg-gray-[0-9]|border-gray-[0-9]|dark:|#[0-9a-fA-F]{3,6}" \
  src/sheet-engine/react --include="*.tsx" --include="*.ts" --include="*.css"
```

**Phase 2a residual:** hardcoded chrome grays are gone across all of `src/sheet-engine/react/**`; Toolbar + ContextMenu fully done. Outstanding before Phase 2a is formally closed: a final holistic review + build gate, and human visual QA across all 5 themes.

### Phase 3 — canvas/grid + in-cell editor

**Why it's its own phase.** The grid is painted to a `<canvas>` by `src/sheet-engine/core/canvas.ts` with ~81 hardcoded hex literals. **Canvas cannot read CSS variables.** So it needs its own JS color-resolution layer, its own theme signal, and an explicit repaint on theme change. This is dsheet's analogue of ddoc's JS-driven "document styling" path, and it mirrors how ddoc feeds it: an explicit `theme` prop through React context.

**Decisions (locked)**

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Dark-theme grid surface | **Fully dark grid** | Empty cells + gridlines + headers go dark. Cohesive dark sheet, not a light grid in a dark frame. |
| 2 | User-authored cell colors | **Literal in every theme** | Spreadsheet fills/text are deliberate data-viz. Only defaults + chrome theme. dsheet does **not** port ddoc's `getResponsiveColor` inversion. |
| 3 | How the canvas learns the theme | **Explicit `theme: ThemeKey` prop** (ddoc parity), threaded through context | ddoc's canonical channel for its JS path. Testable; ddocs.new passes `theme` from `useTheme()` exactly like `<DdocEditor theme>`. |
| 4 | Palette home | **Engine layer** (`src/sheet-engine/core/theme.ts`) | Canvas is the only consumer; keeps the engine self-themable. |
| 5 | Redraw on theme change | **`jfrefreshgrid(ctx)`** (targeted full-grid repaint), NOT remount | Already the canonical repaint path (called after every edit). No remount churn — scroll/selection preserved. |
| 6 | Feature/semantic canvas colors | **Literal** | error-red validation triangle, forced-string green triangle, data-verification dropdown chip, comment marker, hyperlink blue, conditional-format colors (user data). |
| 7 | `#EFC703` selection accent | **Constant across all themes** | Brand accent; readable on every background (fill handle, selection border, marching ants). |
| 8 | In-cell editor | **Matches the cell it overlays** | Themed default over empty cells; literal over colored cells. Editing no longer flashes white-on-dark. |
| 9 | Non-light palette hex | **Design deliverable** | Ship token-derived values; designer tunes. `light` is exact-current (no visual change). |

**The palette module** — `src/sheet-engine/core/theme.ts` (new):

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
}

export const GRID_THEMES: Record<ThemeKey, GridPalette> = { /* … */ };

export let activePalette: GridPalette = GRID_THEMES[DEFAULT_THEME];
export const resolveGridPalette = (t?: ThemeKey): GridPalette =>
  GRID_THEMES[t ?? DEFAULT_THEME] ?? GRID_THEMES[DEFAULT_THEME];

/** Returns true if the palette changed (caller decides whether to repaint). */
export const setActiveGridPalette = (t?: ThemeKey): boolean => { /* swaps activePalette */ };
```

`ThemeKey` is copied **verbatim** from `fileverse-ddoc/package/types.ts` so the dsheet `theme` prop is type-identical and ddocs.new can pass one value to both editors.

**The default-vs-literal split rides the existing code branch.** Today canvas does, per cell:

```ts
let fillStyle = normalizedAttr(flowdata, r, c, 'bg');    // user-set cell bg, if any
if (checksCF?.cellColor) fillStyle = checksCF.cellColor; // conditional format (user data)
if (!fillStyle) renderCtx.fillStyle = '#FFFFFF';         // ← DEFAULT: becomes activePalette.cellBg
else renderCtx.fillStyle = fillStyle;                    // ← LITERAL: user/CF color, unchanged
```

So the change is surgical: the **fallback** branch reads `activePalette.cellBg`; the user-color branch is untouched. Same pattern for default text (`fc` unset → `activePalette.cellText`), gridlines, and headers (always palette — they have no user-color concept).

**Canvas literal catalog** (paint sites converted):

| Literal(s) | Role → slot |
|---|---|
| `defaultStyle.fillStyle = '#000000'`, default text spots | `cellText` |
| `defaultStyle.strokeStyle = '#e8ebec'` | `gridLine` |
| `'#F8F9FA'` | `headerBg` |
| `'#000000'` (header text) | `headerText` |
| `'#FFFFFF'` / `'#ffffff'` (unset cell bg / canvas clear) | `cellBg` (fallback branch only) |
| `'rgba(232, 235, 236, 1)'` (on-canvas chip) | `secondaryFill` |
| freeze-line stroke | `freezeLine` |
| `'#EFC703'` (selection / fill handle / marching ants) | `SELECTION_ACCENT` (constant) |

**Stay literal:** error red `#ff0000`, error border `#FB3449`, forced-string green `#487f1e`, chevron/checkbox glyph fills, gradient stop, conditional-format `cellColor`, user cell `bg`/`fc`, pivot-table placeholder block.

**What themes vs what stays literal (canvas):**

| Element | Source | Behavior |
|---|---|---|
| Unset cell background | `palette.cellBg` | themed (dark in dark) |
| Gridlines | `palette.gridLine` | themed |
| Row/col header bg + text | `palette.headerBg`/`headerText` | themed |
| Default cell text (no `fc`) | `palette.cellText` | themed |
| Frozen-pane divider | `palette.freezeLine` | themed |
| On-canvas chip (data-verification dropdown) | `palette.secondaryFill` | themed |
| **User-set cell bg / text / border** | cell `bg`/`fc`/border | **literal** |
| **Conditional-format colors** | CF rule data | **literal** |
| In-cell editor over a colored cell | cell color | **literal (matches cell)** |
| Selection accent | `SELECTION_ACCENT` | **constant `#EFC703`** |
| Error-red / forced-string-green triangles, comment marker, hyperlink blue, checkbox glyphs | feature | **literal** |

**Data flow:**

```
ddocs.new useTheme() ──theme──▶ <Dsheet theme>
   <html class> (set by host provider)
        ├─▶ chrome (.color-* utilities)      ── passive CSS, Phases 1–2a
        └─▶ <Dsheet theme> ─▶ editor-context ─▶ Workbook ─▶ engine
                 setActiveGridPalette(theme) ─▶ activePalette
                 jfrefreshgrid(ctx) ─▶ canvas repaints from palette
                 in-cell editor reads the published CSS vars
```

One source (`useTheme`), two channels (CSS cascade for chrome, prop for grid) — the same no-drift guarantee ddoc has. ddocs.new integration is then `<Dsheet theme={theme} />`, identical to its `<DdocEditor theme={theme} />` call.

### Phase 3 — implementation notes (as built)

Where the built solution differs from or refines the design above. **Read this before touching the palette.**

- **Palette = exact `@fileverse/ui` token values.** The four non-light `GRID_THEMES` palettes use the ui chrome tokens' HSL values verbatim (`cellBg`=`--color-bg-default`, `cellText`=`--color-text-default`, `gridLine`/`freezeLine`=`--color-border-default`, `headerBg`/`secondaryFill`=`--color-bg-secondary`, `headerText`=`--color-text-default`) as `hsla(...)` strings, so grid, chrome, and editor are pixel-consistent per theme. `light` keeps the exact original hex (regression guard). This realizes decision #9's "token-derived" better than arbitrary hex. **If ui token values change, refresh these to match.**

- **In-cell editor uses published CSS vars, not `editor*` palette slots.** The design proposed `editorBg`/`editorText`/`editorBorder` slots; the built `GridPalette` has none. Instead the Workbook theme effect publishes `--grid-cell-bg` / `--grid-cell-text` (from `activePalette`) on `document.documentElement`, and `.luckysheet-input-box-inner` reads `var(--grid-cell-bg, …)` / `var(--grid-cell-text, …)`. The editor therefore matches the canvas cell using the **same value source**. Known minor follow-up: editing a user-*colored* cell still shows the default themed surface (luckysheet's own inline style governs that case).

- **Default cell text needed two fixes beyond the canvas paint sites.** The `cellText` default lived in `modules/text.ts` (inline-string builder `!fc ? '#000'`) and at three `canvas.ts` sites via `normalizedAttr(…, 'fc')` (which defaults unset `fc` to `#000000` in `modules/cell.ts`). Both were themed to `activePalette.cellText` **only when `fc` is unset** — user-set colors (including deliberate black) stay literal, and the `value !== '#000000'` styled-cell detection elsewhere is untouched.

- **Theme signal path (as wired):** `theme?: ThemeKey` on `DsheetProps` → `SpreadsheetEditor` → `EditorContent` (added to its `Pick`) → `EditorWorkbook` (added to `EditorWorkbookProps` + memo deps) → `Workbook` (`AdditionalProps`) → effect `setActiveGridPalette(theme)` + `jfrefreshgrid(ctx, null, undefined)`. Redraw only when the palette changed; **no remount** (scroll/selection preserved). Demo passes `useTheme().theme`.

- **Files touched:** `src/sheet-engine/core/theme.ts` (new), `src/sheet-engine/core/canvas.ts`, `src/sheet-engine/core/modules/text.ts`, `src/sheet-engine/react/components/Workbook/index.tsx`, `src/sheet-engine/react/components/SheetOverlay/index.css`, `src/editor/types.ts`, `src/editor/dsheet-editor.tsx`, `src/editor/components/editor-workbook.tsx`, `demo/src/App.tsx`.

- **Left as-is (dead):** `canvas.ts` `defaultStyle.fillStyle` / `strokeStyle` / `rowFillStyle` are now unused (all reads replaced by `activePalette.*`). Harmless; optional cleanup.

- **Formula bar (`FxEditor`)** was already themed in Phase 2a.

### Key file map (theming)

| Concern | Location | Phase |
|---|---|---|
| Chrome components | `src/editor/components/**`, `src/editor/utils/custom-toolbar-item.tsx` | 1 |
| dsheet-authored CSS overrides | `src/editor/styles/index.css` | 1 |
| ui token cascade import | `src/editor/styles/index.css:2` (`@import '@fileverse/ui/styles'`) | 1 |
| Engine React chrome | `src/sheet-engine/react/**` (Toolbar, ContextMenu, SheetOverlay, Dialog, data tools, SheetTab, …) | 2a |
| Grid color literals | `src/sheet-engine/core/canvas.ts`, `core/modules/text.ts` | 3 |
| Grid palette module | `src/sheet-engine/core/theme.ts` | 3 |
| Targeted repaint | `src/sheet-engine/core/modules/refresh.ts` (`jfrefreshgrid`) | 3 |
| `theme` prop type | `src/editor/types.ts` (`DsheetProps`) | 3 |
| Editor context (thread theme) | `src/editor/contexts/editor-context.tsx` | 3 |
| Workbook usage | `src/editor/components/editor-workbook.tsx` | 3 |
| In-cell editor | `src/sheet-engine/react/components/SheetOverlay/InputBox.tsx`, `ContentEditable.tsx` (+ CSS) | 3 |
| Demo `ThemeToggle` (verification) | `demo/src/main.tsx` (provider), `demo/src/App.tsx` (`renderNavbar`) | all |
| Export/data color code (leave literal) | `src/editor/utils/xlsx-*`, `csv-import.tsx`, `formula-ui-sync.ts` | — |
| ddoc parity references | `fileverse-ddoc/package/types.ts`, `package/context/editor-context.tsx`, `package/ddoc-editor.tsx` | 3 |

---

## 8. Consolidated public API

The complete `DsheetProps` delta across all four workstreams.

### Removed

| Prop | Replacement | Workstream |
|---|---|---|
| `commentData` | `commentsConfig.commentsData` | comments |
| `getCommentCellUI` | `commentsConfig` (built internally) | comments |
| `allowComments` | omit `commentsConfig` to disable | comments |
| `toggleTemplateSidebar` | `openPanel('templates')` via `editorValues` | sidebar |
| `isTemplateOpen` | internal sidebar state | sidebar |
| `dataBlockApiKeyHandler` | internal | data blocks |
| `storeApiKey` | `apiKeyStorage.set` | data blocks |
| `onDataBlockApiResponse` | `onDataBlockEvent` (`type: 'success'`) | data blocks |
| `handleSmartContractQuery` | internal | smart contracts |
| `setShowSmartContractModal` | internal (EditorContext) | smart contracts |

### Added

```ts
interface DsheetProps {
  // …all existing props (dsheetId, isNewSheet, onChange, isReadOnly, collaboration,
  //    username, portalContent, enableIndexeddbSync, renderNavbar, sheetEditorRef,
  //    editorStateRef, isAuthorized, getDocumentTitle, updateDocumentTitle,
  //    onboarding*, setFetchingURLData, setShowFetchURLModal,
  //    setInputFetchURLDataBlock, onDuneChartEmbed, onSheetCountChange,
  //    enableLiveQuery, liveQueryRefreshRate, allowSheetDownload, … ) unchanged

  customPanels?: PanelConfig[];                          // sidebar
  commentsConfig?: CommentsConfig;                       // comments
  apiKeyStorage?: ApiKeyStorage;                         // data blocks
  onDataBlockEvent?: (event: DataBlockEvent) => void;    // data blocks
  smartContracts?: SmartContractConfig;                  // smart contracts
  theme?: ThemeKey;                                      // theming (default 'light')
}
```

### `EditorValues` (passed to `renderNavbar`)

```ts
interface EditorValues {
  sheetEditorRef: RefObject<WorkbookInstance>;
  currentDataRef: MutableRefObject<Sheet[] | null>;
  ydocRef: RefObject<Y.Doc | null>;
  openPanel: (panelId: string) => void;   // NEW
  closePanel: () => void;                 // NEW
}
```

### `PanelConfig`

```ts
export interface PanelConfig {
  id: string;
  header: { title: string; subtitle?: string };
  width?: string;        // default '380px'
  content: React.ReactNode;
}

export type BuiltInPanelType =
  'templates' | 'comments' | 'functions' | 'data-verification' | 'conditional-format';
export type PanelId = BuiltInPanelType | string;   // string allows custom panels
```

**Reserved built-in panel ids:** `'comments'`, `'templates'`, `'data-verification'`, `'conditional-format'`, `'functions'`. Plus `'smart-contract-list-view'` when `smartContracts` is supplied.

### Built-in panel registration (inside `EditorContent`)

| Panel id | Component | Registered when | Opens via |
|---|---|---|---|
| `comments` | `CommentsContent` | `commentsConfig` present | `openPanel('comments')` |
| `templates` | `Templates` | always | `openPanel('templates')` / toolbar / first-load auto-open |
| `data-verification` | `DataVerification` | always | FortuneCore → `#data-verification-button` |
| `conditional-format` | `ConditionalFormat` | always | FortuneCore → `#conditional-format-button` |
| `functions` | `FunctionContent` | always | FortuneCore → `#function-button` |
| `smart-contract-list-view` | `SmartContractListView` | `smartContracts` present | FortuneCore → `#smartcontract-button` |

Custom panels are spread in after the built-ins.

### Exports (`src/index.ts`)

```ts
// Components (usable standalone)
export { CommentsContent } from './editor/components/comments/comment-sidebar';
export { CommentCellUI } from './editor/components/comments/comment-cell-popup';
export { useEnsStatus } from './editor/components/comments/ens/use-ens-status';

// Types
export type { PanelConfig, PanelId, BuiltInPanelType } from './editor/types';
export type { CommentThread, CommentReply, CommentActionParams, CommentsConfig }
  from './editor/types/comments';
export { CommentAction } from './editor/types/comments';
export type { EnsStatus } from './editor/components/comments/ens/ens-cache';
export type { DataBlockEvent, DataBlockEventType, ApiKeyStorage } from './editor/types';
export type { SmartContractConfig, SmartContractEvent, ContractConfig,
              NewContractInput, SupportedChain } from './editor/types/smart-contract';
```

**Deliberately NOT exported (internal, not customizable):** `ApiKeyModal`, `SmartContractListView`, `SmartContractModal`, `SmartContractIntro`.

### Final drop-in usage (new consumer)

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
      theme={theme}                            // from the host's useTheme()
      commentsConfig={{
        commentsData, onSendComment, onCommentAction,
        userName, unauthenticatedFallback: <LoginPrompt />,
      }}
      onDataBlockEvent={(e) => track(e)}       // optional
      smartContracts={{ rpcConfig, contracts, resolveAbi, onAddContract, onDeleteContract }}
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

Comments sidebar, templates, data validation, conditional formatting, function reference, data blocks, the API-key prompt, and smart contracts all work. The consumer only wires their own navbar buttons to `openPanel`.

---

## 9. Engineering conventions & constraints

### Porting rules (applied to every file moved from `dsheets.new`)

- Delete every `'use client';` directive — the package is framework-agnostic.
- Replace `next/image` `<Image>` with a plain `<img>` (map `width`/`height` to attributes; drop Next-only props like `priority`).
- Remove `next/navigation` imports (`useSearchParams`, `useRouter`, `usePathname`); replace with `window` / `URLSearchParams` reads, or drop the app-only behavior.
- Replace `@/...` path-alias imports with package-relative imports or package-internal equivalents.
- **Keep every `data-testid`, element `id`, and class name exactly** — FortuneCore and styling depend on them.
- Strip `@sentry/*` `captureException` entirely — consumers get errors via the event streams instead.
- Strip `usePlausibleEvents` — replaced by `onDataBlockEvent` / `onSmartContractEvent`.

### Engine boundary

`@sheet-engine/react` and `@sheet-engine/core` back the spreadsheet engine (LuckySheet-based) and live inside this repo under `src/sheet-engine/**`. Interaction from the editor layer is via the exported API (`WorkbookInstance`, FortuneCore functions). Do not add new peer dependencies on them in `package.json`.

Theming Phase 3 is the deliberate exception where `core/**` was modified — and only at color paint sites.

### Dependencies

Safe to use in migrated components (already present): `@fileverse/ui`, `@fileverse-dev/dsheets-templates`, `@fileverse-dev/formulajs`, `@sheet-engine/react`, `@sheet-engine/core`, `yjs`, `classnames`, `dayjs`, `lodash`, `react`, `usehooks-ts`.

Added during this work: `@fileverse/ens` `^0.0.4` (comments/ENS), `@fileverse/ui` bumped `5.0.2 → ^5.1.9` (**required** for the 5-theme token blocks). `viem` is externalized, not bundled.

Do not add new dependencies without checking `package.json` first.

### Build & verification

```bash
npm run build      # tsc && vite build — this is the type-check gate
npm run dev        # Vite dev server; demo/ imports ../../src/index (source, not dist)
npm run lint       # auto-fixes; commit resulting formatting changes
npm run dev:link   # build + copy dist/ into dsheets.new/node_modules — only for consumer testing
```

**There is no test harness.** `package.json` has no `test` script and no vitest/jest config. Every workstream here was verified by **running the app** in `demo/` and eyeballing it, plus the build gate. Any claim of "verified" in this document means: build green + manual browser check with a clean DevTools console.

For theming specifically, verification = build + the grep sweeps in §7 + human visual QA cycling all five themes via the demo navbar's `ThemeToggle`, walking every chrome surface (toolbar wrapper, all right-sidebar panels, comment sidebar + cell popup + inline popup, permission/collab chips, skeleton loader, import/export menus, smart-contract block, dialogs, context menu, formula hint/search, tabs/zoom, scrollbars). Looking for: no white-on-white, no black-on-black, no stuck light/dark surfaces.

### Commits

**Repo policy: the owner commits manually.** Agents never run `git commit`.

---

## 10. Consumer (`dsheets.new`) migration

Not done on this branch. This is the remaining work to make `dsheets.new` "just another adopter."

### Files to delete

```
components/right-sidebar-wrapper/use-right-panels.ts
components/right-sidebar-wrapper/right-panels-context.tsx
components/right-sidebar-wrapper/right-sidebar-layout.tsx
components/right-sidebar-wrapper/data-verification.tsx
components/right-sidebar-wrapper/conditional-format.tsx
components/right-sidebar-wrapper/sidebar-panel-config.ts
components/template/templates.tsx
components/template/template-ui.tsx
components/function/**                            (function-content, categories, metadata,
                                                   functionList, hooks/use-functions, types)
components/comment-section/components/**          (UI only — sidebar, cell popup, input,
                                                   item, actions-dropdown, sidebar-empty)
components/api-key-modal/**
components/dsheet-editor/hooks/use-api-key-modal.ts
components/smart-contract-reading/**              (UI, hooks, reading utils)
```

`use-api-key-store.ts` — check for other call sites before deleting.

### Files to keep

```
components/navbar/                                (entire navbar — all menus + app-specific
                                                   items, unchanged; keeps calling openPanel)
components/shortcuts-popup/                       (triggered by the consumer-owned help menu)
components/comment-section/hooks/                 (comment storage/sync — stays forever)
components/comment-section/utils/                 (same)
components/comment-section/types/comment-types.ts (app's extended Comment type)
getIPFSAsset                                      (backs resolveAbi)
IPFS ABI upload helper                            (backs onAddContract)
getKeyStoreData / updateKeyStoreData              (loads `contracts`; backs add/delete)
portal address validation                         (backs validateAddress)
```

### Changes to `components/dsheet-editor/dsheet-editor.tsx`

1. Remove `useRightPanelsContext`, `RightSidebarContent`, `EditorRightSidebar`, `sidebarPanels`, `activePanelConfig`, all `createXxxSidebarPanel` calls, and local `isOpen`/`activePanel`/`togglePanel`/`openPanel`/`closePanel` state.
2. Remove hidden DOM buttons (they moved into the package).
3. Remove props: `commentData`, `getCommentCellUI`, `allowComments`, `toggleTemplateSidebar`, `isTemplateOpen`, `storeApiKey`, `dataBlockApiKeyHandler`, `onDataBlockApiResponse`, `handleSmartContractQuery`, `setShowSmartContractModal`.
4. Remove renders: `<ApiKeyModal>`, `<SmartContractModal>`, `<SmartContractReadingIntro>`, `<SmartContractReadingErrorToast>`.
5. Remove hooks: `useApiKeyModal`, `useApiKeyStore`, `useSmartContractReading`.
6. Add `commentsConfig` built from the surviving `useComments` hook, plus `isOwner` / `currentUserAddress` / `isAuthenticated` / `ensResolutionUrl`.
7. Add `onDataBlockEvent` for analytics + the onboarding side-effect.
8. Add `smartContracts` config (rpcConfig, contracts from keystore, resolveAbi, onAddContract, onDeleteContract, validateAddress, onSmartContractEvent).
9. Add `theme` from the app's `useTheme()`.
10. Pass `openPanel` from `renderNavbar`'s `editorValues` into `<Navbar>`.

**No data migration anywhere.** Smart contract keystores keep their exact `abiHash` shape; API keys keep their localStorage location.

---

## 11. Known gaps, risks, and follow-ups

### Open follow-ups

- **`#0188fb` blue accent** left literal in `src/sheet-engine/react/**`. Decide `color-text-link` vs `color-border-active` and convert. The main known theming follow-up.
- **Phase 2a not formally closed:** needs a final holistic review + `npm run build` gate and human visual QA across all five themes.
- **In-cell editor over a user-colored cell** shows the default themed surface instead of the cell's literal color (luckysheet's own inline style governs that case). Minor.
- **Dead `defaultStyle` fields** in `canvas.ts` (`fillStyle`/`strokeStyle`/`rowFillStyle`) — all reads replaced by `activePalette.*`. Harmless; optional cleanup.
- **Non-light palette hex are design placeholders** — token-derived, awaiting designer sign-off. The mechanism is independent of the exact values, so engineering isn't blocked.
- **Empty-comment-state asset:** `/assets/empty-comment.svg` is consumer-hosted and 404s in the package/demo (broken image, harmless). A follow-up could accept an `emptyImage` prop or bundle the asset.
- **RTC-aware comment disabling:** the consumer disabled comment input during RTC; the package hardcodes `enableCollaboration = false`. If a consumer needs it, add `commentsConfig.disabled?: boolean`.
- **`formatCommentDateTime`** was reconstructed to the consumer's "12:37 PM • 12 Apr" format — verify it matches exactly, or copy the consumer body verbatim.

### Structural risks

- **`ThemeKey` is declared in three places** (ddoc, dsheet editor layer, dsheet core). Mitigated by copying the union verbatim with a comment pointing at `fileverse-ddoc/package/types.ts`. A shared constants package is the real fix (out of scope).
- **Module-level `activePalette` is a singleton.** Multiple workbooks with different themes on one page would share it. dsheet renders one editor per page (like ddoc), so this is acceptable and documented. If multi-instance is ever needed, move the palette onto `sheetCtx`.
- **`viem` is required by every consumer**, even ones that never use smart contracts (§6). Deliberate; revisit via dynamic import only if teams complain.
- **Patchwork grid by design:** literal user-colored cells appear as bright islands on a dark grid. This is the accepted consequence of "user data over visual cohesion" (Phase 3 decision #2).
- **Brand-accent contrast:** `#1977E4` / `#CF1C82` / `#F95738` / `#5c0aff` are kept literal and must stay legible on dark/green backgrounds. Per-case check; adjust only on a real contrast failure.
- **`.color-*` coverage gaps:** if a needed semantic token doesn't exist in `@fileverse/ui`, prefer the closest existing token over re-introducing a hardcoded value — and flag the genuinely missing token rather than inventing one.
- **`jfrefreshgrid` repaints the whole grid.** Theme switches are rare (user action), so a full repaint is fine; no partial invalidation needed.
- **No test harness.** Every guarantee in this document rests on manual verification. Introducing one is out of scope but would be the highest-leverage investment for this package.
