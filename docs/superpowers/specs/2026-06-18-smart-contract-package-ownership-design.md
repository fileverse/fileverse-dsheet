# Smart Contract: Full Package Ownership Design

**Date:** 2026-06-18  
**Status:** Approved  
**Scope:** Move all smart contract reading functionality from `dsheets.new` into `@fileverse-dev/dsheet`

---

## Goal

Consumer currently must implement `handleSmartContractQuery` (blockchain call logic), manage contract registry state, render the import modal, handle the sidebar panel, and wire all of it together. After this change: consumer loads contracts from their own storage, passes them to the package alongside RPC config and save/delete callbacks, and gets UI + execution out of the box.

---

## Key Design Decisions

| Decision | Choice |
|---|---|
| Contract persistence | **Consumer-owned** — package never touches storage. Consumer passes loaded contracts + callbacks. |
| `viem` in bundle | Externalized — consumer installs `viem`, package doesn't bundle it |
| Chain config | Consumer passes `rpcConfig: Partial<Record<SupportedChain, string>>` |
| ABI in `ContractConfig` | Inline `abi: Abi` field — consumer resolves ABI before passing (no IPFS in package) |

---

## New `smartContracts` Prop (Controlled Component)

```ts
export interface SmartContractConfig {
  // RPC URL per chain. Package creates viem publicClient from these.
  rpcConfig: Partial<Record<SupportedChain, string>>;

  // Consumer provides already-loaded contracts (with ABI resolved, not hash)
  contracts: ContractConfig[];

  // Package calls these when user adds/removes a contract via UI.
  // Consumer is responsible for persisting the change and updating `contracts` prop.
  onAddContract: (contract: ContractConfig) => Promise<void>;
  onDeleteContract: (contractName: string) => Promise<void>;

  // Optional: lifecycle callbacks for analytics/error logging
  onSmartContractEvent?: (event: SmartContractEvent) => void;
}
```

No storage adapter. No localStorage default. Package is stateless with respect to contracts — it reads from `contracts` prop, calls `onAddContract`/`onDeleteContract`, and lets consumer update their state. Consumer re-renders with updated `contracts`, package reflects the change.

---

## Type Changes

### `ContractConfig`

Current shape stores `abiHash: string` (IPFS hash). Package can't resolve IPFS. Consumer must pass ABI inline:

```ts
// BEFORE (consumer):
export interface ContractConfig {
  address: Hex;
  abiHash: string;       // IPFS hash — consumer fetches ABI separately
  network: SupportedChain;
  name: string;
}

// AFTER (package exports this):
export interface ContractConfig {
  address: Hex;
  abi: Abi;              // ABI already resolved — consumer's responsibility
  network: SupportedChain;
  name: string;
}
```

Consumer migration: on load, fetch ABI from IPFS using `abiHash`, replace field, pass to package.

### Other Types

```ts
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

## DsheetProps Changes

### Removed Props

| Prop | Why |
|---|---|
| `handleSmartContractQuery` | Package implements blockchain call internally |
| `setShowSmartContractModal` | Package manages modal state via EditorContext |

### Added Prop

```ts
smartContracts?: SmartContractConfig;
```

If not passed → SC formula cells return `#SC_DISABLED`. SmartContractButton hidden from toolbar.

---

## What Moves from dsheets.new → Package

| Source (dsheets.new) | Destination (package) | Strip |
|---|---|---|
| `smart-contract-reading/types.ts` | `src/editor/types/smart-contract.ts` | Remove fileverse-specific types |
| `smart-contract-reading/error-helper.ts` | `src/editor/utils/smart-contract/error-helper.ts` | — |
| `smart-contract-reading/helpers.ts` | `src/editor/utils/smart-contract/helpers.ts` | — |
| `smart-contract-reading/smart-contract-reading-utils.ts` | `src/editor/utils/smart-contract/reading-utils.ts` | Strip IPFS, keystore, Sentry, DB cache, ucans, AgentInstance |
| `smart-contract-reading/use-smart-contract-reading.tsx` | `src/editor/hooks/use-smart-contract-reading.ts` (internal) | Strip all storage/IPFS — use `contracts` prop + callbacks |
| `smart-contract-reading/use-smart-contract-modal.ts` | `src/editor/hooks/use-smart-contract-modal.ts` (internal) | Strip app-specific validation deps |
| `smart-contract-reading/smart-contract-modal.tsx` | `src/editor/components/smart-contract/smart-contract-modal.tsx` | Strip `next/image` |
| `smart-contract-reading/smart-contract-modal-ui.tsx` | `src/editor/components/smart-contract/smart-contract-modal-ui.tsx` | Strip `next/image`, `'use client'` |
| `smart-contract-reading/modal/*.tsx` | `src/editor/components/smart-contract/modal/*.tsx` | Strip `'use client'` |
| `smart-contract-reading/smart-contract-view-list.tsx` | `src/editor/components/smart-contract/smart-contract-view-list.tsx` | — |
| `smart-contract-reading/smart-contract-list-item.tsx` | `src/editor/components/smart-contract/smart-contract-list-item.tsx` | — |
| `smart-contract-reading/smart-contract-reading-intro.tsx` | `src/editor/components/smart-contract/smart-contract-intro.tsx` | Strip `next/image` |
| `smart-contract-reading/error-toast.tsx` | `src/editor/components/smart-contract/error-toast.tsx` | — |
| `smart-contract-reading/constants.ts` | `src/editor/utils/smart-contract/constants.ts` | Strip `RPC_URL_MAP`/`DEV_RPC_URL_MAP` |
| `smart-contract-reading/index.css` | `src/editor/styles/smart-contract.css` | — |

**Files NOT moved (fileverse-specific):**
- `use-address-validation.ts` — uses `useAccountContext` (portal address lookup)
- `use-modal-outside-click.ts` — verify if still needed, likely removable
- `utils.ts` — check for fileverse-specific helpers before moving

---

## Internal Architecture

### `src/editor/hooks/use-smart-contract-reading.ts`

Adapted from `use-smart-contract-reading.tsx`. No storage logic. Builds registry from `contracts` prop:

```ts
// BEFORE: loads from IPFS keystore
const init = async () => {
  const keyStoreData = await getKeyStoreData(portalAddress, hash);
  registryMapRef.current = { ...keyStoreData.smartContracts, ...POPULAR_CONTRACTS_MAP };
};

// AFTER: builds from `contracts` prop
useEffect(() => {
  const savedMap = Object.fromEntries(contracts.map(c => [c.name, c]));
  registryMapRef.current = { ...savedMap, ...POPULAR_CONTRACTS_MAP };
}, [contracts]);
```

When user imports a contract via modal:
```ts
// BEFORE: uploads ABI to IPFS, saves hash to keystore
await pushSmartContractToKeyStore(contractConfig);

// AFTER: calls consumer callback, consumer handles persistence + state update
await onAddContract(contractConfig);
onSmartContractEvent?.({ type: 'contract-added', contractName: contractConfig.name });
```

When user deletes:
```ts
await onDeleteContract(contractName);
onSmartContractEvent?.({ type: 'contract-deleted', contractName });
```

`registryMapRef` stays in sync with `contracts` prop via `useEffect`. Consumer drives the data.

**Remove from hook:**
- `useAccountContext` — identity not needed
- `KSRInstance` / `getKeyStoreData` — keystore gone
- `publicIPFSUpload` — IPFS gone
- `usePlausibleEvents` — replaced by `onSmartContractEvent`
- `captureException` — Sentry removed; consumer handles via `onSmartContractEvent`

### `src/editor/utils/smart-contract/reading-utils.ts`

**`parseCallSignature`** — remove `getIPFSAsset` call. ABI comes from `ContractConfig.abi` directly.

**`getContractConfig`** — remove `getPortalContractConfig` (fileverse "My Fileverse portal" default). Look up by name from registry only.

**`pushSmartContractToKeyStore` / `deleteContractFromKeyStore`** — not moved. Replaced by callbacks.

**`createSmartContractClient`** — built from `rpcConfig` prop instead of hardcoded `RPC_URL_MAP`:

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

**`POPULAR_CONTRACTS_MAP`** — moved into package constants. Pre-configured well-known contracts (Uniswap, etc.) with full ABI objects bundled. Available to all consumers automatically.

### `EditorContext` Changes

```ts
// added:
const [showSmartContractModal, setShowSmartContractModal] = useState(false);

// handleSmartContractQuery built from useSmartContractReading, passed through context
// afterUpdateCell accesses it via context (same pattern as openApiKeyModal)
```

### `afterUpdateCell.tsx` Changes

`handleSmartContractQuery` removed as a param. Consumed from EditorContext instead. When `smartContracts` not passed → `handleSmartContractQuery` is `undefined` → `smartContractQueryHandlerFunction` returns `#SC_DISABLED`.

### Built-in Sidebar Panel

Auto-registered when `smartContracts` prop present:

```ts
{
  id: 'smart-contract-list-view',
  header: { title: 'My Smart Contracts' },
  width: '380px',
  content: <SmartContractListView
    userSmartContracts={contracts}  // from prop, not internal state
    onDelete={onDeleteContract}
    handleSearch={handleSearch}
    setShowSmartContractModal={setShowSmartContractModal}
  />,
}
```

### `SmartContractModal` Changes

Rendered inside `EditorContent` driven by `showSmartContractModal` context state.

`onSaveContract` accepts full ABI (not IPFS hash):
```ts
// BEFORE:
onSaveContract: (address, chain, abiJsonString, name) => Promise<void>
// internally: upload to IPFS, store hash

// AFTER:
onSaveContract: (address, chain, abi: Abi, name) => Promise<void>
// internally: build ContractConfig with inline abi, call onAddContract(config)
```

---

## viem as External Dependency

Add to `vite.config.ts` externals:
```ts
'viem',
'viem/chains',
```

Consumer install:
```bash
npm install @fileverse-dev/dsheet viem
```

All `DSheetEditor` consumers must install viem (even without SC usage, since it's bundled in the same entry). If this becomes a pain point, defer SC utils to a dynamic import — not needed now.

---

## New Package Exports

```ts
export type {
  SmartContractConfig,
  SmartContractEvent,
  ContractConfig,
  SupportedChain,
} from './editor/types/smart-contract';
```

`SmartContractListView`, `SmartContractModal`, `SmartContractIntro` — internal only, not exported.

---

## dsheets.new Migration

### Files to Delete

```
components/smart-contract-reading/  (entire directory)
```

Keep temporarily: IPFS fetch utility needed for one-time migration of existing users.

### Existing User Data Migration

Users have `ContractConfig` with `abiHash` in keystore. Before passing to package, consumer must resolve:

```ts
// One-time migration in dsheets.new:
const migrateContracts = async (rawContracts: OldContractConfig[]) => {
  return Promise.all(rawContracts.map(async (c) => {
    if ('abiHash' in c) {
      const abi = await getIPFSAsset(c.abiHash);
      return { ...c, abi, abiHash: undefined };
    }
    return c;
  }));
};
```

Run on app load, save migrated list back to keystore. After migration, all contracts have inline `abi`.

### New dsheets.new Usage

```tsx
// dsheets.new loads contracts from its keystore, resolves ABI, passes to package
const [contracts, setContracts] = useState<ContractConfig[]>([]);

useEffect(() => {
  loadAndMigrateContracts(portalAddress, hash).then(setContracts);
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
    onAddContract: async (contract) => {
      await updateKeyStoreData({ smartContracts: { ...keystoreContracts, [contract.name]: contract } });
      setContracts(prev => [...prev, contract]);
      onSmartContractAdd(); // analytics
    },
    onDeleteContract: async (name) => {
      const updated = contracts.filter(c => c.name !== name);
      await updateKeyStoreData({ smartContracts: Object.fromEntries(updated.map(c => [c.name, c])) });
      setContracts(updated);
    },
    onSmartContractEvent: (event) => {
      if (event.type === 'query-success') onUseSmartContractReading();
      if (event.type === 'query-error') captureException(new Error(event.errorMessage));
    },
  }}
/>
```

### Remove from `dsheet-editor.tsx`

```ts
// Remove:
import { useSmartContractReading } from '../smart-contract-reading/use-smart-contract-reading';
import { SmartContractModal } from '../smart-contract-reading/smart-contract-modal';
import { SmartContractReadingIntro } from '../smart-contract-reading/smart-contract-reading-intro';
import { SmartContractReadingErrorToast } from '../smart-contract-reading/error-toast';

const { handleSmartContractQuery, onImportContract, userSmartContracts, ... } = useSmartContractReading();
const [showSmartContractModal, setShowSmartContractModal] = useState(false);

// Remove from JSX:
handleSmartContractQuery={handleSmartContractQuery}
setShowSmartContractModal={setShowSmartContractModal}

// Remove from render:
<SmartContractModal ... />
<SmartContractReadingIntro />
<SmartContractReadingErrorToast ... />
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
} = useSmartContractReading({ portalAddress, hash, ... });
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
const [contracts, setContracts] = useState<ContractConfig[]>([]);
// consumer loads + migrates contracts from their own storage on mount

<DSheetEditor
  smartContracts={{
    rpcConfig: { Ethereum: '...', Base: '...' },
    contracts,
    onAddContract: async (c) => { /* save to keystore, setContracts */ },
    onDeleteContract: async (name) => { /* remove from keystore, setContracts */ },
    onSmartContractEvent: (e) => { /* analytics, error logging */ },
  }}
/>
// Modal, list view, intro, error toast all render inside DSheetEditor automatically
```

Consumer still owns storage. Package owns UI and execution.
