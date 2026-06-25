/**
 * Manual verification script for TEC-2311 shortcuts against local demo.
 * Run: node demo/scripts/test-shortcuts-v2.mjs
 * Requires demo at http://localhost:5000/
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5000/';
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const icon = pass ? '✓' : '✗';
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function focusGrid(page) {
  await page.locator('#luckysheet-sheettable_0').click({ force: true, timeout: 10000 });
  await page.waitForTimeout(200);
}

async function goA1(page) {
  await focusGrid(page);
  await page.keyboard.press(`${MOD}+Home`);
  await page.waitForTimeout(150);
}

async function getCellDisplay(page, r, c) {
  return page.evaluate(
    ({ r, c }) => {
      const ref = window.__dsheetRef?.current;
      if (!ref) return { error: 'no ref' };
      const m = ref.getCellValue(r, c, { type: 'm' });
      const v = ref.getCellValue(r, c, { type: 'v' });
      const ct = ref.getSheet?.()?.data?.[r]?.[c]?.ct;
      return { m, v, ct };
    },
    { r, c },
  );
}

async function getSelection(page) {
  return page.evaluate(() => {
    const ref = window.__dsheetRef?.current;
    const sel = ref?.getSelection()?.[0];
    return sel
      ? {
          row: sel.row,
          column: sel.column,
          row_focus: sel.row_focus,
          column_focus: sel.column_focus,
        }
      : null;
  });
}

async function getRowHidden(page) {
  return page.evaluate(() => {
    const ref = window.__dsheetRef?.current;
    const sheet = ref?.getSheet?.();
    return sheet?.config?.rowhidden_manual ?? sheet?.config?.rowhidden ?? {};
  });
}

async function getSheetId(page) {
  return page.evaluate(() => window.__dsheetRef?.current?.getSheet?.()?.id);
}

async function typeInCell(page, text) {
  await page.keyboard.type(text);
  await page.waitForTimeout(100);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#luckysheet-sheettable_0', { timeout: 30000 });
    await page.waitForTimeout(2000);

    const hasRef = await page.evaluate(() => !!window.__dsheetRef?.current);
    record('Demo workbook ref exposed', hasRef);
    if (!hasRef) throw new Error('Missing __dsheetRef');

    // 1. Number format Ctrl+Shift+1
    await goA1(page);
    await page.keyboard.type('1234.5');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await goA1(page);
    await page.keyboard.press(`${MOD}+Shift+1`);
    await page.waitForTimeout(300);
    const numFmt = await getCellDisplay(page, 0, 0);
    record(
      'Format as number (Ctrl+Shift+1)',
      String(numFmt.m ?? '').includes('1,234.50') || String(numFmt.m ?? '').includes('1234.50'),
      `display=${numFmt.m}, fa=${numFmt.ct?.fa}`,
    );

    // 2. Currency Ctrl+Shift+4
    await goA1(page);
    await page.keyboard.press(`${MOD}+Shift+4`);
    await page.waitForTimeout(300);
    const curFmt = await getCellDisplay(page, 0, 0);
    record(
      'Format as currency (Ctrl+Shift+4)',
      String(curFmt.m ?? '').includes('1,234') || String(curFmt.m ?? '').includes('¥'),
      `display=${curFmt.m}`,
    );

    // 3. Percentage Ctrl+Shift+5 — use 0.25 in A2
    await goA1(page);
    await page.keyboard.press('ArrowDown');
    await typeInCell(page, '0.25');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await goA1(page);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    await page.keyboard.press(`${MOD}+Shift+5`);
    await page.waitForTimeout(300);
    const pctFmt = await getCellDisplay(page, 1, 0);
    record(
      'Format as percentage (Ctrl+Shift+5)',
      String(pctFmt.m ?? '').includes('%'),
      `display=${pctFmt.m}`,
    );

    // 4. Strikethrough Alt+Shift+5
    await goA1(page);
    await page.keyboard.type('done');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await goA1(page);
    await page.keyboard.press('Alt+Shift+5');
    await page.waitForTimeout(300);
    const strike = await page.evaluate(() => {
      const ref = window.__dsheetRef?.current;
      return ref?.getCellValue(0, 0, { type: 'cl' }) === 1;
    });
    record('Strikethrough (Alt+Shift+5)', strike === true, `cl=${strike}`);

    // 5. Fill range Ctrl+Enter — column D rows 1-3
    await goA1(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(150);
    await typeInCell(page, 'Q1');
    await page.keyboard.press(`${MOD}+Enter`);
    await page.waitForTimeout(400);
    const d2fill = await getCellDisplay(page, 1, 3);
    const d3fill = await getCellDisplay(page, 2, 3);
    record(
      'Fill range (Ctrl+Enter)',
      String(d2fill.m ?? d2fill.v ?? '') === 'Q1' &&
        String(d3fill.m ?? d3fill.v ?? '') === 'Q1',
      `D2=${d2fill.m ?? d2fill.v}, D3=${d3fill.m ?? d3fill.v}`,
    );

    // 6. Home / End
    await focusGrid(page);
    await page.keyboard.press('End');
    await page.waitForTimeout(200);
    const afterEnd = await getSelection(page);
    record(
      'End key (row end)',
      (afterEnd?.column?.[0] ?? 0) >= 0,
      `column=${JSON.stringify(afterEnd?.column)}`,
    );
    await page.keyboard.press('Home');
    await page.waitForTimeout(200);
    const afterHome = await getSelection(page);
    record(
      'Home key (row start)',
      afterHome?.column?.[0] === 0,
      `column=${JSON.stringify(afterHome?.column)}`,
    );

    // 7. Hide row Ctrl+Alt+9 — select row 3 (index 2)
    await goA1(page);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    await page.keyboard.press(`${MOD}+Alt+9`);
    await page.waitForTimeout(400);
    const hidden = await getRowHidden(page);
    record(
      'Hide row (Ctrl+Alt+9)',
      Object.keys(hidden).includes('2'),
      `rowhidden keys=${Object.keys(hidden).join(',')}`,
    );

    // 9. Unhide row Ctrl+Shift+9
    await page.keyboard.press(`${MOD}+Shift+9`);
    await page.waitForTimeout(400);
    const hiddenAfter = await getRowHidden(page);
    record(
      'Unhide row (Ctrl+Shift+9)',
      !Object.keys(hiddenAfter).includes('2'),
      `rowhidden keys=${Object.keys(hiddenAfter).join(',')}`,
    );

    // 10. Sheet navigation
    await page.evaluate(() => window.__dsheetRef?.current?.addSheet?.());
    await page.waitForTimeout(600);
    const sheets = await page.evaluate(
      () => window.__dsheetRef?.current?.getAllSheets?.()?.map((s) => s.id) ?? [],
    );
    if (sheets.length >= 2) {
      await page.evaluate((id) => {
        window.__dsheetRef?.current?.activateSheet?.({ id });
      }, sheets[0]);
      await page.waitForTimeout(400);
      await focusGrid(page);
      const sheet1 = sheets[0];
      await page.keyboard.press('Alt+ArrowDown');
      await page.waitForTimeout(600);
      const sheet2 = await getSheetId(page);
      record(
        'Next sheet (Alt+Down)',
        sheet2 != null && sheet2 !== sheet1,
        `${sheet1?.slice(0, 8)} → ${sheet2?.slice(0, 8)}`,
      );
      await page.keyboard.press('Alt+ArrowUp');
      await page.waitForTimeout(600);
      const sheetBack = await getSheetId(page);
      record(
        'Previous sheet (Alt+Up)',
        sheetBack === sheet1,
        `${sheet2?.slice(0, 8)} → ${sheetBack?.slice(0, 8)}`,
      );
    } else {
      record('Next sheet (Alt+Down)', false, 'need 2+ sheets');
      record('Previous sheet (Alt+Up)', false, 'skipped');
    }

    // 11. In-cell line break Alt+Enter
    await goA1(page);
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    await page.keyboard.type('Hello');
    await page.keyboard.press('Alt+Enter');
    await page.keyboard.type('World');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const multiline = await page.evaluate(() => {
      const ref = window.__dsheetRef?.current;
      const sheet = ref?.getSheet?.();
      const cell = sheet?.data?.[4]?.[4];
      if (!cell) return '';
      if (cell.m) return String(cell.m);
      if (cell.ct?.s) return cell.ct.s.map((s) => s.v ?? '').join('\n');
      return String(cell.v ?? '');
    });
    record(
      'In-cell line break (Alt+Enter)',
      multiline.includes('Hello') && multiline.includes('World'),
      `text=${multiline.slice(0, 40)}`,
    );
  } catch (err) {
    console.error('Test run failed:', err);
    record('Test harness', false, String(err));
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${passed}/${results.length} passed`);
  if (failed.length) {
    console.log('Failed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main();
