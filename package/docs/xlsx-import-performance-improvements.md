# XLSX Import Efficiency Analysis & Optimizations

## Context

For large files (100k+ cells, multiple sheets), the import runs several passes that accumulate hidden cost. This document identifies what's wasteful and what concrete changes to make.

---

## Current Pass Map

| # | Where | What | Cost |
|---|-------|------|------|
| 1 | `workbook.eachSheet → ws.eachRow → row.eachCell` | Build hyperlinks, styles maps | O(all cells × sheets) — exceljs pass |
| 2 | `worksheet.getSheetValues().reduce()` | Detect dropdowns | O(all cells in sheet 1) — even if zero dropdowns |
| 3 | `transformExcelToLucky(file, ...)` | Re-parse entire file | Second full parse of the xlsx binary |
| 4 | `sheets.map` with inner cell loop | Apply styles/hyperlinks/date fix | O(cells × sheets) — luckyexcel pass |
| 5 | `combinedSheets.map` | Assign `order` field | O(sheets) — redundant extra loop |
| 6 | `useEffect` on `mergeInfo` | Apply merges | N separate `mergeCells()` API calls |

**Unavoidable ceiling:** Passes 1 and 3 both fully parse the file — exceljs for styles/hyperlinks/freeze/dropdowns, luckyexcel for the Fortune JSON format. This double-parse is the largest cost and can't be removed without replacing one of the libraries.

**Everything below is within JS land and fixable.**

---

## Issues Found

### Issue 1 — `getSheetValues()` scans all cells for dropdowns (Pass 2)

```ts
// Current: iterates the entire sheet grid even if no dropdowns exist
worksheet?.getSheetValues()?.reduce(...)
```

ExcelJS stores data validations as a flat collection on `worksheet.dataValidations.model` — a plain object keyed by cell address (e.g., `{ "A1": { type: "list", formulae: [...] } }`). No cell scan needed.

**Fix:** Replace `getSheetValues().reduce()` with direct access to `worksheet.dataValidations.model`.

```ts
const dvModel = worksheet?.dataValidations?.model ?? {};
dropdownInfo = Object.keys(dvModel).length > 0 ? dvModel : null;
```

> The downstream `for (const key of Object.keys(dropdownInfo))` loop is unchanged — `dataValidations.model` is the same shape the existing dropdown-building code already expects.

---

### Issue 2 — `Object.keys(cellStyle).length > 0` allocates an array per cell (Pass 1)

```ts
// Current: creates a temporary keys array for every cell in every sheet
if (Object.keys(cellStyle).length > 0) {
  styles[key] = cellStyle;
}
```

**Fix:** Track non-emptiness with a boolean flag set inside the style-extraction block. Zero allocations.

```ts
let hasStyle = false;
const cellStyle: Record<string, string | number> = {};
// set hasStyle = true wherever a style property is written
if (hasStyle) { styles[key] = cellStyle; }
```

---

### Issue 3 — Extra `combinedSheets.map` just for `order` (Pass 5)

```ts
// Current: separate O(sheets) loop after sheets.map
combinedSheets = combinedSheets.map((sheet, index) => {
  sheet.order = index;
  return sheet;
});
```

**Fix:** Assign `order` inside the existing `sheets.map` loop using the known offset, then delete this pass.

```ts
// Inside sheets.map — before the sheets.map, compute once:
const orderOffset = importType === 'merge-current-dsheet' ? localSheetsArray.length : 0;
// Inside sheets.map:
sheet.order = orderOffset + sheetIndex;
```

---

### Issue 4 — Spread operator creates a new object per date cell (Pass 4)

```ts
// Current: allocates a new object for every date cell
cell.v.ct = { ...cell.v.ct, t: 'd' };
```

These cell objects come from luckyexcel and are about to be stored in YJS — direct mutation is safe.

**Fix:**

```ts
(cell.v.ct as any).t = 'd';
```

---

## What's Already Good (don't change)

- `isDateCache` is outside the `sheets.map` → shared across all sheets in one import run ✓
- Single cell loop in Pass 4 handles styles + hyperlinks + dates together ✓
- `hlKeys`/`styleKeys` lookups are O(1) hash map reads ✓
- `ydoc.transact()` batches all YJS mutations into one operation ✓

---

## File to Modify

`package/hooks/use-xlsx-import.tsx`

---

## Verification

1. Import a multi-sheet `.xlsx` with dates, hyperlinks, frozen panes, and dropdowns
2. Confirm all features still work: dates display correctly, links are blue/underlined, panes freeze, dropdowns appear
3. For perf: import a file with 50k+ cells — observe no regression in load time (ideally faster due to skipping the `getSheetValues` full-scan)
