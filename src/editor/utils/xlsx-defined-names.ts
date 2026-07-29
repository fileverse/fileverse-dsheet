import type { DefinedName } from '../../sheet-engine/core/types';
import { indexToColumnChar } from '../../sheet-engine/core/utils';
import JSZip from 'jszip';

export type ExcelDefinedNameEntry = {
  name: string;
  ranges: string[];
  localSheetId?: number;
};

export function isExcelSystemDefinedName(name: string): boolean {
  return name.startsWith('_xlnm.');
}

function quoteSheetNameForExcel(sheetName: string): string {
  if (/[^A-Za-z0-9_]/.test(sheetName)) {
    return `'${sheetName.replace(/'/g, "''")}'`;
  }
  return sheetName;
}

function colRowToAbsoluteA1(row: number, col: number): string {
  return `$${indexToColumnChar(col)}$${row + 1}`;
}

/** Build Excel loc string: `Sheet1!$A$1:$C$2` (or single cell). */
export function encodeDefinedNameExcelRef(
  sheetName: string,
  range: DefinedName['range'],
): string {
  const prefix = quoteSheetNameForExcel(sheetName);
  const a1 = colRowToAbsoluteA1(range.row[0], range.column[0]);
  const a2 = colRowToAbsoluteA1(range.row[1], range.column[1]);
  const body = a1 === a2 ? a1 : `${a1}:${a2}`;
  return `${prefix}!${body}`;
}

/**
 * Parse `Sheet1!$A$1:$B$2` / `'My Sheet'!$A$1` into sheet name + 0-based range.
 */
export function parseExcelDefinedNameRef(ref: string): {
  sheetName: string;
  range: { row: [number, number]; column: [number, number] };
} | null {
  const trimmed = String(ref || '').trim();
  if (!trimmed) return null;

  let sheetName = '';
  let address = trimmed;

  const bang = trimmed.lastIndexOf('!');
  if (bang >= 0) {
    let rawSheet = trimmed.slice(0, bang);
    address = trimmed.slice(bang + 1);
    if (rawSheet.startsWith("'") && rawSheet.endsWith("'")) {
      rawSheet = rawSheet.slice(1, -1).replace(/''/g, "'");
    }
    sheetName = rawSheet;
  }

  const parts = address.split(':');
  const parseAddr = (a: string) => {
    const m = a.trim().replace(/\$/g, '').match(/^([A-Za-z]+)(\d+)$/);
    if (!m) return null;
    const letters = m[1].toUpperCase();
    let col1 = 0;
    for (let i = 0; i < letters.length; i += 1) {
      col1 = col1 * 26 + (letters.charCodeAt(i) - 64);
    }
    return { row: parseInt(m[2], 10) - 1, col: col1 - 1 };
  };

  const start = parseAddr(parts[0]);
  if (!start) return null;
  const end = parts.length > 1 ? parseAddr(parts[1]) : start;
  if (!end) return null;

  return {
    sheetName,
    range: {
      row: [Math.min(start.row, end.row), Math.max(start.row, end.row)],
      column: [Math.min(start.col, end.col), Math.max(start.col, end.col)],
    },
  };
}

function newDefinedNameId(): string {
  return `dn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Convert Excel defined-name entries into our DefinedName list.
 * `sheets` must already have stable ids and names (Excel order).
 */
export function excelEntriesToDefinedNames(
  entries: ExcelDefinedNameEntry[],
  sheets: Array<{ id?: string; name?: string }>,
): DefinedName[] {
  const byName = new Map(
    sheets
      .filter((s) => s.id && s.name)
      .map((s) => [String(s.name), s.id as string]),
  );
  const out: DefinedName[] = [];
  const seenNames = new Set<string>();

  for (const entry of entries) {
    if (!entry?.name || isExcelSystemDefinedName(entry.name)) continue;
    if (seenNames.has(entry.name.toLowerCase())) continue;

    const firstRef = entry.ranges?.[0];
    if (!firstRef) continue;
    const parsed = parseExcelDefinedNameRef(firstRef);
    if (!parsed) continue;

    let sheetId =
      (parsed.sheetName && byName.get(parsed.sheetName)) || undefined;
    if (
      !sheetId &&
      entry.localSheetId != null &&
      sheets[entry.localSheetId]?.id
    ) {
      sheetId = sheets[entry.localSheetId].id;
    }
    if (!sheetId && sheets[0]?.id) {
      sheetId = sheets[0].id;
    }
    if (!sheetId) continue;

    const scope =
      entry.localSheetId != null && sheets[entry.localSheetId]?.id
        ? 'sheet'
        : 'workbook';

    out.push({
      id: newDefinedNameId(),
      name: entry.name,
      sheetId,
      range: parsed.range,
      scope,
      localSheetId:
        scope === 'sheet' ? sheets[entry.localSheetId!]?.id : undefined,
    });
    seenNames.add(entry.name.toLowerCase());
  }

  return out;
}

/** Write defined names onto an ExcelJS workbook (Pass 2). */
export function applyDefinedNamesToExcelWorkbook(
  excelWorkbook: {
    definedNames: { add: (loc: string, name: string) => void };
  },
  definedNames: DefinedName[] | undefined,
  sheets: Array<{ id?: string; name?: string }>,
): void {
  if (!definedNames?.length) return;

  const idToName = new Map(
    sheets
      .filter((s) => s.id && s.name)
      .map((s) => [s.id as string, s.name as string]),
  );

  for (const dn of definedNames) {
    if (!dn?.name || isExcelSystemDefinedName(dn.name)) continue;
    const sheetName = idToName.get(dn.sheetId);
    if (!sheetName) continue;
    try {
      excelWorkbook.definedNames.add(
        encodeDefinedNameExcelRef(sheetName, dn.range),
        dn.name,
      );
    } catch {
      // Skip invalid / duplicate Excel names.
    }
  }
}

/**
 * Parse `<definedNames>` from xl/workbook.xml (keeps localSheetId).
 */
export async function parseDefinedNamesFromXlsxBuffer(
  arrayBuffer: ArrayBuffer,
): Promise<ExcelDefinedNameEntry[]> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const file =
      zip.file('xl/workbook.xml') ||
      zip.file(/xl\/workbook\.xml$/i)?.[0] ||
      null;
    if (!file) return [];
    const xml = await file.async('text');
    const entries: ExcelDefinedNameEntry[] = [];
    const tagRe =
      /<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/gi;
    let match: RegExpExecArray | null = tagRe.exec(xml);
    while (match) {
      const attrs = match[1] || '';
      const body = (match[2] || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim();
      const nameMatch = attrs.match(/\bname="([^"]+)"/i);
      const localMatch = attrs.match(/\blocalSheetId="(\d+)"/i);
      const name = nameMatch?.[1];
      if (name && body) {
        entries.push({
          name,
          ranges: [body],
          localSheetId: localMatch
            ? parseInt(localMatch[1], 10)
            : undefined,
        });
      }
      match = tagRe.exec(xml);
    }
    return entries;
  } catch {
    return [];
  }
}
