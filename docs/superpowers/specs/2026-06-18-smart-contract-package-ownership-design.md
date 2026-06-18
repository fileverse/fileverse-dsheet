# Smart Contract: Full Package Ownership Design

**Date:** 2026-06-18  
**Status:** Approved  
**Scope:** Move all smart contract reading functionality from `dsheets.new` into `@fileverse-dev/dsheet`

---

## Goal

Right now a consumer must implement `handleSmartContractQuery` (complex blockchain call logic), manage contract registry state, handle the import modal, and wire up the sidebar panel themselves. After this change: consumer passes `smartContracts` config prop with RPC URLs + optional storage adapter, and gets the full smart contract feature out of the box.

---

## Key Design Decisions

| Decision | Choice |
|---|---|
| Contract persistence | `contractStorage` adapter (localStorage default, consumer overrides) |
| `viem` in bundle | Externalized — consumer installs `viem`, package doesn't bundle it |
| Chain config | Consumer passes `rpcConfig: Record<string, string>` (chain name → RPC URL) |
| ABI storage | Stored directly in `contractStorage` (no IPFS dep in package) |

---

## What Moves from dsheets.new → Package

| Source (dsheets.new) | Destination (package) | Strip |
|---|---|---|
| `smart-contract-reading/types.ts` | `src/editor/types/smart-contract.ts` | Remove viem re-exports not needed |
| `smart-contract-reading/error-helper.ts` | `src/editor/utils/smart-contract/error-helper.ts` | — |
| `smart-contract-reading/helpers.ts` | `src/editor/utils/smart-contract/helpers.ts` | — |
| `smart-contract-reading/smart-contract-reading-utils.ts` | `src/editor/utils/smart-contract/reading-utils.ts` | Strip IPFS, keystore, Sentry, DB cache, ucans, AgentInstance |
| `smart-contract-reading/use-smart-contract-reading.tsx` | `src/editor/hooks/use-smart-contract-reading.ts` (internal) | Strip analytics, Sentry, IPFS keystore — replace with contractStorage adapter |
| `smart-contract-reading/use-smart-contract-modal.ts` | `src/editor/hooks/use-smart-contract-modal.ts` (internal) | Strip app-specific validation deps |
| `smart-contract-reading/smart-contract-modal.tsx` | `src/editor/components/smart-contract/smart-contract-modal.tsx` | Strip next/image |
| `smart-contract-reading/smart-contract-modal-ui.tsx` | `src/editor/components/smart-contract/smart-contract-modal-ui.tsx` | Strip next/image, 'use client' |
| `smart-contract-reading/modal/*.tsx` | `src/editor/components/smart-contract/modal/*.tsx` | Strip 'use client' |
| `smart-contract-reading/smart-contract-view-list.tsx` | `src/editor/components/smart-contract/smart-contract-view-list.tsx` | — |
| `smart-contract-reading/smart-contract-list-item.tsx` | `src/editor/components/smart-contract/smart-contract-list-item.tsx` | — |
| `smart-contract-reading/smart-contract-reading-intro.tsx` | `src/editor/components/smart-contract/smart-contract-intro.tsx` | Strip next/image |
| `smart-contract-reading/error-toast.tsx` | `src/editor/components/smart-contract/error-toast.tsx` | — |
| `smart-contract-reading/constants.ts` | `src/editor/utils/smart-contract/constants.ts` | Strip `RPC_URL_MAP`/`DEV_RPC_URL_MAP` (consumer provides RPC now) |
| `smart-contract-reading/index.css` | `src/editor/styles/smart-contract.css` | — |

**Files NOT moved (fileverse-specific, no generic equivalent):**
- `use-address-validation.ts` — uses `useAccountContext` (portal address lookup)
- `use-modal-outside-click.ts` — check if used, may not be needed
- `utils.ts` — check for fileverse-specific utils

---

## Critical Type Change: `ContractConfig`

Current `ContractConfig` stores `abiHash: string` (IPFS hash). Package can't fetch from IPFS. Replace with inline ABI:

```ts
// BEFORE (consumer):
export interface ContractConfig {
  address: Hex;
  abiHash: string;       // IPFS hash — package can't resolve this
  network: SupportedChain;
  name: string;
}

// AFTER (package):
export interface ContractConfig {
  address: Hex;
  abi: Abi;              // ABI stored directly
  network: SupportedChain;
  name: string;
}
```

`contractStorage.load()` returns `ContractConfig[]` with full ABI. No IPFS fetch needed during formula execution.

---

## New Types

### `ContractStorage`

```ts
export interface ContractStorage {
  load: () => Promise<ContractConfig[]>;
  save: (contracts: ContractConfig[]) => Promise<void>;
}

// Default localStorage implementation (internal to package):
const defaultContractStorage: ContractStorage = {
  load: async () => {
    try {
      return JSON.parse(localStorage.getItem('dsheet-contracts') ?? '[]');
    } catch {
      return [];
    }
  },
  save: async (contracts) => {
    localStorage.setItem('dsheet-contracts', JSON.stringify(contracts));
  },
};
```

### `SmartContractConfig` (new DsheetProps entry)

```ts
export interface SmartContractConfig {
  // Required: RPC URL per chain. Keys match SupportedChain enum values.
  // Package creates viem publicClient from these. Consumer provides own keys.
  rpcConfig: Partial<Record<SupportedChain, string>>;

  // Optional: where to persist saved contracts
  // Default: localStorage under 'dsheet-contracts'
  contractStorage?: ContractStorage;

  // Optional: lifecycle events for analytics/logging
  onSmartContractEvent?: (event: SmartContractEvent) => void;
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
  Sepolia = 'Sepolia',
  Gnosis = 'Gnosis',
  Base = 'Base',
}
```

---

## New DsheetProps Changes

### Removed Props

| Prop | Why |
|---|---|
| `handleSmartContractQuery` | Package implements blockchain call internally |
| `setShowSmartContractModal` | Package manages modal state via EditorContext |

### Added Props

```ts
// on DsheetProps:
smartContracts?: SmartContractConfig;
```

If `smartContracts` is not passed → smart contract formula cells show `#SC_DISABLED` error. SmartContractButton hidden from toolbar.

---

## Internal Architecture

### `src/editor/utils/smart-contract/reading-utils.ts`

Adapted from `smart-contract-reading-utils.ts`. Key changes:

**`executeSmartContractCall`** — keep as-is, uses `viem` (externalized).

**`parseCallSignature`** — keep core logic. Remove `getIPFSAsset` call (ABI now in `ContractConfig.abi` directly).

**`getContractConfig`** — remove `getPortalContractConfig` (fileverse-specific default contract). Remove `KSRInstance` usage. Looks up contract in registry by name only.

**`pushSmartContractToKeyStore` / `deleteContractFromKeyStore`** — remove entirely. Replaced by `contractStorage.save(updatedContracts)` calls in `useSmartContractReading`.

**`createPublicClient` call** — built from `rpcConfig` instead of hardcoded `RPC_URL_MAP`:

```ts
export const createSmartContractClient = (
  chain: SupportedChain,
  rpcConfig: Partial<Record<SupportedChain, string>>
) => {
  const rpcUrl = rpcConfig[chain];
  if (!rpcUrl) throw new UnsupportedChainError(chain);

  return createPublicClient({
    chain: SUPPORTED_VIEM_CHAIN_MAP[chain],
    transport: http(rpcUrl),
  });
};
```

**`POPULAR_CONTRACTS_MAP`** — moved from consumer `constants.ts` into package. These are pre-configured well-known contracts (Uniswap, etc.) available to all consumers without needing to import them.

### `src/editor/hooks/use-smart-contract-reading.ts` (internal)

Adapted from `use-smart-contract-reading.tsx`. Key changes:

**Remove:**
- `useAccountContext` — identity not needed
- `KSRInstance` / `getKeyStoreData` — keystore not needed  
- `publicIPFSUpload` — IPFS not needed
- `usePlausibleEvents` — analytics callbacks via `onSmartContractEvent` instead
- `captureException` — Sentry removed

**Replace:**
```ts
// BEFORE: load from IPFS keystore
const init = async () => {
  const keyStoreData = await getKeyStoreData(portalAddress, hash);
  registryMapRef.current = { ...keyStoreData.smartContracts, ...POPULAR_CONTRACTS_MAP };
};

// AFTER: load from contractStorage
const init = async () => {
  const saved = await contractStorage.load();
  const savedMap = Object.fromEntries(saved.map(c => [c.name, c]));
  registryMapRef.current = { ...savedMap, ...POPULAR_CONTRACTS_MAP };
  setUserSmartContracts(saved);
};
```

```ts
// BEFORE: save to IPFS keystore
await pushSmartContractToKeyStore(contractConfig);

// AFTER: save to contractStorage
const updated = [...userSmartContracts, contractConfig];
await contractStorage.save(updated);
setUserSmartContracts(updated);
registryMapRef.current[contractConfig.name] = contractConfig;
onSmartContractEvent?.({ type: 'contract-added', contractName: contractConfig.name });
```

**`handleSmartContractQuery`** — moves from a prop passed in from consumer to an internal function built by this hook. Wired into `afterUpdateCell` via `EditorContext` (same pattern as `openApiKeyModal`).

### `EditorContext` Changes

Add smart contract state:

```ts
// added to EditorContext:
const [showSmartContractModal, setShowSmartContractModal] = useState(false);

// SmartContractButton calls this (already wired in src/editor/components/smart-contract.tsx)
const openSmartContractModal = () => setShowSmartContractModal(true);
```

`handleSmartContractQuery` built from `useSmartContractReading` and passed down through context (same way `openApiKeyModal` is passed). `afterUpdateCell` calls it via context instead of via prop.

### `afterUpdateCell.tsx` Changes

```ts
// BEFORE:
handleSmartContractQuery?: SmartContractQueryHandler;

// AFTER:
// handleSmartContractQuery comes from EditorContext (built internally)
// no longer a param — accessed via context inside the component that calls afterUpdateCell
```

When `smartContracts` prop not passed → `handleSmartContractQuery` is undefined → `smartContractQueryHandlerFunction` returns `#SC_DISABLED`.

### Built-in Sidebar Panel

`smart-contract-list-view` auto-registered as a built-in panel alongside `comments`, `templates`, etc.:

```ts
{
  id: 'smart-contract-list-view',
  header: { title: 'My Smart Contracts' },
  width: '380px',
  content: <SmartContractListView
    userSmartContracts={userSmartContracts}
    onDelete={onDelete}
    handleSearch={handleSearch}
    setShowSmartContractModal={setShowSmartContractModal}
  />,
}
```

Only registered when `smartContracts` prop is passed. Hidden otherwise.

### `SmartContractModal` Changes

Currently consumer passes `registryMapRef` to modal. After: modal is rendered inside `EditorContent` driven by `showSmartContractModal` context state. `registryMapRef` is internal to `useSmartContractReading`.

`onSaveContract` signature changes: no longer uploads to IPFS. Accepts full ABI directly:

```ts
// BEFORE:
onSaveContract: (address, chain, abiJsonString, name) => Promise<void>
// internally: upload ABI to IPFS, store hash in ContractConfig

// AFTER:
onSaveContract: (address, chain, abi: Abi, name) => Promise<void>
// internally: store ABI directly in ContractConfig, save via contractStorage
```

---

## viem as External Dependency

Add `viem` to `rollupOptions.external` in `vite.config.ts`:

```ts
external: [
  // ... existing externals ...
  'viem',
  'viem/chains',
  'viem/ens',
]
```

Consumer install requirement (document in README):
```bash
npm install @fileverse-dev/dsheet viem
```

Consumers who don't use smart contracts don't need viem. The `smartContracts` prop being optional means the feature tree-shakes if consumers don't import it — but since it's inside `DSheetEditor`, viem is always required as a peer dep when `DSheetEditor` is used.

**Note:** This means all `DSheetEditor` consumers must install viem even without SC usage. If this is unacceptable, the alternative is dynamic import of SC utils — defer that decision until consumer feedback.

---

## New Package Exports

```ts
// src/index.ts additions:
export type {
  SmartContractConfig,
  SmartContractEvent,
  ContractStorage,
  ContractConfig,
  SupportedChain,
} from './editor/types/smart-contract';
```

`SmartContractListView`, `SmartContractModal`, `SmartContractIntro` are **not exported** — internal only. Consumer cannot override them.

---

## dsheets.new Migration

### Files to Delete

```
components/smart-contract-reading/  (entire directory)
```

Except keep temporarily: any IPFS-based migration utility needed to convert existing users' `abiHash`-based contracts to inline ABI format.

### Migration Concern: Existing User Data

Current dsheets.new users have `ContractConfig` with `abiHash` (IPFS hash) in their keystore. The new package uses `abi: Abi` directly. dsheets.new needs a **one-time migration**:

1. On app load, check if user has old keystore contracts with `abiHash`
2. For each: fetch ABI from IPFS via `getIPFSAsset(abiHash)`
3. Replace `abiHash` with fetched `abi`
4. Save updated contracts via `contractStorage.save`

This migration lives in `dsheets.new`, not the package.

### `contractStorage` Adapter for dsheets.new

dsheets.new passes a `contractStorage` adapter that uses its existing IPFS keystore (post-migration, contracts already have inline ABI):

```ts
smartContracts={{
  rpcConfig: {
    Ethereum: process.env.NEXT_PUBLIC_ETH_RPC_URL,
    Base: process.env.NEXT_PUBLIC_BASE_RPC_URL,
    Gnosis: process.env.NEXT_PUBLIC_GNOSIS_RPC_URL,
    Sepolia: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  },
  contractStorage: {
    load: async () => {
      const keyStoreData = await getKeyStoreData(portalAddress, hash);
      return Object.values(keyStoreData.smartContracts || {});
    },
    save: async (contracts) => {
      await updateKeyStoreData({ smartContracts: Object.fromEntries(contracts.map(c => [c.name, c])) });
    },
  },
  onSmartContractEvent: (event) => {
    if (event.type === 'query-success') onUseSmartContractReading();
    if (event.type === 'contract-added') onSmartContractAdd();
    if (event.type === 'query-error') captureException(new Error(event.errorMessage));
  },
}}
```

### Changes to `dsheet-editor.tsx`

**Remove:**
```ts
import { useSmartContractReading } from '../smart-contract-reading/use-smart-contract-reading';
import { SmartContractModal } from '../smart-contract-reading/smart-contract-modal';
import { SmartContractReadingIntro } from '../smart-contract-reading/smart-contract-reading-intro';
import { SmartContractReadingErrorToast } from '../smart-contract-reading/error-toast';

const { handleSmartContractQuery, onImportContract, userSmartContracts, ... } = useSmartContractReading();
const [showSmartContractModal, setShowSmartContractModal] = useState(false);
```

**Remove from `<DSheetEditor>` JSX:**
```tsx
handleSmartContractQuery={handleSmartContractQuery}
setShowSmartContractModal={setShowSmartContractModal}
```

**Remove from render:**
```tsx
<SmartContractModal ... />
<SmartContractReadingIntro />
<SmartContractReadingErrorToast ... />
```

**Add to `<DSheetEditor>` JSX:**
```tsx
smartContracts={{
  rpcConfig: { ... },
  contractStorage: { load, save },
  onSmartContractEvent: handleSmartContractEvent,
}}
```

---

## Summary: Before vs After (Consumer Perspective)

### Before
```tsx
const {
  handleSmartContractQuery, onImportContract,
  userSmartContracts, onDelete, handleSearch,
  registryMapRef, smartContractReadingError,
  setSmartContractReadingError,
} = useSmartContractReading();
const [showSmartContractModal, setShowSmartContractModal] = useState(false);

<DSheetEditor
  handleSmartContractQuery={handleSmartContractQuery}
  setShowSmartContractModal={setShowSmartContractModal}
  customPanels={[{
    id: 'smart-contract-list-view',
    content: <SmartContractListView userSmartContracts={userSmartContracts} ... />,
  }]}
/>
<SmartContractModal
  showSmartContractModal={showSmartContractModal}
  setShowSmartContractModal={setShowSmartContractModal}
  onSaveContract={onImportContract}
  registryMapRef={registryMapRef}
/>
<SmartContractReadingIntro />
<SmartContractReadingErrorToast ... />
```

### After
```tsx
<DSheetEditor
  smartContracts={{
    rpcConfig: {
      Ethereum: process.env.ETH_RPC_URL,
      Base: process.env.BASE_RPC_URL,
    },
    contractStorage: myKeystoreAdapter,
    onSmartContractEvent: handleSmartContractEvent,
  }}
/>
// Modal, list view, intro, error toast all render automatically inside DSheetEditor
```
