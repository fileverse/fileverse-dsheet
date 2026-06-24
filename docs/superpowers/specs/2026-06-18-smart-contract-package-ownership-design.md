# Smart Contract: Full Package Ownership Design

**Date:** 2026-06-18
**Status:** Approved
**Revision:** Resolver-callback model — storage stays consumer-owned. Package never touches IPFS, keystore, or persistence. ABI is fetched on demand via a consumer-provided `resolveAbi` callback and cached in the package.
**Scope:** Move all smart contract reading functionality from `dsheets.new` into `@fileverse-dev/dsheet`, **except** persistence and ABI resolution.

---

## Goal

Consumer currently implements `handleSmartContractQuery` (blockchain call logic), manages contract registry state, renders the import modal, wires the sidebar panel, owns all UI, and handles persistence + IPFS ABI resolution.

After this change: the package owns execution, registry state, and all UI. The consumer keeps only what it already does well — persisting contracts and resolving ABIs from its own store (IPFS keystore today). The consumer passes RPC config, a list of contract **references**, a `resolveAbi` callback, and add/delete callbacks. Everything else moves into the package.

**The storage mechanism is unchanged.** Contracts keep being persisted as references with an `abiHash` (IPFS pointer). No data migration is required.

---

## Key Design Decisions

| Decision | Choice |
|---|---|
| Contract persistence | **Consumer-owned, unchanged.** Package never reads/writes storage. |
| ABI resolution | **Consumer-owned via `resolveAbi(abiHash)` callback.** Package calls it lazily, caches the result. Package has no IPFS dependency. |
| `ContractConfig` shape | Keeps `abiHash` (reference). **No inline ABI, no migration.** |
| ABI caching | Package caches resolved ABIs in memory, one fetch per contract per session. |
| `viem` in bundle | Externalized — consumer installs `viem`, package doesn't bundle it. |
| Chain config | Consumer passes `rpcConfig: Partial<Record<SupportedChain, string>>`. |
| Popular contracts | Bundled in package with full ABI inline (package-owned constants — no resolver needed for these). |
| Input validation | Generic checks (valid address, valid ABI JSON) in package; optional `validateAddress` callback for consumer-specific rules. |

---

## The `smartContracts` Prop

```ts
export interface SmartContractConfig {
  // Required: RPC URL per chain. Package creates the viem publicClient from these.
  rpcConfig: Partial<Record<SupportedChain, string>>;

  // Required: consumer-loaded contract REFERENCES (no ABI, just the pointer).
  contracts: ContractConfig[];

  // Required: resolve an ABI from its pointer. Package calls this lazily at read
  // time and caches the result. Consumer implements however it stores ABIs
  // (e.g. fetch from IPFS by hash). Package never touches IPFS itself.
  resolveAbi: (abiHash: string) => Promise<Abi>;

  // Package calls when user imports a contract via the modal. Package hands over
  // the raw ABI; consumer persists however it wants (e.g. upload ABI to IPFS,
  // store the returned hash) and updates the `contracts` prop.
  onAddContract: (contract: NewContractInput) => Promise<void>;

  // Package calls when user deletes a contract from the list panel.
  onDeleteContract: (contractName: string) => Promise<void>;

  // Optional: consumer-specific address validation (e.g. portal lookup).
  // Package always runs generic format validation first.
  validateAddress?: (address: string, chain: SupportedChain) => Promise<boolean> | boolean;

  // Optional: lifecycle callbacks for analytics/error logging.
  onSmartContractEvent?: (event: SmartContractEvent) => void;
}
```

The package is stateless with respect to persistence. It reads from `contracts` (references), resolves ABIs lazily via `resolveAbi`, and calls `onAddContract` / `onDeleteContract` when the user acts. The consumer persists and updates the `contracts` prop; the package re-renders to reflect it.

---

## Types

### `ContractConfig` (reference — unchanged shape, no migration)

```ts
export interface ContractConfig {
  address: Hex;
  abiHash: string;       // IPFS pointer (or any consumer-defined key). Package
                         // never resolves this itself — it passes it to resolveAbi.
  network: SupportedChain;
  name: string;
}
```

This is the same shape consumers already store. No conversion of existing user data.

### `NewContractInput` (what the modal hands to the consumer on add)

```ts
export interface NewContractInput {
  address: Hex;
  abi: Abi;              // full ABI the user pasted/uploaded in the modal
  network: SupportedChain;
  name: string;
}
```

The package gives the consumer the raw ABI. The consumer decides how to turn it into a stored reference (e.g. upload to IPFS → get `abiHash`). The package does not produce or store `abiHash`.

### Internal registry entry

```ts
// internal to the package — not exported
interface ResolvedContract {
  address: Hex;
  abi: Abi;              // present once resolved (or inline for popular contracts)
  network: SupportedChain;
  name: string;
}
```

### Other types

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
| `handleSmartContractQuery` | Package implements the blockchain call internally |
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
| `smart-contract-reading/smart-contract-reading-utils.ts` | `src/editor/utils/smart-contract/reading-utils.ts` | Strip IPFS fetch, keystore, Sentry, DB cache, ucans, AgentInstance |
| `smart-contract-reading/use-smart-contract-reading.tsx` | `src/editor/hooks/use-smart-contract-reading.ts` (internal) | Strip all storage/IPFS — use `contracts` + `resolveAbi` + callbacks |
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

**Files NOT moved (stay in dsheets.new — storage/identity/resolution side):**
- The IPFS ABI fetch (`getIPFSAsset`) — lives behind the consumer's `resolveAbi`.
- The keystore read/write (`getKeyStoreData` / `updateKeyStoreData`) — lives behind `contracts` + `onAddContract` + `onDeleteContract`.
- The IPFS ABI upload on import — lives behind `onAddContract`.
- `use-address-validation.ts` — portal lookup via `useAccountContext`. Generic validation moves to the package; the portal-specific check is injected via the optional `validateAddress` callback.
- `use-modal-outside-click.ts` — verify if still needed, likely removable.
- `utils.ts` — check for fileverse-specific helpers before moving.

---

## Internal Architecture

### `src/editor/hooks/use-smart-contract-reading.ts`

No storage logic, no IPFS. Builds an in-memory registry of references from the `contracts` prop, merged with bundled popular contracts. Resolves ABIs lazily through `resolveAbi`, caching results.

```ts
// references from prop + popular (popular carry inline ABI)
const referenceMapRef = useRef<Record<string, ContractConfig | ResolvedContract>>({});
const abiCacheRef = useRef<Record<string, Abi>>({});  // keyed by abiHash

useEffect(() => {
  const userMap = Object.fromEntries(contracts.map(c => [c.name, c]));
  referenceMapRef.current = { ...userMap, ...POPULAR_CONTRACTS_MAP };
}, [contracts]);

// lazy resolve + cache
const getAbi = async (entry: ContractConfig | ResolvedContract): Promise<Abi> => {
  if ('abi' in entry) return entry.abi;                 // popular contract, inline
  if (abiCacheRef.current[entry.abiHash]) return abiCacheRef.current[entry.abiHash];
  const abi = await resolveAbi(entry.abiHash);          // consumer fetches (e.g. IPFS)
  abiCacheRef.current[entry.abiHash] = abi;
  return abi;
};
```

On import:
```ts
// package collected raw ABI in the modal; consumer persists it
await onAddContract({ address, network, name, abi });
onSmartContractEvent?.({ type: 'contract-added', contractName: name });
// consumer updates `contracts`; package re-syncs via useEffect.
// package may also pre-seed abiCache for the new contract once the consumer
// reports back its abiHash on the next `contracts` render.
```

On delete:
```ts
await onDeleteContract(contractName);
onSmartContractEvent?.({ type: 'contract-deleted', contractName });
```

**Removed from the hook:**
- `useAccountContext` — identity not needed (consumer's `resolveAbi`/storage owns it)
- `KSRInstance` / `getKeyStoreData` — keystore gone from package
- `publicIPFSUpload` / `getIPFSAsset` — IPFS gone from package
- `usePlausibleEvents` — replaced by `onSmartContractEvent`
- `captureException` — Sentry removed; consumer handles via `onSmartContractEvent`

### `src/editor/utils/smart-contract/reading-utils.ts`

**`parseCallSignature`** — remove the `getIPFSAsset` call. The ABI is supplied by the caller (resolved via `getAbi` / cache), not fetched here.

**`getContractConfig`** — remove `getPortalContractConfig` (fileverse default). Look up by name from the registry only.

**`pushSmartContractToKeyStore` / `deleteContractFromKeyStore`** — not moved. Replaced by `onAddContract` / `onDeleteContract` callbacks.

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

**`POPULAR_CONTRACTS_MAP`** — moved into package constants. Pre-configured well-known contracts (Uniswap, etc.) with **full ABI objects bundled inline**. These need no `resolveAbi` call — they resolve to themselves. Available to all consumers automatically.

### Read flow (end-to-end)

```
User types SC formula in cell
  → afterUpdateCell triggers smart contract handler (from EditorContext)
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

### `EditorContext` Changes

```ts
const [showSmartContractModal, setShowSmartContractModal] = useState(false);
// handleSmartContractQuery built from useSmartContractReading, passed through context
// afterUpdateCell accesses it via context (same pattern as openApiKeyModal)
```

### `afterUpdateCell.tsx` Changes

`handleSmartContractQuery` removed as a param. Consumed from EditorContext. When `smartContracts` not passed → handler is `undefined` → `smartContractQueryHandlerFunction` returns `#SC_DISABLED`.

### Built-in Sidebar Panel

Auto-registered when `smartContracts` prop present:

```ts
{
  id: 'smart-contract-list-view',
  header: { title: 'My Smart Contracts' },
  width: '380px',
  content: <SmartContractListView
    userSmartContracts={contracts}   // references from prop
    onDelete={onDeleteContract}
    handleSearch={handleSearch}
    setShowSmartContractModal={setShowSmartContractModal}
  />,
}
```

### `SmartContractModal` Changes

Rendered inside `EditorContent`, driven by `showSmartContractModal` context state.

Import flow:
1. User enters address, chain, ABI JSON, name.
2. Package runs generic validation: valid address format, parseable ABI JSON.
3. If `validateAddress` provided → package awaits it (e.g. portal lookup).
4. On pass → `onAddContract({ address, network, name, abi })`. The consumer persists (e.g. upload ABI to IPFS, store `abiHash`).

```ts
// BEFORE: modal/handler uploaded ABI to IPFS, stored hash
// AFTER:
onSaveContract: (address, chain, abi: Abi, name) => Promise<void>
// internally: validate, then onAddContract({ address, network: chain, name, abi })
```

The package never uploads to IPFS or computes a hash. That stays inside the consumer's `onAddContract`.

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

All `DSheetEditor` consumers must install `viem` (even without SC usage, since it's in the same entry). If this becomes a pain point, defer SC utils to a dynamic import — not needed now.

---

## New Package Exports

```ts
export type {
  SmartContractConfig,
  SmartContractEvent,
  ContractConfig,
  NewContractInput,
  SupportedChain,
} from './editor/types/smart-contract';
```

`SmartContractListView`, `SmartContractModal`, `SmartContractIntro` — internal only, not exported.

---

## dsheets.new Migration

### Files to Delete

```
components/smart-contract-reading/   (UI, hooks, reading utils — moved to package)
```

**Keep in dsheets.new** (these back the consumer callbacks):
- `getIPFSAsset` — used inside `resolveAbi`
- IPFS ABI upload helper — used inside `onAddContract`
- keystore read/write (`getKeyStoreData` / `updateKeyStoreData`) — used to load `contracts` and inside `onAddContract` / `onDeleteContract`
- portal address validation — used inside `validateAddress`

### No Data Migration

Existing users store `ContractConfig` with `abiHash`. The package keeps that exact shape. **Nothing to convert.** Old keystores work unchanged.

### New dsheets.new Usage

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
```

### Remove from `dsheet-editor.tsx`

```ts
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
<SmartContractModal ... />
<SmartContractReadingIntro />
<SmartContractReadingErrorToast ... />
```

### After
```tsx
const [contracts, setContracts] = useState<ContractConfig[]>([]);
// load references (abiHash) from keystore on mount — no ABI fetch up front

<DSheetEditor
  smartContracts={{
    rpcConfig: { Ethereum: '...', Base: '...' },
    contracts,
    resolveAbi: async (hash) => getIPFSAsset(hash),
    onAddContract: async (c) => { /* upload ABI, store ref, setContracts */ },
    onDeleteContract: async (name) => { /* remove ref, setContracts */ },
    validateAddress: async (addr) => isValidPortalAddress(addr),
    onSmartContractEvent: (e) => { /* analytics, error logging */ },
  }}
/>
// Modal, list view, intro, error toast all render inside DSheetEditor automatically
```

Consumer still owns storage **and ABI resolution**. Package owns UI, registry state, and execution.

---

## Why Resolver-Callback (vs Inline-ABI)

This revision replaces the earlier inline-ABI model. Compared to inlining the full ABI into each `ContractConfig`:

**Wins**
- **No data migration.** Existing `abiHash` keystores work unchanged.
- **No storage/sync bloat.** References stay ~46-byte hashes, not tens-of-KB ABIs. IPFS content-addressing/dedup preserved.
- **Lazy.** Only ABIs of contracts actually referenced in formulas are fetched, once per session, then cached.
- Package stays fully IPFS-free.

**Costs**
- First read of each contract per session awaits `resolveAbi` (network latency), then cached.
- A `resolveAbi` failure is a per-cell read failure (`#SC_ABI_ERROR`) — isolated by the cache, does not affect other contracts.
- The feature requires the consumer to implement `resolveAbi`; a consumer with no ABI store of its own cannot use SC reading. Acceptable, since keeping consumer-owned storage is the explicit premise of this design.
