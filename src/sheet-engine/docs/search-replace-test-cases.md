# Search/Replace — Manual Test Cases

Paired **Before** (current behaviour) / **After** (expected behaviour post-fix) test cases for each fix in the feasibility audit. Run these against the running dSheet dev server (`npm run dev`).

Shared setup unless a case says otherwise:
- Open a blank sheet.
- Open Find & Replace with **Ctrl+F** (search only) or **Ctrl+H** (search + replace).

---

## Fix 1 — Hoist RegExp / avoid `lastIndex` skips

### TC-1.1 — Regex match on every matching cell

| | Steps |
|-|-------|
| **Setup** | Fill A1=`cat`, B1=`cat`, C1=`cat` (same row). |
| **Action** | Open search. Enable **Regex** mode. Type `cat`. Click **Find All**. |
| **Before (broken)** | Some cells are missed because a shared `/g` regex carries a non-zero `lastIndex` into the next `.test()` call. Not all three cells appear in results. |
| **After (fixed)** | All three cells — A1, B1, C1 — appear in the results list. |

### TC-1.2 — Regex wraps around end of sheet correctly

| | Steps |
|-|-------|
| **Setup** | Fill A1=`foo`, Z100=`foo`. Select A1. |
| **Action** | Regex mode on. Search `foo`. Click **Find Next** repeatedly until wrap-around. |
| **Before** | Wrap might skip Z100 and jump back to A1 without visiting Z100, depending on `lastIndex` carry-over. |
| **After** | Every `foo` cell is visited in order; wrap lands back on A1. |

---

## Fix 2 — Early-exit on sparse / missing rows

### TC-2.1 — Searching a sheet with entirely empty rows

| | Steps |
|-|-------|
| **Setup** | Fill A1=`hello`. Leave rows 2–10 completely empty. Fill A11=`hello`. |
| **Action** | Search `hello`. Click **Find All**. |
| **Before (broken)** | Runtime exception (`Cannot read properties of undefined reading '0'`) thrown when the loop hits an undefined row array. Console shows error; results panel may be empty or frozen. |
| **After (fixed)** | Results show A1 and A11 without any error. |

### TC-2.2 — Sheet with mixed null rows and populated rows

| | Steps |
|-|-------|
| **Setup** | Paste data into rows 1, 5, 10 only (rows 2–4, 6–9 are empty). Search for a word present in rows 1, 5, 10. |
| **Before** | May throw or silently return incomplete results. |
| **After** | All three rows' matches are returned. |

---

## Fix 3 — Cache search results across `searchNext`

### TC-3.1 — **Find Next** traversal speed on large sheet

| | Steps |
|-|-------|
| **Setup** | Paste a ~10 000-row sheet where every 10th cell contains `alpha`. |
| **Action** | Type `alpha`. Click **Find Next** 20 times in quick succession and observe UI responsiveness. |
| **Before** | Each click re-scans the full sheet; noticeable jank / lag between clicks. |
| **After** | First click scans and caches; subsequent clicks feel instant. |

### TC-3.2 — Cache invalidates when cell is edited

| | Steps |
|-|-------|
| **Setup** | A1=`apple`, A2=`apple`. Open search, type `apple` — two results cached. |
| **Action** | Close search. Edit A1 → `banana`. Re-open search, type `apple`. |
| **Before** | May still show A1 in the cached results (stale). |
| **After** | Only A2 appears; cache was invalidated on the cell edit. |

### TC-3.3 — Cache invalidates on sheet switch

| | Steps |
|-|-------|
| **Setup** | Sheet1: A1=`test`. Sheet2: no `test`. Open search, type `test` on Sheet1. |
| **Action** | Switch to Sheet2. Type `test` in search. |
| **Before** | May use Sheet1's cached result and highlight wrong sheet. |
| **After** | Search re-runs on Sheet2's data; shows no results. |

---

## Fix 5 — Virtualize results table

### TC-5.1 — Scroll performance with 500+ results

| | Steps |
|-|-------|
| **Setup** | Fill column A, rows 1–600, all with `match`. Search `match` → Find All. |
| **Before** | The results panel renders all 600 DOM rows at once; scrolling is sluggish or causes layout thrashing. |
| **After** | Only the visible rows are in the DOM; scrolling is smooth. |

### TC-5.2 — Clicking a result still navigates to the correct cell

| | Steps |
|-|-------|
| **Setup** | Same 600-row dataset. Scroll results to the very bottom (row 600 entry). Click the last result. |
| **Before** | May not work if virtualization clips event targets. |
| **After** | Sheet scrolls and selects the corresponding cell correctly. |

---

## Fix 6 — Search formula text (`cell.f`)

### TC-6.1 — Find a formula by its expression

| | Steps |
|-|-------|
| **Setup** | A1=`=SUM(B1:B10)`. B1=`=A1*2`. |
| **Action** | Enable **Search in formulas** toggle (added by Fix 6). Search `SUM`. |
| **Before** | Neither A1 nor B1 appears — only display values are searched. |
| **After** | A1 is returned because its formula contains `SUM`. |

### TC-6.2 — Normal (non-formula) search still works alongside formula search

| | Steps |
|-|-------|
| **Setup** | A1=`hello` (plain text), B1=`=UPPER("hello")` (formula). |
| **Action** | Search `hello` with formula search **off**. |
| **Before / After (regression check)** | Only A1 is returned in both modes; B1's formula text is not accidentally surfaced when the toggle is off. |

---

## Fix 7 — Improve `getRegExpStr` escaping

### TC-7.1 — Literal `^` in search string (non-regex mode)

| | Steps |
|-|-------|
| **Setup** | A1=`^foo`, A2=`foo`. |
| **Action** | Regex mode **off**. Search `^foo`. |
| **Before** | `^` is not escaped; it leaks into the generated regex and matches `foo` at start-of-string — A2 matches unexpectedly. |
| **After** | Only A1 (literally containing `^foo`) is returned. |

### TC-7.2 — Literal `$` in search string

| | Steps |
|-|-------|
| **Setup** | A1=`price$`, A2=`price`. |
| **Action** | Regex mode **off**. Search `price$`. |
| **Before** | `$` is not escaped; `price$` matches the end-of-string anchor — A2 matches. |
| **After** | Only A1 is returned. |

### TC-7.3 — Literal parentheses in search string

| | Steps |
|-|-------|
| **Setup** | A1=`(note)`, A2=`note`. |
| **Action** | Regex mode **off**. Search `(note)`. |
| **Before** | Unescaped `(` `)` form a capture group; `(note)` regex still matches `note` → A2 is incorrectly included. |
| **After** | Only A1 (containing literal `(note)`) is returned. |

### TC-7.4 — Wildcard `*` still works as expected after escaping fix

| | Steps |
|-|-------|
| **Setup** | A1=`foobar`, A2=`foo`. |
| **Action** | Regex mode **off**. Search `foo*` (wildcard — should match anything starting with `foo`). |
| **Before / After (regression check)** | Both A1 and A2 should match. Escaping fix must not break intentional `*`→`.*` wildcard. |

---

## Fix 8 — Search across all sheets

### TC-8.1 — Find results from non-active sheets

| | Steps |
|-|-------|
| **Setup** | Sheet1: A1=`project`. Sheet2: B3=`project`. Active sheet: Sheet1. |
| **Action** | Enable **All Sheets** toggle (added by Fix 8). Search `project`. Click **Find All**. |
| **Before** | Only Sheet1 A1 appears. |
| **After** | Both Sheet1!A1 and Sheet2!B3 appear, each labelled with their sheet name. |

### TC-8.2 — Clicking a cross-sheet result navigates correctly

| | Steps |
|-|-------|
| **Setup** | Same as TC-8.1. |
| **Action** | Click the Sheet2 result in the results list. |
| **Before** | No cross-sheet results exist to click. |
| **After** | dSheet switches to Sheet2 and highlights B3. |

---

## Fix 9 — Locale-aware case folding

### TC-9.1 — Turkish dotless-i case-insensitive search

| | Steps |
|-|-------|
| **Setup** | Set locale to Turkish (`tr`). A1=`İstanbul`. |
| **Action** | Case-insensitive search `istanbul`. |
| **Before** | `toLowerCase()` turns `İ` into `i̇` (two code points) — match fails. |
| **After** | `toLocaleLowerCase('tr')` handles dotted/dotless-i — A1 is found. |

---

## Fix 10 — Incremental as-you-type search

### TC-10.1 — Results update while typing

| | Steps |
|-|-------|
| **Setup** | Sheet with 100 rows of varied text. |
| **Action** | Open search. Type `he`, then `hel`, then `hell`, then `hello` slowly. |
| **Before** | Results only update when **Find All** is clicked manually. |
| **After** | After each keystroke (with debounce) results automatically update. |

### TC-10.2 — No UI jank on large sheet during as-you-type

| | Steps |
|-|-------|
| **Setup** | 10 000-row sheet. Type a common word. |
| **Before** | Each keystroke triggers a full synchronous scan — input lags. |
| **After** | Debounce + async chunking keeps input responsive; loading indicator shows while scanning. |

---

## Fix 11 — Warning on skipped formula cells

### TC-11.1 — `Replace` on a formula cell shows a warning

| | Steps |
|-|-------|
| **Setup** | A1=`=SUM(1,2)` (formula). Search `3` (the displayed value). Click **Replace**. |
| **Before** | Replace silently does nothing and returns `null`; no feedback to user. |
| **After** | A toast/warning appears: "N cell(s) skipped because they contain formulas." |

### TC-11.2 — `Replace All` reports skipped formula count

| | Steps |
|-|-------|
| **Setup** | A1=`hello` (text), A2=`=UPPER("hello")` (formula, displays `HELLO`). Search `hello` (case-insensitive). Click **Replace All** with replacement `world`. |
| **Before** | Success message says "1 replacement" but gives no indication that A2 was skipped. |
| **After** | Message says "1 replacement made, 1 cell skipped (formula)." |

---

## Fix 12 — Undo support for replace

### TC-12.1 — `Replace` is undone with Ctrl+Z

| | Steps |
|-|-------|
| **Setup** | A1=`apple`. Search `apple`, replace with `orange`. |
| **Action** | Press **Ctrl+Z**. |
| **Before** | Undo may not revert the replacement (patches not captured). Verify current state. |
| **After** | A1 returns to `apple`. |

### TC-12.2 — `Replace All` counts as one undo step

| | Steps |
|-|-------|
| **Setup** | A1=`cat`, B1=`cat`, C1=`cat`. Replace All `cat`→`dog`. |
| **Action** | Press **Ctrl+Z** once. |
| **Before** | Might require three undos (one per cell) or not undo at all. |
| **After** | Single Ctrl+Z reverts all three cells simultaneously. |

---

## Fix 13 — Merged cell handling

### TC-13.1 — Search finds text in a merged cell

| | Steps |
|-|-------|
| **Setup** | Merge A1:C1. Type `merged text` into the merged cell. |
| **Action** | Search `merged text`. Click **Find All**. |
| **Before** | May not find the cell, or may find it multiple times (once per slave cell). |
| **After** | Exactly one result is returned pointing to the master cell (A1). |

### TC-13.2 — Replace does not corrupt a merged cell

| | Steps |
|-|-------|
| **Setup** | Merge A1:C1. Type `hello`. Search `hello`, replace with `world`. |
| **Before** | `setCellValue` on a slave cell may break the merge. |
| **After** | Replacement is applied to the master cell only; merge structure is intact. |

---

## Fix 14 — Capture groups in regex replace

### TC-14.1 — `$1` capture group substitution

| | Steps |
|-|-------|
| **Setup** | A1=`John Smith`. Enable **Regex** mode. |
| **Action** | Search `(\w+) (\w+)`. Replace with `$2, $1`. |
| **Before** | `$1`/`$2` already work via `String.prototype.replace` — verify this passes without any code change. |
| **After** | A1 becomes `Smith, John`. |

### TC-14.2 — `$1` with wildcard mode off (non-regex)

| | Steps |
|-|-------|
| **Setup** | A1=`$1 discount`. Regex mode **off**. Search `$1`. |
| **Before** | `$` not escaped in `getRegExpStr`; `$1` acts as a back-reference in the replace string accidentally. |
| **After** | Literal `$1` is matched; no unintended back-reference substitution occurs. |

---

## Fix 15 — Confirmation for large Replace All

### TC-15.1 — Confirmation dialog appears above threshold

| | Steps |
|-|-------|
| **Setup** | Fill A1:A200 with `foo`. Search `foo`. Click **Replace All** with `bar`. |
| **Before** | All 200 cells are replaced immediately with no prompt. |
| **After** | A confirmation dialog shows: "This will replace 200 occurrences. Continue?" Clicking **Yes** proceeds; **No** cancels. |

### TC-15.2 — No confirmation below threshold

| | Steps |
|-|-------|
| **Setup** | A1=`foo`, A2=`foo`. Click **Replace All**. |
| **Before / After (regression check)** | No dialog; replacement proceeds immediately (count is below the threshold). |

---

## Regression checklist (run after every fix)

After implementing any fix, run these smoke tests to confirm no regressions:

| # | Test | Expected |
|---|------|----------|
| R1 | Plain text search, case-insensitive | Finds matches ignoring case |
| R2 | Plain text search, case-sensitive | Only exact-case matches |
| R3 | Whole-word match | `cat` does **not** match `catch` |
| R4 | Single **Replace** cycles to next match | After replacing, cursor advances |
| R5 | **Replace All** returns correct count | Count matches number of cells changed |
| R6 | Empty search string | Shows "Enter a search term" tip, no crash |
| R7 | Search on empty sheet | Shows "No results", no crash |
| R8 | Ctrl+Z after Replace All | All changes reverted in one undo step |
| R9 | Dialog drag | Search dialog is draggable and stays on screen |
| R10 | Keyboard navigation | Enter = Find Next; Shift+Enter = Find Previous (if supported) |
