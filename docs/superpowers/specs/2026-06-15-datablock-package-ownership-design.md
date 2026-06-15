# Data Block: Full Package Ownership Design

**Date:** 2026-06-15  
**Status:** Approved  
**Scope:** Move all data block error handling, API key storage, and API key modal UI from `dsheets.new` into `@fileverse-dev/dsheet`

---

## Goal

Right now a consumer of `@fileverse-dev/dsheet` must:
- Implement `dataBlockApiKeyHandler` (complex async error handler with retry logic)
- Manage `openApiKeyModal` state + `openApiKeyModalRef`
- Track `contextApiKeyName` ref
- Render `<ApiKeyModal>` themselves
- Handle API key storage via `storeApiKey` prop

After this change: consumer passes zero data block props. Package handles everything. Consumer gets lifecycle events via one optional callback.

---

## What Moves from dsheets.new → Package

| Source (dsheets.new) | Destination (package) | Notes |
|---|---|---|
| `components/api-key-modal/api-key-modal.tsx` | `src/editor/components/api-key-modal/api-key-modal.tsx` | Strip Sentry, next/image, analytics |
| `components/api-key-modal/api-key-input.tsx` | `src/editor/components/api-key-modal/api-key-input.tsx` | Direct copy, no app deps |
| `components/api-key-modal/rate-limit-info.tsx` | `src/editor/components/api-key-modal/rate-limit-info.tsx` | Direct copy, no app deps |
| `components/function/api-keys/local-storage-helper.ts` | `src/editor/utils/api-key-storage.ts` | Becomes default `ApiKeyStorage` impl |
| `datablockErrorMessagesHandler` (inline in api-key-modal.tsx) | `src/editor/utils/data-block-error-handler.ts` | Strip Sentry, rewrite to use internal state |

### What Gets Stripped When Moving

From `api-key-modal.tsx`:
- `import { captureException } from '@sentry/nextjs'` — remove entire call
- `import Image from 'next/image'` — replace `<Image>` with `<img>`
- `import anime from '@/public/assets/anime.svg'` — copy asset to package or replace with package-local asset
- `import { getApiKey } from '@/components/function/api-keys/local-storage-helper'` — use internal `apiKeyStorage.get` instead

From `datablockErrorMessagesHandler`:
- `captureException(...)` — remove entirely
- `getApiKey(apiKeyName)` — replace with `apiKeyStorage.get(apiKeyName)`
- `openApiKeyModalRef` polling pattern — kept but driven by internal context state, not consumer refs

---

## New Architecture

### Internal Flow (end-to-end)

```
User types formula in cell
  → @sheet-engine fires afterUpdateCell
  → afterUpdateCell.tsx calls executeStringFunction
    → SUCCESS → formulaResponseUiSync updates cell → fire onDataBlockEvent({ type: 'success' })
    → ERROR → DataBlockErrorHandler.handle(error, context)
        → if LIVE_QUERY_ERROR: no-op (handled elsewhere)
        → if RATE_LIMIT or MISSING_KEY:
            → fire onDataBlockEvent({ type: 'error', errorType, functionName })
            → fire onDataBlockEvent({ type: 'api-key-required', apiKeyName })
            → set cell value to 'Waiting for API key...'
            → open ApiKeyModal via EditorContext (setApiKeyModalState)
            → await user saves key
            → apiKeyStorage.set(name, key)
            → fire onDataBlockEvent({ type: 'api-key-saved', apiKeyName })
            → fire onDataBlockEvent({ type: 'retry', functionName })
            → re-execute formula → formulaResponseUiSync
        → else:
            → fire onDataBlockEvent({ type: 'error', errorType, functionName })
            → set cell value to '#ERROR_TYPE'
```

### New File: `src/editor/utils/api-key-storage.ts`

```ts
export interface ApiKeyStorage {
  get: (name: string) => string | null;
  set: (name: string, key: string) => void;
  remove?: (name: string) => void;
}

export const defaultApiKeyStorage: ApiKeyStorage = {
  get:    (name) => localStorage.getItem(`dsheet-apikey-${name}`),
  set:    (name, key) => localStorage.setItem(`dsheet-apikey-${name}`, key),
  remove: (name) => localStorage.removeItem(`dsheet-apikey-${name}`),
};
```

### New File: `src/editor/utils/data-block-error-handler.ts`

Replaces `datablockErrorMessagesHandler`. Key differences:
- No `openApiKeyModalRef` / `setOpenApiKeyModal` from consumer
- Instead calls `openApiKeyModal(apiKeyName, onSave)` — a function from `EditorContext`
- Uses `apiKeyStorage` adapter (not hardcoded localStorage)
- Fires `onDataBlockEvent` at each lifecycle step

```ts
interface DataBlockErrorHandlerParams {
  data: ErrorMessageHandlerReturnType;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  row: number;
  column: number;
  newValue: Cell;
  apiKeyStorage: ApiKeyStorage;
  openApiKeyModal: (apiKeyName: string, onSave: (key: string) => void) => void;
  onDataBlockEvent?: (event: DataBlockEvent) => void;
  // retry helpers (already in package)
  executeStringFn: (formulaStr: string) => Promise<unknown>;
  formulaResponseUiSyncFn: typeof formulaResponseUiSync;
}

export const handleDataBlockError = async (params: DataBlockErrorHandlerParams) => { ... };
```

The wait-and-retry mechanism changes from polling `openApiKeyModalRef` every 1ms to a Promise that resolves when the modal's `onSave` callback fires. This is cleaner:

```ts
// old: poll ref every 1ms until false
// new: await a promise that resolves when user saves key
const key = await new Promise<string>((resolve) => {
  openApiKeyModal(apiKeyName, (savedKey) => resolve(savedKey));
});
```

### `EditorContext` Changes

Add modal state for `ApiKeyModal`. `openApiKeyModal` is a function components/utils in the package tree call to imperatively open the modal:

```ts
// added to EditorContext state:
interface ApiKeyModalState {
  open: boolean;
  apiKeyName: string;
  onSave: (key: string) => void;
  onClose: () => void;
}

const [apiKeyModalState, setApiKeyModalState] = useState<ApiKeyModalState | null>(null);

// exposed via context:
const openApiKeyModal = (apiKeyName: string, onSave: (key: string) => void) => {
  setApiKeyModalState({
    open: true,
    apiKeyName,
    onSave: (key: string) => {
      setApiKeyModalState(null);
      onSave(key);
    },
    onClose: () => setApiKeyModalState(null),
  });
};
```

`EditorContent` renders `<ApiKeyModal>` driven by this state:

```tsx
// inside EditorContent render:
{apiKeyModalState && (
  <ApiKeyModal
    open={apiKeyModalState.open}
    apiKeyName={apiKeyModalState.apiKeyName}
    onSave={apiKeyModalState.onSave}
    onClose={apiKeyModalState.onClose}
  />
)}
```

### `afterUpdateCell.tsx` Changes

Remove `dataBlockApiKeyHandler` and `storeApiKey` from `AfterUpdateCellParams`. Replace with internal handler:

```ts
// BEFORE (params from consumer):
dataBlockApiKeyHandler: DataBlockApiKeyHandlerType | undefined;
storeApiKey?: (apiKeyName: string) => void;

// AFTER (internal package deps):
apiKeyStorage: ApiKeyStorage;
openApiKeyModal: (apiKeyName: string, onSave: (key: string) => void) => void;
onDataBlockEvent?: (event: DataBlockEvent) => void;
```

Inside `afterUpdateCell`, replace the `dataBlockApiKeyHandler(...)` call with:
```ts
await handleDataBlockError({
  data: errorResult,
  sheetEditorRef,
  row,
  column,
  newValue,
  apiKeyStorage,
  openApiKeyModal,
  onDataBlockEvent,
  executeStringFn,
  formulaResponseUiSyncFn: formulaResponseUiSync,
});
```

---

## API Changes to `DsheetProps`

### Removed Props

| Prop | Why removed |
|---|---|
| `dataBlockApiKeyHandler` | Package handles error flow internally |
| `storeApiKey` | Package handles via `apiKeyStorage.set` |

### Added Props

```ts
// Optional — override where API keys are stored
apiKeyStorage?: ApiKeyStorage;

// Optional — lifecycle events for analytics/logging
onDataBlockEvent?: (event: DataBlockEvent) => void;
```

### Unchanged Props

`onDataBlockApiResponse` — renamed to `onDataBlockEvent` with `type: 'success'`. **Remove `onDataBlockApiResponse`** and replace with the richer `onDataBlockEvent`.

All other props unchanged.

---

## New Exported Types

```ts
export type DataBlockEventType =
  | 'success'
  | 'error'
  | 'api-key-required'
  | 'api-key-saved'
  | 'retry';

export interface DataBlockEvent {
  type: DataBlockEventType;
  functionName?: string;   // data block function name e.g. 'COINGECKO'
  errorType?: string;      // ERROR_MESSAGES_FLAG value on error
  apiKeyName?: string;     // key name e.g. 'COINGECKO_API_KEY'
}

export interface ApiKeyStorage {
  get: (name: string) => string | null;
  set: (name: string, key: string) => void;
  remove?: (name: string) => void;
}
```

Add to `src/index.ts`:
```ts
export type { DataBlockEvent, DataBlockEventType, ApiKeyStorage } from './editor/types';
```

---

## `ApiKeyModal` Component Interface (package-internal)

```ts
interface ApiKeyModalProps {
  open: boolean;
  apiKeyName: string;
  onSave: (key: string) => void;
  onClose: () => void;
}
```

The modal is **not exported** from the package. It is internal only. Consumer cannot override it (by design — approach A).

The anime SVG asset (`anime.svg`) needs to be copied into the package at `src/editor/assets/anime.svg` and imported locally.

---

## dsheets.new Migration

### Files to Delete

```
components/api-key-modal/api-key-modal.tsx
components/api-key-modal/api-key-input.tsx
components/api-key-modal/rate-limit-info.tsx
```

### Changes to `dsheet-editor.tsx`

**Remove:**
```ts
import { ApiKeyModal, datablockErrorMessagesHandler } from '../api-key-modal/api-key-modal';
import { useApiKeyModal } from './hooks/use-api-key-modal';
import useApiKeyStore from './hooks/use-api-key-store';
```

**Remove state:**
```ts
const { openApiKeyModal, setOpenApiKeyModal, openApiKeyModalRef, contextApiKeyName } = useApiKeyModal();
const { updateKeyStoreWithApiKey } = useApiKeyStore();
```

**Remove from `<DSheetEditor>` JSX:**
```tsx
storeApiKey={...}
dataBlockApiKeyHandler={...}
onDataBlockApiResponse={...}
```

**Remove from render:**
```tsx
<ApiKeyModal
  onSaveApiKey={updateKeyStoreWithApiKey}
  openApiKeyModal={openApiKeyModal}
  setOpenApiKeyModal={setOpenApiKeyModal}
  openApiKeyModalRef={openApiKeyModalRef}
  contextApiKeyName={contextApiKeyName}
/>
```

**Add to `<DSheetEditor>` JSX:**
```tsx
onDataBlockEvent={(event) => {
  if (event.type === 'success') {
    onDataBlockApiResponsePlausible(event.functionName || '');
  }
  if (event.type === 'error') {
    onDataBlockFailedResponsePlausible(event.functionName || '');
  }
  // onboarding side-effect (previously inside onDataBlockApiResponse)
  if (event.type === 'success') {
    if (localStorage.getItem('onboardingComplete') === 'processing') {
      setShowMobileViewWarning(true);
    }
  }
}}
```

### Files to Delete from dsheets.new hooks

```
components/dsheet-editor/hooks/use-api-key-modal.ts   (modal ref state management — no longer needed)
```

`use-api-key-store.ts` — check if used anywhere else before deleting. If only used for `storeApiKey`, delete it too.

---

## Summary: Before vs After (Consumer Perspective)

### Before (what consumer had to write)
```tsx
const { openApiKeyModal, setOpenApiKeyModal, openApiKeyModalRef, contextApiKeyName } = useApiKeyModal();
const { updateKeyStoreWithApiKey } = useApiKeyStore();

<DSheetEditor
  storeApiKey={(keyName) => updateKeyStoreWithApiKey(keyName, getApiKey(keyName))}
  dataBlockApiKeyHandler={(handlerArg) => {
    onDataBlockFailedResponsePlausible(handlerArg.data.functionName || '');
    datablockErrorMessagesHandler({
      ...handlerArg,
      contextApiKeyName,
      setOpenApiKeyModal,
      openApiKeyModalRef,
    });
  }}
  onDataBlockApiResponse={(name) => {
    onDataBlockApiResponsePlausible(name);
    if (localStorage.getItem('onboardingComplete') === 'processing') {
      setShowMobileViewWarning(true);
    }
  }}
/>
<ApiKeyModal
  onSaveApiKey={updateKeyStoreWithApiKey}
  openApiKeyModal={openApiKeyModal}
  setOpenApiKeyModal={setOpenApiKeyModal}
  openApiKeyModalRef={openApiKeyModalRef}
  contextApiKeyName={contextApiKeyName}
/>
```

### After (what consumer writes)
```tsx
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
