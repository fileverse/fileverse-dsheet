# Comments UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the comments UI (sidebar + in-cell popup + supporting components) from the `dsheets.new` consumer into `@fileverse-dev/dsheet`, driven by a new `commentsConfig` prop, so a consumer gets comments by passing data + handlers only.

**Architecture:** The package gains a `comments` built-in sidebar panel and builds the `<Workbook getCommentCellUI>` internally from `commentsConfig`. All comment *storage/sync/crypto/IPFS* stays in the consumer — the package renders UI and calls back via `commentsConfig` handlers. App-coupled bits (ENS, RTC, wallet permissions, Next.js) are stripped or replaced by injected config.

**Tech Stack:** React 18, TypeScript, Vite, `@fileverse/ui`, `@sheet-engine/core` (`getFlowdata`), `yjs`. No unit-test harness for this UI — verification is **run-the-app** in the `demo/` app at each checkpoint.

---

## Scope

**In scope:** comments sidebar (`CommentsContent`), in-cell popup (`CommentCellUI`), supporting components (`CommentInput`, `CommentItem`, `CommentActionsDropdown`, `CommentSidebarEmpty`), the pure comment utils, the cell-marker util, a **pure** permissions hook, the `commentsConfig` API, internal `getCommentCellUI`, and the `comments` built-in panel.

**Out of scope:** comment storage/sync/crypto/IPFS/indexer (stays in `dsheets.new` forever); the `dsheets.new` switchover (separate effort — see `dsheets.new/docs/sidebar-migration-cleanup.md`).

**Prerequisite:** the sidebar migration (`2026-06-24-sidebar-ui-migration.md`) is done — `SidebarProvider`, `builtInPanels`, `PanelConfig`, and `EditorRightSidebar` exist. The `comments` panel slots into the existing `builtInPanels` array.

---

## Conventions (apply to every ported file)

When copying from `dsheets.new` into the package:
- Delete `'use client';`.
- Replace `next/image` `<Image>` with `<img>` (map `width`/`height` to attributes; drop `priority`).
- Remove `next/navigation` (`usePathname`) usage.
- Remove `@/...` imports; replace with package-relative paths or injected config (per task).
- Keep all element `id`s, `data-testid`s, class names exactly (FortuneCore + styling depend on them, e.g. `comment-box-${row}_${col}`, `comment-scroll`, `comment-cell`).
- ENS removal: render `username` as-is (no ENS lookup, no verified badge, no loader).

**Commits:** each checkpoint ends with a commit step the **user runs** (repo policy: agents do not commit).

---

## Checkpoint Protocol

All verification runs in the package's own demo:
1. From `fileverse-dsheet/`: `npm run dev`.
2. Open the Vite URL (default `http://localhost:5173`), wait ~5s for the sheet.
3. Perform the checkpoint's **Verify** actions.
4. DevTools console must show no red errors tied to comments/editor.

`npm run build` (`tsc && vite build`) is the type gate — run whenever a step says "build must pass."

---

## CommentsConfig — the public API (reality-informed)

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

If `commentsConfig` is omitted: no `comments` panel, no cell markers, no `getCommentCellUI`.

### ENS resolution (handled in-package)

A comment/reply `username` is either a free-text name or a `0x…` address. When `ensResolutionUrl` is set, the package resolves addresses to ENS names (mainnet) and shows a verified badge; otherwise it renders the raw name/address. Resolution is modeled on the ddoc editor:

- `@fileverse/ens` `getAddressName(address, providerUrl)` does the lookup. Contract: invalid address → `{ name: address, isEns: false, resolved: false }` (no network); ENS found → `{ name, isEns: true, resolved: true }`; valid address, no ENS → `{ name: address, isEns: false, resolved: true }`; error → `{ ..., resolved: false }`.
- A **module-level cache singleton** (not a React store — the package has none): holds the configured `ensResolutionUrl`, an in-memory `Map`, an in-flight `Set` for de-dup, subscriber callbacks, and persists to `localStorage['dsheet-ens-cache']`. Only `resolved: true` results are cached.
- `useEnsStatus(username)` → `{ name, isEns }`: returns cache hit immediately, else triggers a deduped resolve and re-renders on completion. Plain names short-circuit (never hit the network).
- The configured URL is pushed into the singleton once from `EditorContent` (Task 10), so no prop-drilling/context-scope concerns across the FortuneCore popup portal.

**Implement the ENS resolver (Task ENS below) before Tasks 7 and 9 — both consume `useEnsStatus`.**

---

## File Structure

**Created in package:**
```
src/editor/types/comments.ts                       # all comment types above + UI prop types
src/editor/utils/comment-key-utils.ts              # pure: parseCellKey, generateWithoutCellKey, getCellReference, formatCommentDateTime, isCellComment
src/editor/utils/sheet-editor-safe.ts              # moved verbatim (clean)
src/editor/utils/cell-comment-marker.ts            # moved; getFlowdata from @sheet-engine/core
src/editor/components/comments/use-comment-permissions.ts   # PURE (injected isOwner/currentUserAddress)
src/editor/components/comments/ens/ens-cache.ts             # module singleton: url + cache + dedup + localStorage
src/editor/components/comments/ens/use-ens-status.ts        # useEnsStatus(username) -> { name, isEns }
src/editor/components/comments/comment-input.tsx
src/editor/components/comments/comment-actions-dropdown.tsx
src/editor/components/comments/comment-item.tsx
src/editor/components/comments/comment-sidebar-empty.tsx
src/editor/components/comments/comment-sidebar.tsx          # CommentsContent
src/editor/components/comments/comment-cell-popup.tsx       # CommentCellUI
src/editor/components/comments/use-comment-cell-popup.ts
```

**Modified in package:**
```
package.json                         # add "@fileverse/ens": "^0.0.4" dependency
src/editor/types.ts                  # re-export comment types; CommentsConfig on DsheetProps; remove commentData/getCommentCellUI/allowComments
src/editor/index.ts (src/index.ts)   # export CommentsContent, CommentCellUI, comment types
src/editor/contexts/editor-context.tsx  # accept commentsConfig; derive commentData/allowComments internally
src/editor/dsheet-editor.tsx         # register 'comments' panel; thread commentsConfig
src/editor/components/editor-workbook.tsx  # build getCommentCellUI internally from commentsConfig
demo/src/App.tsx                     # local in-memory comment store + commentsConfig (checkpoint wiring)
```

---

# PART A — Types, utils, leaf components (no visual yet)

## Task 1: Comment types

**Files:** Create `src/editor/types/comments.ts`

- [ ] **Step 1: Write the file** — paste the full `CommentThread`, `CommentReply`, `CommentAction`, `CommentActionParams`, `CommentsConfig` from the "CommentsConfig" section above, then add the UI prop + helper types:

```ts
import React from 'react';

// ...(paste CommentThread, CommentReply, CommentAction, CommentActionParams, CommentsConfig here)...

export interface CellPosition {
  row: number;
  col: number;
  sheetId?: string;
}

export interface SheetEditorRef {
  scroll: (o: { scrollLeft?: number; scrollTop?: number; targetRow?: number; targetColumn?: number }) => void;
  setSelection: (s: Array<{ row: number[]; column: number[] }>) => void;
}

export interface CommentInputProps {
  id: string;
  onSend: (textareaId: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  backgroundColor?: string;
  inCellComment?: boolean;
  cancelComment?: () => void;
  onBlur?: () => void;
  isStaticButton?: boolean;
  removeCancelButton?: boolean;
  focusTrap?: boolean;
  disabled?: boolean;
}

export interface CommentItemProps {
  comment: CommentThread;
  showAvatar?: boolean;
  avatarSize?: 'sm' | 'md' | 'lg';
  className?: string;
  isHovered?: boolean;
  sheetName?: string;
  cellReference?: string;
  onAction?: (a: CommentActionParams) => void;
  ownerAddress?: string;
  currentUserAddress?: string;
  isOwner?: boolean;
  currentUserName?: string;
  contentClassName?: string;
  isCellPopup?: boolean;
  shouldShowActions?: boolean;
  row?: number;
  col?: number;
}

export interface CommentCellUIProps {
  row: number;
  col: number;
  sheetId: string;
  comment?: CommentThread;
  onSendComment: (commentKey: string, textareaId: string) => void;
  onAction?: (a: CommentActionParams) => void;
  ownerAddress?: string;
  currentUserAddress?: string;
  isOwner?: boolean;
  sheetEditorRef?: React.RefObject<SheetEditorRef>;
  currentUserName?: string;
  removeCommentFromCell: (row: number, col: number) => void;
  dragHandler: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  isHover?: boolean;
}

export interface CommentsContentProps {
  sheetEditorRef: React.RefObject<SheetEditorRef>;
  userName: string | undefined;
  commentsData: Record<string, CommentThread>;
  onSendComment: (commentKey: string, textareaId: string) => void;
  onCommentAction?: (a: CommentActionParams) => void;
  ownerAddress?: string;
  currentUserAddress?: string;
  isOwner?: boolean;
}
```

- [ ] **Step 2: Build must pass** — `npm run build` → PASS (file is types-only; nothing imports it yet).

---

## Task 2: Pure comment utils

**Files:** Create `src/editor/utils/comment-key-utils.ts`

Copy `parseCellKey`, `generateWithoutCellKey`, `getCellReference`, `formatCommentDateTime`, `isCellComment` **verbatim** from `dsheets.new/components/comment-section/utils/comment-utils.ts` (they are pure). Change the `CellPosition` import to the package type.

- [ ] **Step 1: Write the file**

```ts
import { CellPosition } from '../types/comments';

export const parseCellKey = (key: string): CellPosition | null => {
  if (key.includes('WITHOUT')) return null;
  const parts = key.split('_');
  if (parts.length === 3) {
    const [sheetIdStr, rowStr, colStr] = parts;
    const row = Number(rowStr); const col = Number(colStr);
    if (!isNaN(row) && !isNaN(col)) return { row, col, sheetId: sheetIdStr };
  }
  if (parts.length === 2) {
    const [rowStr, colStr] = parts;
    const row = Number(rowStr); const col = Number(colStr);
    if (!isNaN(row) && !isNaN(col)) return { row, col, sheetId: '0' };
  }
  return null;
};

export const generateWithoutCellKey = (dataLength: number): string =>
  `WITHOUT_CELL_${dataLength}`;

export const isCellComment = (key: string): boolean => !key.includes('WITHOUT');

export const getCellReference = (row: number, col: number): string => {
  let colLetter = ''; let colNum = col;
  while (colNum >= 0) {
    colLetter = String.fromCharCode(65 + (colNum % 26)) + colLetter;
    colNum = Math.floor(colNum / 26) - 1;
    if (colNum < 0) break;
  }
  return `${colLetter}${row + 1}`;
};

export const formatCommentDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const day = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  return `${time} • ${day}`;
};
```

> The `formatCommentDateTime` body above reconstructs the consumer's "12:37 PM • 12 Apr" format. If the consumer's exact format differs, copy its body verbatim from `comment-utils.ts:185`.

- [ ] **Step 2: Build must pass** — `npm run build` → PASS.

---

## Task 3: `sheet-editor-safe` + `cell-comment-marker`

**Files:**
- Create `src/editor/utils/sheet-editor-safe.ts`
- Create `src/editor/utils/cell-comment-marker.ts`

- [ ] **Step 1: Copy `sheet-editor-safe.ts` verbatim** from `dsheets.new/components/comment-section/utils/sheet-editor-safe.ts`, changing only the `SheetEditorRef` import to `from '../types/comments'`. It is otherwise dependency-free.

- [ ] **Step 2: Copy `cell-comment-marker.ts`** from `dsheets.new/components/comment-section/utils/cell-comment-marker.ts`, changing the one import:

Replace:
```ts
import { FortuneCore } from '@fileverse-dev/dsheet';
```
with:
```ts
import { getFlowdata } from '@sheet-engine/core';
```
and remove the `const { getFlowdata } = FortuneCore as ...` destructure inside both functions (use the imported `getFlowdata` directly). Keep `hideCellCommentMarker` and `showCellCommentMarker` exports and the `comment-box-${row}_${col}` node id exactly.

- [ ] **Step 3: Build must pass** — `npm run build` → PASS. If `getFlowdata` isn't exported from `@sheet-engine/core`, import it from where the package already uses it (grep `getFlowdata` in `src/` — it's re-exported via `src/index.ts`).

---

## Task 4: Pure permissions hook

**Files:** Create `src/editor/components/comments/use-comment-permissions.ts`

The consumer hook depends on wallet/identity. The package version is **pure** — `isOwner` and `currentUserAddress` are passed in (from `commentsConfig`).

- [ ] **Step 1: Write the file**

```ts
import { useMemo } from 'react';

export const useCommentPermissions = (
  ownerAddress?: string,
  currentUserName?: string,
  currentUserAddress?: string,
  isOwner: boolean = false,
) => {
  return useMemo(() => {
    const canModify = (item: { username: string }): boolean => {
      if (isOwner) return true;
      if (currentUserAddress && currentUserAddress === item.username) return true;
      if (currentUserName && currentUserName === item.username) return true;
      return false;
    };
    return {
      canDeleteComment: canModify,
      canResolveComment: canModify,
      canDeleteReply: canModify,
      canResolveReply: canModify,
      isOwner,
    };
  }, [isOwner, currentUserAddress, currentUserName]);
};
```

> `ownerAddress` is kept in the signature for parity but unused (owner-ness is now the injected `isOwner`). Drop it if lint complains about unused params.

- [ ] **Step 2: Build must pass** — `npm run build` → PASS.

---

## Task ENS: ENS resolver (dependency + cache + hook)

**Files:**
- Modify `package.json`
- Create `src/editor/components/comments/ens/ens-cache.ts`
- Create `src/editor/components/comments/ens/use-ens-status.ts`

- [ ] **Step 1: Add the dependency**

Add to `package.json` `dependencies`:
```json
"@fileverse/ens": "^0.0.4"
```
Run `npm install`. Confirm it resolves and exports `getAddressName`:
```bash
node -e "console.log(typeof require('@fileverse/ens').getAddressName)"   # expect: function
```
If `@fileverse/ens` is unavailable/private, STOP and report BLOCKED — the URL-based resolver needs it. (Do not silently swap libraries.)

> Add `@fileverse/ens` to `rollupOptions.external` in `vite.config.ts` only if other `@fileverse/*` packages are external there; check the list. As of the sidebar migration `@fileverse/ui` is external but `@fileverse-dev/*` are bundled — match how the build treats the sibling `@fileverse/*` packages. If unsure, leave it bundled (default) and verify the build.

- [ ] **Step 2: Write `ens/ens-cache.ts`**

```ts
import { getAddressName } from '@fileverse/ens';

export interface EnsStatus { name: string; isEns: boolean; }

const STORAGE_KEY = 'dsheet-ens-cache';

let resolutionUrl: string | undefined;
const cache = new Map<string, EnsStatus>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

// Seed from localStorage once.
(() => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, EnsStatus>;
      for (const [k, v] of Object.entries(obj)) cache.set(k, v);
    }
  } catch {
    // ignore corrupt cache
  }
})();

const persist = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(cache)),
    );
  } catch {
    // ignore quota / serialization errors
  }
};

const notify = () => listeners.forEach((l) => l());

/** Push the host-provided RPC URL into the singleton (called from EditorContent). */
export const setEnsResolutionUrl = (url: string | undefined) => {
  resolutionUrl = url;
};

export const subscribeEns = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getCachedEns = (username: string): EnsStatus | undefined =>
  cache.get(username);

/** Resolve `username` to an EnsStatus, deduped + cached. No-op if already cached/in-flight. */
export const resolveEns = async (username: string): Promise<void> => {
  if (!username || !resolutionUrl) return;
  if (cache.has(username) || inFlight.has(username)) return;
  inFlight.add(username);
  try {
    const { name, isEns, resolved } = await getAddressName(
      username,
      resolutionUrl,
    );
    if (resolved) {
      cache.set(username, { name, isEns });
      persist();
    }
  } catch {
    // leave uncached so a transient failure retries next render
  } finally {
    inFlight.delete(username);
    notify();
  }
};
```

- [ ] **Step 3: Write `ens/use-ens-status.ts`**

```ts
import { useEffect, useState } from 'react';
import {
  EnsStatus,
  getCachedEns,
  resolveEns,
  subscribeEns,
} from './ens-cache';

/**
 * Resolve a comment username to a display name + ENS flag.
 * - Empty → "Anonymous".
 * - Cache hit → returned immediately.
 * - Miss → triggers a deduped resolve; re-renders when it lands.
 * - Plain names short-circuit inside getAddressName (no network).
 */
export const useEnsStatus = (username?: string): EnsStatus => {
  const fallback: EnsStatus = { name: username || 'Anonymous', isEns: false };

  const [status, setStatus] = useState<EnsStatus>(
    () => (username && getCachedEns(username)) || fallback,
  );

  useEffect(() => {
    if (!username) {
      setStatus({ name: 'Anonymous', isEns: false });
      return;
    }
    const apply = () => setStatus(getCachedEns(username) || { name: username, isEns: false });
    apply();
    const unsub = subscribeEns(apply);
    void resolveEns(username);
    return () => {
      unsub();
    };
  }, [username]);

  return status;
};
```

- [ ] **Step 4: Build must pass** — `npm run build` → PASS.

---

## Task 5: `CommentInput`

**Files:** Create `src/editor/components/comments/comment-input.tsx`

Copy verbatim from `dsheets.new/components/comment-section/components/comment-input.tsx`, then:
- Change the props import to `from '../../types/comments'`.
- Delete `import { usePlausibleEvents } ...` and the `const { onFloatingCommentPlausible, onInCellCommentPlausible } = usePlausibleEvents();` line.
- In `handleSend`, remove the `if (inCellComment) { onInCellCommentPlausible(); } else { onFloatingCommentPlausible(); }` block — keep only `onSend(id);`.

- [ ] **Step 1: Write the file** (copy + the 3 edits above).
- [ ] **Step 2: Build must pass** — `npm run build` → PASS.

---

## Task 6: `CommentActionsDropdown`

**Files:** Create `src/editor/components/comments/comment-actions-dropdown.tsx`

Copy verbatim from `dsheets.new/.../comment-actions-dropdown.tsx`, then:
- Change types import to `from '../../types/comments'` (`CommentReply`, `CommentAction`, `CommentActionParams`).
- Replace `import { CommentsItem } from '@/db/comments/types';` and the `comment: CommentsItem | CommentReply` prop type with `comment: CommentThread | CommentReply` (import `CommentThread`).
- Replace `import { useCommentPermissions } from '../hooks/use-comment-permissions';` with `from './use-comment-permissions';`.
- The component must accept `currentUserAddress?: string` and `isOwner?: boolean` props and pass them into `useCommentPermissions(ownerAddress, currentUserName, currentUserAddress, isOwner)`. Add them to `CommentActionsDropdownProps`.

- [ ] **Step 1: Write the file** (copy + edits).
- [ ] **Step 2: Build must pass** — `npm run build` → PASS.

---

## Task 7: `CommentItem`

**Files:** Create `src/editor/components/comments/comment-item.tsx`

Copy verbatim from `dsheets.new/.../comment-item.tsx`, then:
- Types import → `from '../../types/comments'`.
- `formatCommentDateTime` import → `from '../../utils/comment-key-utils'`.
- Delete `import { useENSName } ...` and `import Image from 'next/image'`. Add `import { useEnsStatus } from './ens/use-ens-status';`.
- In both `ReplyWithENS` and `CommentItem`, replace `const { displayName, isEns, loading } = useENSName(reply.username)` (and `comment.username`) with `const { name: displayName, isEns } = useEnsStatus(reply.username)` (and `comment.username`). There is no `loading` from the package hook — remove the `loading` `<LucideIcon Loader2>` spinner branch.
- Keep the `isEns` rendering, but make it **asset-free**: replace the verified-badge `<Image src="/assets/verified.svg" .../>` with `<LucideIcon name="BadgeCheck" size="sm" className="text-blue-500" />` (title "Verified ENS name"). For the avatar, replace the `isEns ? <Avatar src="/assets/ens.svg" .../> :` branch — drop the asset variant and always render `<Avatar key={displayName} size="md" content="text" alt={displayName} />` (the badge already signals ENS).
- `CommentActionsDropdown` import → `from './comment-actions-dropdown'`. Thread `currentUserAddress`/`isOwner` from `CommentItemProps` into each `<CommentActionsDropdown ...>`.

- [ ] **Step 1: Write the file** (copy + edits).
- [ ] **Step 2: Build must pass** — `npm run build` → PASS.

---

## Task 8: `CommentSidebarEmpty`

**Files:** Create `src/editor/components/comments/comment-sidebar-empty.tsx`

Copy verbatim, then delete `'use client';`, replace `import Image from 'next/image'` + the `<Image .../>` with `<img width={188} height={160} src="/assets/empty-comment.svg" alt="" className="object-contain" />`.

> The `src="/assets/empty-comment.svg"` path is consumer-hosted. In the package/demo it will 404 (broken image, harmless). Acceptable — the empty state is rarely seen and the asset is the consumer's. Leave the path; a follow-up can bundle the asset or accept an `emptyImage` prop.

- [ ] **Step 1: Write the file.**
- [ ] **Step 2: Build must pass** — `npm run build` → PASS.

- [ ] **Step 3: Commit Part A (user runs)**

```bash
git add src/editor/types/comments.ts src/editor/utils/comment-key-utils.ts \
        src/editor/utils/sheet-editor-safe.ts src/editor/utils/cell-comment-marker.ts \
        src/editor/components/comments
git commit -m "feat(comments): types, utils, and leaf components"
```

> No checkpoint here — these are leaf pieces with no standalone UI. First visual checkpoint is Part B.

---

# PART B — Comments sidebar panel

## Task 9: `CommentsContent` (sidebar)

**Files:** Create `src/editor/components/comments/comment-sidebar.tsx`

Copy from `dsheets.new/.../comment-sidebar.tsx`, then:
- Types import → `from '../../types/comments'` (`CommentsContentProps`).
- Sibling imports → `./comment-item`, `./comment-input`, `./comment-sidebar-empty`.
- Utils: `parseCellKey, generateWithoutCellKey, getCellReference` → `from '../../utils/comment-key-utils'`; the `sheet-editor-safe` imports → `from '../../utils/sheet-editor-safe'`.
- Delete `useENSName`, `useRTCContext`, `usePathname`, `next/image`, and `CommentsItem` imports. Add `import { useEnsStatus } from './ens/use-ens-status';`.
- Replace the ENS pieces with the package hook: rewrite the `UserDisplayName` component to use `const { name: displayName, isEns } = useEnsStatus(userName)` and render `{displayName}` + (when `isEns`) `<LucideIcon name="BadgeCheck" size="sm" className="text-blue-500" />`; drop the `loading` spinner and the `<Image>` badge. For the current-user avatar at the bottom, replace `const { isEns: userIsEns } = useENSName(userName)` + the `userIsEns ? <Avatar src="/assets/ens.svg"> :` branch with a plain `<Avatar key={userName} size="md" content="text" alt={userName} />` (the `UserDisplayName` badge already signals ENS).
- Replace collaboration gating: delete `const pathname = usePathname(); const isCollaborationMode = pathname.includes('/share');` and `const { enableCollaboration: isCollaborationEnabled } = useRTCContext();`. Set `const enableCollaboration = false;` (the package has no RTC context; collaboration-disabled-comments is an app concern the consumer can reintroduce later).
- `CommentItem` casts: replace `comment as CommentsItem` with `comment as CommentThread`.
- **selectedComment is now internal:** the props no longer include `selectedComment`/`onCommentSelect`. Add local state: `const [selectedComment, setSelectedComment] = useState<string | null>(null);` and replace `onCommentSelect(x)` calls with `setSelectedComment(x)`.
- Thread `currentUserAddress`/`isOwner` (from props) into `<CommentItem ...>`.

- [ ] **Step 1: Write the file** (copy + edits).
- [ ] **Step 2: Build must pass** — `npm run build` → PASS.

---

## Task 10: Register the `comments` built-in panel + thread `commentsConfig`

**Files:**
- Modify `src/editor/types.ts`
- Modify `src/editor/dsheet-editor.tsx`
- Modify `src/editor/contexts/editor-context.tsx`

- [ ] **Step 1: Add `commentsConfig` to `DsheetProps`** in `types.ts`:

```ts
import { CommentsConfig } from './types/comments';
// ...in DsheetProps:
  commentsConfig?: CommentsConfig;
```
Also re-export the comment types from `types.ts`:
```ts
export type { CommentThread, CommentReply, CommentActionParams, CommentsConfig } from './types/comments';
export { CommentAction } from './types/comments';
```

- [ ] **Step 2: Thread `commentsConfig` through `SpreadsheetEditor` → `EditorProvider` + `EditorContent`** in `dsheet-editor.tsx`. Destructure `commentsConfig` from props; pass `commentsConfig={commentsConfig}` to both `<EditorProvider>` and `<EditorContent>`. Add `commentsConfig?: CommentsConfig` to `EditorContent`'s prop type and destructure.

- [ ] **Step 3: In `editor-context.tsx`, accept `commentsConfig` and derive the legacy internals.** The provider currently takes `commentData` + `allowComments` and feeds `useEditorData`. Add `commentsConfig?: CommentsConfig` to `EditorProviderProps`; derive:
```ts
const commentData = commentsConfig?.commentsData;
const allowComments = !!commentsConfig;
```
and pass those derived values into `useEditorData(...)` exactly where `commentData`/`allowComments` were passed before. (Keep accepting the old `commentData`/`allowComments` props for now if other internal call sites still pass them, but prefer the derived ones when `commentsConfig` is present.)

- [ ] **Step 4: Register the `comments` panel** in `EditorContent`'s `builtInPanels` (place it first). Import `CommentsContent`:
```ts
import { CommentsContent } from './components/comments/comment-sidebar';
```
```tsx
...(commentsConfig ? [{
  id: 'comments',
  header: { title: 'Comments' },
  width: '380px',
  content: (
    <CommentsContent
      sheetEditorRef={sheetEditorRef}
      userName={commentsConfig.userName}
      commentsData={commentsConfig.commentsData}
      onSendComment={commentsConfig.onSendComment}
      onCommentAction={commentsConfig.onCommentAction}
      ownerAddress={commentsConfig.ownerAddress}
      currentUserAddress={commentsConfig.currentUserAddress}
      isOwner={commentsConfig.isOwner}
    />
  ),
}] : []),
```
Build the panels array so this is included only when `commentsConfig` is present.

- [ ] **Step 5: Push the ENS URL into the resolver singleton.** In `EditorContent`, add:
```ts
import { setEnsResolutionUrl } from './components/comments/ens/ens-cache';
// inside EditorContent body:
useEffect(() => {
  setEnsResolutionUrl(commentsConfig?.ensResolutionUrl);
}, [commentsConfig?.ensResolutionUrl]);
```

- [ ] **Step 6: Build must pass** — `npm run build` → PASS.

---

## Task 11: Demo local comment store + CHECKPOINT 1 (sidebar)

**Files:** Modify `demo/src/App.tsx`

Wire a minimal in-memory comment store so the sidebar is exercisable. The demo plays the role the consumer's `useComments` plays.

- [ ] **Step 1: Add a local comment store** in `App()`:

```tsx
import { CommentAction } from '../../src/index';
import type { CommentThread, CommentActionParams } from '../../src/index';

// inside App():
const [commentsData, setCommentsData] = useState<Record<string, CommentThread>>({});

const readTextarea = (id: string) =>
  (document.getElementById(id) as HTMLTextAreaElement | null)?.value?.trim() ?? '';

const onSendComment = useCallback((key: string, textareaId: string) => {
  const content = readTextarea(textareaId);
  if (!content) return;
  setCommentsData((prev) => {
    const existing = prev[key];
    if (existing) {
      // reply
      return { ...prev, [key]: { ...existing,
        replies: [...existing.replies, {
          id: `r-${Date.now()}`, username: 'demo-user', content,
          createdAt: new Date().toISOString(), commentIndex: existing.replies.length,
        }] } };
    }
    return { ...prev, [key]: {
      id: `c-${Date.now()}`, key, dsheetId, username: 'demo-user', content,
      createdAt: new Date().toISOString(), commentIndex: 0, replies: [],
    } };
  });
  const el = document.getElementById(textareaId) as HTMLTextAreaElement | null;
  if (el) el.value = '';
}, [dsheetId]);

const onCommentAction = useCallback((a: CommentActionParams) => {
  setCommentsData((prev) => {
    const c = prev[a.commentKey]; if (!c) return prev;
    if (a.action === CommentAction.DELETE && !a.isReply) {
      const next = { ...prev }; delete next[a.commentKey]; return next;
    }
    if (a.action === CommentAction.RESOLVE) return { ...prev, [a.commentKey]: { ...c, isResolved: true } };
    if (a.action === CommentAction.UNRESOLVE) return { ...prev, [a.commentKey]: { ...c, isResolved: false } };
    return prev;
  });
}, []);
```

- [ ] **Step 2: Pass `commentsConfig` to `<DSheetEditor>`** and add a navbar button to open the comments panel:

```tsx
commentsConfig={{
  commentsData,
  onSendComment,
  onCommentAction,
  userName: 'demo-user',
  currentUserAddress: 'demo-user',
  isOwner: true,
  isAuthenticated: true,
  // ENS test: set a real mainnet RPC URL via Vite env to exercise resolution.
  ensResolutionUrl: import.meta.env.VITE_ENS_RPC_URL,
}}
```
Change `renderNavbar` to `(editorValues?: any)` (add the eslint-disable as before) and add a button:
```tsx
<button type="button" onClick={() => editorValues?.openPanel('comments')}
  style={{ border: '1px solid #ccc', borderRadius: 6, padding: '2px 8px' }}>Comments</button>
```

- [ ] **Step 3: Build must pass** — `npm run build` → PASS.

- [ ] **Step 4: CHECKPOINT 1 — sidebar**

Run the app. Click **Comments**:
- Empty state shows ("No comments yet"; the image may 404 — fine).
- Add a comment via the sidebar's bottom input → it appears in the list (newest first).
- Hover a comment → actions (⋯) appear; **Resolve** greys it out and the resolved notice shows; **Unresolve** restores; **Delete** asks to confirm then removes it.
- Add a reply (click a thread → reply input).
- Filter dropdowns (All Types / Open / Resolved, All Sheets / This Sheet) work.
- No glitch on open/close (memoized workbook), console clean.
- **ENS:** with a real mainnet RPC in `demo/.env` (`VITE_ENS_RPC_URL=...`), seed a comment whose `username` is an ENS-owning address (e.g. `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`, vitalik.eth) — in the console: `localStorage` is fine, easiest is to temporarily set the demo's `userName`/`currentUserAddress` to that address, add a comment, and confirm it renders the **ENS name + a blue `BadgeCheck`** after resolution (a re-render lands async). With no `VITE_ENS_RPC_URL`, the raw name/address shows and no network call is made. A plain name like `demo-user` never resolves (short-circuits). Reload → cached ENS name appears instantly (from `localStorage['dsheet-ens-cache']`).

- [ ] **Step 5: Commit (user runs)**

```bash
git add src/editor/components/comments/comment-sidebar.tsx src/editor/types.ts \
        src/editor/dsheet-editor.tsx src/editor/contexts/editor-context.tsx demo/src/App.tsx
git commit -m "feat(comments): comments sidebar panel + commentsConfig"
```

---

# PART C — In-cell comment popup

## Task 12: `CommentCellUI` + popup hook

**Files:**
- Create `src/editor/components/comments/use-comment-cell-popup.ts`
- Create `src/editor/components/comments/comment-cell-popup.tsx`

- [ ] **Step 1: Copy `use-comment-cell-popup.ts` verbatim** from `dsheets.new/.../comment-cell-popup/use-comment-cell-popup.ts` (it is dependency-free; rename file to `use-comment-cell-popup.ts` in the `comments/` dir).

- [ ] **Step 2: Copy `comment-cell-popup.tsx`** from `dsheets.new/.../comment-cell-popup/comment-cell-popup.tsx`, then:
- Types import → `from '../../types/comments'` (`CommentCellUIProps`).
- Sibling imports → `./comment-input`, `./comment-item`, `./comment-actions-dropdown`, `./use-comment-cell-popup`.
- Thread `currentUserAddress`/`isOwner` (add to `CommentCellUIProps` already in Task 1) into the `<CommentItem>` and `<CommentActionsDropdown>` inside.

- [ ] **Step 3: Build must pass** — `npm run build` → PASS.

---

## Task 13: Build `getCommentCellUI` inside the package

**Files:** Modify `src/editor/components/editor-workbook.tsx`

Today `EditorWorkbook` receives `getCommentCellUI` as a prop. After this task it builds it internally from `commentsConfig`. The `removeCommentFromCell` it needs is now package-owned via `cell-comment-marker`.

- [ ] **Step 1: Accept `commentsConfig` instead of `getCommentCellUI`.** In `EditorWorkbookProps`, remove `getCommentCellUI`; add `commentsConfig?: CommentsConfig`. Update the destructure.

> **Check `commentData` before removing it.** Grep `editor-workbook.tsx` for `commentData`. If `<Workbook>` (or anything else in this file) consumes it, do NOT remove the prop — instead feed it from config: derive `const commentData = commentsConfig?.commentsData;` and keep passing it where it was. If `commentData` is unused here (markers are driven via the context path from Task 10 Step 3), remove the prop. Decide based on the grep, not assumption.

- [ ] **Step 2: Build `getCommentCellUI` in the component body:**

```ts
import { CommentCellUI } from './comments/comment-cell-popup';
import { hideCellCommentMarker } from '../utils/cell-comment-marker';
import { getCurrentSheetIdSafe } from '../utils/sheet-editor-safe';

const removeCommentFromCell = useCallback((row: number, col: number) => {
  hideCellCommentMarker(sheetEditorRef, row, col);
}, [sheetEditorRef]);

const getCommentCellUI = useMemo(() => {
  if (!commentsConfig) return undefined;
  const isAuthed = commentsConfig.isAuthenticated ?? true;
  return (row: number, col: number,
          dragHandler: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void,
          isHover?: boolean) => {
    const sheetId = getCurrentSheetIdSafe(sheetEditorRef);
    const key = `${sheetId}_${row}_${col}`;
    const comment = commentsConfig.commentsData[key];
    if (!isAuthed) return commentsConfig.unauthenticatedFallback ?? null;
    return (
      <CommentCellUI
        row={row} col={col} sheetId={sheetId} comment={comment}
        onSendComment={(k, textareaId) => commentsConfig.onSendComment(key, textareaId)}
        onAction={commentsConfig.onCommentAction}
        ownerAddress={commentsConfig.ownerAddress}
        currentUserAddress={commentsConfig.currentUserAddress}
        isOwner={commentsConfig.isOwner}
        sheetEditorRef={sheetEditorRef as never}
        currentUserName={commentsConfig.userName}
        removeCommentFromCell={removeCommentFromCell}
        dragHandler={dragHandler}
        isHover={isHover}
      />
    );
  };
}, [commentsConfig, sheetEditorRef, removeCommentFromCell]);
```
Pass `getCommentCellUI={getCommentCellUI}` to `<Workbook>` (the prop already exists there). Remove the old `getCommentCellUI={getCommentCellUI}` that came from props.

- [ ] **Step 3: Thread `commentsConfig` from `EditorContent` to `EditorWorkbook`.** In `dsheet-editor.tsx`, replace the `commentData`/`getCommentCellUI` props passed to `<EditorWorkbook>` with `commentsConfig={commentsConfig}`. Remove `getCommentCellUI`/`commentData` from `EditorContent`'s prop type.

- [ ] **Step 4: Build must pass** — `npm run build` → PASS.

---

## Task 14: CHECKPOINT 2 — in-cell popup + markers

No new demo code needed (Task 11 already wired `commentsConfig`).

- [ ] **Step 1: CHECKPOINT 2**

Run the app:
- Select a cell, open the in-cell comment UI (FortuneCore comment entry, or the cell context menu "comment"). The package popup appears (298px wide, "Comments" header).
- Type a comment, Send → a **cell marker** appears on the cell; the comment shows in the sidebar too (same store).
- Hover the cell → popup shows the comment (no input). Click/pin → input shows; add a reply.
- Resolve a comment from the popup → marker hides. Delete → marker hides + removed from sidebar.
- Set the demo's `isAuthenticated: false` (Task 11 config) and reload → the cell popup shows nothing (or your `unauthenticatedFallback` if you add one); set it back to `true`.
- No console errors.

- [ ] **Step 2: Commit (user runs)**

```bash
git add src/editor/components/comments/comment-cell-popup.tsx \
        src/editor/components/comments/use-comment-cell-popup.ts \
        src/editor/components/editor-workbook.tsx src/editor/dsheet-editor.tsx
git commit -m "feat(comments): in-cell comment popup + internal getCommentCellUI"
```

---

# PART D — API cleanup + exports

## Task 15: Remove old comment props; add exports

**Files:**
- Modify `src/editor/types.ts`
- Modify `src/index.ts`
- Modify `src/editor/dsheet-editor.tsx`, `src/editor/contexts/editor-context.tsx`

- [ ] **Step 1: Remove deprecated `DsheetProps` members** — delete `commentData`, `getCommentCellUI`, and `allowComments` from `DsheetProps` (all replaced by `commentsConfig`). Remove their pass-through in `SpreadsheetEditor`/`EditorContent`/`EditorProvider` (the derived values from Task 10 Step 3 stay). Fix any resulting type errors.

> This is a **breaking change** for consumers still passing `commentData`/`getCommentCellUI`/`allowComments`. That's expected — the `dsheets.new` switchover (separate effort) adopts `commentsConfig`.

- [ ] **Step 2: Add exports** to `src/index.ts`:

```ts
export { CommentsContent } from './editor/components/comments/comment-sidebar';
export { CommentCellUI } from './editor/components/comments/comment-cell-popup';
export type { CommentThread, CommentReply, CommentActionParams, CommentsConfig } from './editor/types/comments';
export { CommentAction } from './editor/types/comments';
export { useEnsStatus } from './editor/components/comments/ens/use-ens-status';
export type { EnsStatus } from './editor/components/comments/ens/ens-cache';
```

- [ ] **Step 3: Build must pass** — `npm run build` → PASS.

- [ ] **Step 4: CHECKPOINT 3 — full pass**

Run the app and re-verify both the sidebar (CP1) and the in-cell popup (CP2) still work end to end with the deprecated props gone. Console clean.

- [ ] **Step 5: Lint the new files** — `npx eslint src/editor/components/comments src/editor/utils/comment-key-utils.ts src/editor/utils/sheet-editor-safe.ts src/editor/utils/cell-comment-marker.ts src/editor/types/comments.ts --ext ts,tsx`. Fix anything new beyond the codebase's existing tolerances (`any`/`@ts-ignore` inherited from source are acceptable).

- [ ] **Step 6: Commit (user runs)**

```bash
git add src/editor/types.ts src/index.ts src/editor/dsheet-editor.tsx src/editor/contexts/editor-context.tsx
git commit -m "feat(comments): commentsConfig API + exports; remove legacy comment props"
```

---

## Done — what this delivers

- `commentsConfig` drives a full comments experience: sidebar panel + in-cell popup + cell markers, with storage/handlers owned by the consumer.
- App couplings resolved: **ENS handled in-package** (`@fileverse/ens` + module cache + `useEnsStatus`, gated by `commentsConfig.ensResolutionUrl`); RTC gating dropped; `usePathname`/`next/image` removed; wallet permissions replaced by injected `isOwner`/`currentUserAddress`; `selectedComment` + `removeCommentFromCell` now package-internal.
- Exported `CommentsContent`, `CommentCellUI`, and comment types for standalone use.

**Not included (separate effort):** the `dsheets.new` switchover — delete `components/comment-section/components/**` (UI) and wire `commentsConfig` from the surviving `useComments` hook + provide `isOwner`/`currentUserAddress`/`isAuthenticated`. Storage/sync/crypto/IPFS hooks and utils stay in `dsheets.new`.

---

## Open questions / risks

1. **`getFlowdata` import source** (Task 3) — confirm it's importable from `@sheet-engine/core`; the package re-exports it via `src/index.ts`, so the path may need to be the internal engine path. Verify at build.
2. **Empty-state asset** (Task 8) — `/assets/empty-comment.svg` is consumer-hosted; in the package it 404s (broken image, harmless). The ENS verified badge no longer uses an asset (`LucideIcon BadgeCheck`). A follow-up could accept an `emptyImage` prop or bundle the asset.
5. **`@fileverse/ens` availability** (Task ENS) — must be installable in the package. If private/unavailable, the resolver is BLOCKED; either publish/grant access or replicate `getAddressName` with viem (`getEnsName` against `ensResolutionUrl`) — viem would then be a new dep. Confirm before starting Part A.
6. **ENS verified-badge styling** — the spec'd badge is `LucideIcon BadgeCheck` (asset-free). If a pixel-exact match to the consumer's `verified.svg` is required, bundle that asset instead.
3. **RTC collaboration gating** — the consumer disabled comment input during RTC. The package hardcodes `enableCollaboration = false`. If a consumer needs RTC-aware disabling, add a `commentsConfig.disabled?: boolean` later.
4. **`formatCommentDateTime`** (Task 2) — verify the reconstructed format matches the consumer's exact output; copy verbatim if unsure.
