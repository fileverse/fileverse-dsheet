# `functionlist` usage in dSheet

This doc explains how `functionlist` (defined in locale files like `src/sheet-engine/core/locale/en.ts`) is loaded, cached, and consumed by the formula engine + React UI for autocomplete and function hints.

## What `functionlist` is

`functionlist` is an **array of function metadata objects** exported as part of a locale module (English shown below).

Example shape (from `src/sheet-engine/core/locale/en.ts`):

- **`n`**: function name (uppercase string, used as the primary key)
- **`t`**: function “type/category” (number; in this codebase `t === 20` is treated as “Onchain functions”)
- **`d`**: description (longer)
- **`a`**: abstract/summary (shorter)
- **`m`**: `[minArgs, maxArgs]`
- **`p`**: parameter list metadata (each param has `name`, `detail`, `example`, `require`, `repeat`, `type`)
- Some functions (notably “onchain” ones) may include extra fields used by the UI, e.g. **`LOGO`** and **`API_KEY`** (see “API key handling” below).

English locale additionally spreads in a base list:

- `src/sheet-engine/core/locale/en.ts` includes `...FUNCTION_LOCALE` from `@fileverse-dev/formulajs/crypto-constants`.

## How locale selection works (and why preloading matters)

Locale modules are dynamically imported and cached in-memory.

Key file:

- `src/sheet-engine/core/locale/index.ts`

Behavior:

- **`loadLocale(lang)`** asynchronously imports the best matching locale module and stores it in `localeCache`.
  - It tries an exact match (e.g. `zh-TW`), then base language (e.g. `zh`), then falls back to `en`.
  - This is intended to run **before first render**, because `locale(ctx)` is synchronous and only reads from the cache.
- **`locale(ctx)`** returns the cached locale object based on `ctx.lang` or `ctx.lang.split('-')[0]`, falling back to `localeCache.en`.

Implication:

- Any code calling `locale(ctx)` expects that `loadLocale()` has already populated `localeCache` for the desired language; otherwise it will fall back to English.

## Core runtime cache: `formulaCache.functionlistMap`

The core “fast lookup” structure is:

- `ctx.formulaCache.functionlistMap: Record<string, FunctionMeta>`

It is initialized as an empty object in the `FormulaCache` constructor:

- `src/sheet-engine/core/modules/formula.ts` (`FormulaCache` constructor sets `this.functionlistMap = {}`)

### Where the map is populated

There are multiple places that lazily populate `functionlistMap` if it’s empty:

- `src/sheet-engine/react/components/Workbook/api.ts`
  - In `onboardingActiveCell(functionName)`, it calls `locale(context).functionlist` and, if `ctx.formulaCache.functionlistMap` is empty, loads:
    - `ctx.formulaCache.functionlistMap[functionlist[i].n] = functionlist[i]`
- `src/sheet-engine/core/modules/formula.ts`
  - In `helpFunctionExe(...)`, it ensures the map is built before trying to resolve a function name from editor spans / tokens.

Important nuance:

- The keys are stored as **`functionlist[i].n`** (which is already uppercase in locale files).
- Many UI call sites normalize detected function names via `.toUpperCase()` before lookup, but not all DOM-derived values are guaranteed to be normalized, so consistent uppercase naming in `functionlist` matters.

## Autocomplete & hinting flow

The formula UI uses **two candidate arrays** on the context:

- `ctx.defaultCandidates`: shown when user has typed `=` but not started a function name
- `ctx.functionCandidates`: shown when user is typing a function name

Both are derived from `functionlist`:

### Default candidates (“Onchain functions”)

Key code:

- `src/sheet-engine/core/modules/formula.ts` in `rangeHightlightselected(...)`

When the current editor token is `=`:

- `ctx.defaultCandidates = functionlist.filter((d) => d.t === 20).slice(0, 11)`
- `ctx.functionHint` is also set using `helpFunctionExe(...)` for inline help.

UI rendering:

- `src/sheet-engine/react/components/SheetOverlay/FormulaSearch/index.tsx`
  - Displays a section titled “Onchain functions”
  - Applies authorization filtering (removes some entries when the user isn’t authorized)
  - Uses `LOGO` (if present) to render an icon for each function

### Search candidates (prefix / contains match)

Key code:

- `src/sheet-engine/core/modules/formula.ts` in `searchFunction(ctx, searchtxt)`

It searches locale `functionlist` and builds up to 10 results with a priority order:

- exact match (`n === searchtxt`)
- prefix match (`startsWith(n, searchtxt)`)
- substring match (`n.indexOf(searchtxt) > -1`)

Results are written into:

- `ctx.functionCandidates = list`

UI rendering:

- `src/sheet-engine/react/components/SheetOverlay/FormulaSearch/index.tsx` consumes `context.functionCandidates` (and also filters out `t === 20` for unauthenticated users).

### Function hints (“what is this function and its params?”)

The hint UI looks up the metadata object via `functionlistMap`:

- `src/sheet-engine/react/components/SheetOverlay/FormulaHint/index.tsx`
  - Computes:
    - `fn = context.formulaCache.functionlistMap[functionName]` (or falls back to `context.functionHint`)
  - Uses `fn` to render details and to drive “API key” UI when `fn.API_KEY` is present.

Both editors (cell editor and Fx bar) also compute `fn` for formula chrome:

- `src/sheet-engine/react/components/SheetOverlay/InputBox.tsx`
- `src/sheet-engine/react/components/FxEditor/index.tsx`

Both detect a function name in roughly this order:

- caret-on-span detection for nested calls (e.g. `SUM(MIN(` should hint `MIN`)
- `context.functionHint` (set by the core formula logic)
- regex parse on raw text (`/^=([A-Za-z_][A-Za-z0-9_]*)\s*\(/`)

## Editing / interaction guard that depends on `functionlistMap`

There is a guard in the mouse double-click handler:

- `src/sheet-engine/core/events/mouse.ts` `handleCellAreaDoubleClick(...)`

It returns early if:

- `ctx.formulaCache.functionlistMap[ctx.functionHint || ""]` exists

Effect:

- When the system believes you’re interacting with a function hint context (i.e., `functionHint` resolves to a known function), it prevents a double-click from entering certain edit flows.

## API key handling (datablock / onchain functions)

Some functions include metadata describing an API key requirement, e.g. `API_KEY`.

Places that use this:

- `src/sheet-engine/react/components/SheetOverlay/FormulaHint/index.tsx`
  - Reads `fn.API_KEY` and uses it as the localStorage key for saving/retrieving the value
- `src/editor/utils/after-update-cell.tsx`
  - After a data-block API response, it derives:
    - `apiKeyName = workbookContext?.formulaCache.functionlistMap[formulaName]?.API_KEY`
  - Passes that to `params.storeApiKey?.(apiKeyName)`

So `functionlist` is not only UI help text; it’s also the **source of truth for per-function integration metadata** like API keys.

## Parser-side usage (English-only fallback map)

The formula parser keeps its own map of function metadata from English locale:

- `src/sheet-engine/formula-parser/evaluate-by-operator/operator/formula-function.js`

It constructs:

- `FUNCTIONLIST_MAP_EN` keyed by `item.n.toUpperCase()`

This is used for debug logging right before calling into `@fileverse-dev/formulajs`:

- It logs `{ functionDetails }` alongside the requested symbol and params.

Notes:

- This code does **not** use `ctx.lang` or the current locale; it always uses English metadata.
- It does **not** appear to affect evaluation results; it’s used for observability/debug payloads.

## Summary of the end-to-end data flow

```mermaid
flowchart TD
  LoadLocale[loadLocale(lang)\nasync import locale module] --> LocaleCache[localeCache[lang]=module.default]
  LocaleCache --> LocaleFn[locale(ctx)\nsync getter]

  LocaleFn --> Functionlist[locale(ctx).functionlist\nArray<FunctionMeta>]
  Functionlist --> BuildMap[build ctx.formulaCache.functionlistMap\nkey: meta.n]

  Functionlist --> DefaultCandidates[ctx.defaultCandidates\nfilter t==20]
  Functionlist --> SearchCandidates[ctx.functionCandidates\nsearchFunction()]

  BuildMap --> HintsUI[FormulaHint/InputBox/FxEditor\nlookup meta by name]
  DefaultCandidates --> SearchUI[FormulaSearch renders lists]
  SearchCandidates --> SearchUI
```

