/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import SSF from 'ssf';
import { Workbook } from 'exceljs';
import * as Y from 'yjs';
import { Sheet, WorkbookInstance } from '@sheet-engine/react';
import { migrateSheetFactoryForImport } from '../utils/migrate-new-yjs';
import { ySheetArrayToPlain } from '../utils/update-ydoc';

// @ts-expect-error, type is not available from package
import { transformExcelToLucky } from 'luckyexcel';
import {
  extractImagesFromWorksheet,
  convertRawImagesToFortuneSheet,
  RawSheetImage,
} from '../utils/xlsx-image-utils';
import { removeFileExtension } from '../utils/export-filename';
import { normalizeImportedHyperlinkCellV } from '../utils/xlsx-hyperlink-inline';
import { toast } from '@fileverse/ui';

/** Predefined option colors for data validation dropdowns (when XLSX has no color). */
const DATA_VERIFICATION_OPTION_COLORS = [
  '228, 232, 237', // Light Gray
  '219, 233, 236', // White
  '244, 217, 227', // Pink
  '247, 229, 207', // Peach
  '217, 234, 244', // Blue
  '222, 239, 222', // Green
  '239, 239, 239', // Light Green
  '244, 230, 230', // Rose
  '247, 239, 217', // Yellow
  '230, 230, 244', // Purple
  '217, 244, 244', // Cyan
  '244, 239, 234', // Cream
];
const DEFAULT_OPTION_COLOR = DATA_VERIFICATION_OPTION_COLORS[0]; // Light Gray

const CHECKBOX_PAIRS: [string, string][] = [
  ['true', 'false'],
  ['yes', 'no'],
  ['1', '0'],
];

function isCheckboxPair(a: string, b: string): boolean {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  return CHECKBOX_PAIRS.some(([x, y]) => la === x && lb === y);
}

const POST_IMPORT_RECALC_MAX_FRAMES = 200;

function richTextRunsToPlainText(ctS: unknown): string | null {
  if (!Array.isArray(ctS) || ctS.length === 0) return null;
  const text = ctS.map((seg) => String((seg as any)?.v ?? '')).join('');
  const trimmed = text.trim();
  return trimmed ? text : null;
}

function excelishBooleanText(v: boolean): 'TRUE' | 'FALSE' {
  return v ? 'TRUE' : 'FALSE';
}

/**
 * XLSX stores cached formula results only; we normalize cells and then must run the in-app engine.
 */
function schedulePostImportFormulaRecalc(
  sheetEditorRef: React.RefObject<WorkbookInstance | null>,
): void {
  let didRun = false;
  let frames = 0;

  const tryRecalc = (): boolean => {
    if (didRun) return true;
    const wb = sheetEditorRef.current;
    if (!wb?.getWorkbookContext || !wb.recalculateAllFormulas) return false;
    const ctx = wb.getWorkbookContext();
    const files = ctx?.luckysheetfile;
    if (!files?.length) return false;
    const hasGrid = files.some(
      (s) => Array.isArray(s.data) && s.data.length > 0,
    );
    if (!hasGrid) return false;
    wb.recalculateAllFormulas();
    didRun = true;
    return true;
  };

  const tick = () => {
    if (tryRecalc()) return;
    frames += 1;
    if (frames < POST_IMPORT_RECALC_MAX_FRAMES) {
      requestAnimationFrame(tick);
    } else {
      // Final attempt even if readiness heuristic missed (e.g. unusual sheet dimensions)
      sheetEditorRef.current?.recalculateAllFormulas?.();
      didRun = true;
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(tick));

  // `loadLocale` in Workbook init is async — rAF may finish before grids exist.
  for (const ms of [120, 400, 1200]) {
    window.setTimeout(() => {
      if (!didRun) {
        tryRecalc();
      }
    }, ms);
  }
}

/** Build dataVerification color string from option count: use color list only when options ≤ 12; if more, use only grey (first) repeated. */
function buildDataVerificationColor(optionCount: number): string {
  if (optionCount <= 0) return DEFAULT_OPTION_COLOR;
  if (optionCount > DATA_VERIFICATION_OPTION_COLORS.length) {
    return Array(optionCount).fill(DEFAULT_OPTION_COLOR).join(', ');
  }
  return DATA_VERIFICATION_OPTION_COLORS.slice(0, optionCount).join(', ');
}

/** Parse Excel A1-style address to 0-based row and column. e.g. "A1" -> { row: 0, col: 0 }, "B10" -> { row: 9, col: 1 } */
function parseA1Address(address: string): { row: number; col: number } | null {
  const match = address.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const letters = match[1].toUpperCase();
  const digits = match[2];
  let col1Based = 0;
  for (let i = 0; i < letters.length; i++) {
    col1Based = col1Based * 26 + (letters.charCodeAt(i) - 64);
  }
  const row = parseInt(digits, 10) - 1;
  const col = col1Based - 1;
  return { row, col };
}

/** Map ExcelJS DataValidation to project dataVerification entry (row_column key format) */
function excelDataValidationToSheetEntry(
  address: string,
  dv: {
    type?: string;
    formulae?: any[];
    prompt?: string;
    showInputMessage?: boolean;
    allowBlank?: boolean;
  },
): { rowColKey: string; entry: Record<string, unknown> } | null {
  const parsed = parseA1Address(address);
  if (!parsed) return null;
  const { row, col } = parsed;
  const rowColKey = `${row}_${col}`;

  const rawFormula =
    Array.isArray(dv.formulae) && dv.formulae.length > 0
      ? String(dv.formulae[0])
        .replace(/^["']|["']$/g, '')
        .replace(/["']/g, '')
      : '';
  const parts = rawFormula
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  let type = dv.type === 'list' ? 'dropdown' : dv.type || 'dropdown';
  let value1 = rawFormula;
  let value2 = '';

  if (
    dv.type === 'list' &&
    parts.length === 2 &&
    isCheckboxPair(parts[0], parts[1])
  ) {
    type = 'checkbox';
    value1 = parts[0];
    value2 = parts[1];
  }

  // When no color is preset (e.g. from XLSX): one color per option; use predefined list up to 12, then Light Gray for the rest
  const optionCount =
    type === 'checkbox' ? 1 : value1 ? value1.split(',').length : 0;
  const color = buildDataVerificationColor(optionCount || 1);

  const entry: Record<string, unknown> = {
    type,
    type2: '',
    rangeTxt: address,
    value1,
    value2,
    validity: '',
    remote: false,
    prohibitInput: dv.type === 'list',
    hintShow: Boolean(dv.showInputMessage),
    hintValue: dv.prompt ?? '',
    color,
    checked: false,
  };
  return { rowColKey, entry };
}

/** Parse Excel range ref (e.g. "A1:A500" or "A1") to 0-based row/column ranges */
function parseRefToRange(
  ref: string,
): { row: [number, number]; column: [number, number] } | null {
  const parts = ref.split(':');
  const start = parseA1Address(parts[0].trim());
  if (!start) return null;
  const end = parts.length > 1 ? parseA1Address(parts[1].trim()) : start;
  if (!end) return null;
  return {
    row: [Math.min(start.row, end.row), Math.max(start.row, end.row)],
    column: [Math.min(start.col, end.col), Math.max(start.col, end.col)],
  };
}

/** Parse one or more Excel refs separated by space/comma into 0-based ranges. */
function parseRefToRanges(
  ref: string,
): { row: [number, number]; column: [number, number] }[] {
  return String(ref || '')
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((part) => parseRefToRange(part))
    .filter(
      (r): r is { row: [number, number]; column: [number, number] } => !!r,
    );
}

/** Build project cellrange from one or more refs (row/column 0-based). */
function buildCellrange(ref: string): unknown[] | null {
  const ranges = parseRefToRanges(ref);
  if (!ranges.length) return null;
  return ranges.map((range) => {
    const [r0, r1] = range.row;
    const [c0, c1] = range.column;
    return {
      left: 0,
      width: 104,
      top: 0,
      height: 23,
      left_move: 0,
      width_move: 104,
      top_move: 0,
      height_move: 11999,
      row: [r0, r1],
      column: [c0, c1],
      row_focus: r0,
      column_focus: c0,
      column_select: true,
    };
  });
}

/** Map ExcelJS dxf style to project format (textColor, cellColor, bold, italic, underline, strikethrough) */
function dxfStyleToFormat(style: {
  font?: {
    color?: { argb?: string };
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  } | null;
  fill?: {
    type?: string;
    pattern?: string;
    fgColor?: { argb?: string };
  } | null;
}): {
  textColor: string;
  cellColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
} {
  const defaultFormat = {
    textColor: '#000000',
    cellColor: '#ffffff',
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  };
  if (!style) return defaultFormat;
  const font = style.font;
  const fill = style.fill;
  let textColor = defaultFormat.textColor;
  let cellColor = defaultFormat.cellColor;
  if (font?.color?.argb) {
    const a = font.color.argb;
    textColor = '#' + (a.length >= 6 ? a.slice(-6) : a);
  }
  if (
    fill?.type === 'pattern' &&
    fill.pattern === 'solid' &&
    fill.fgColor?.argb
  ) {
    const a = fill.fgColor.argb;
    cellColor = '#' + (a.length >= 6 ? a.slice(-6) : a);
  }
  return {
    textColor,
    cellColor,
    bold: Boolean(font?.bold),
    italic: Boolean(font?.italic),
    underline: Boolean(font?.underline),
    strikethrough: false,
  };
}

/**
 * Extract the text argument from a SEARCH(...) formula (Google/Excel "text contains").
 * Handles Google's SEARCH(("ab"),(C1)) and standard SEARCH("ab",A1). One regex pass, no loops.
 */
function extractTextFromSearchFormula(formula: string | undefined): string {
  if (!formula || typeof formula !== 'string') return '';
  const s = formula
    .trim()
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/^=/, '');
  // SEARCH(("text"), or SEARCH("text", or SEARCH( ( "text" ) , – allow optional parens/spaces before first quote
  const m = s.match(/(?:^|[^A-Z])SEARCH\s*\([\s(]*"((?:[^"]|"")*)"/i);
  if (m) return (m[1] ?? '').replace(/""/g, '"');
  const m2 = s.match(/(?:^|[^A-Z])SEARCH\s*\([\s(]*'([^']*)'/i);
  if (m2) return m2[1] ?? '';
  return '';
}

/** Fallback: extract first quoted string from a formula (supports "" escaping). */
function extractFirstQuotedText(formula: string | undefined): string {
  if (!formula || typeof formula !== 'string') return '';
  const s = formula
    .trim()
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/^=/, '');
  const m = s.match(/"((?:[^"]|"")*)"/);
  if (m) return (m[1] ?? '').replace(/""/g, '"');
  const m2 = s.match(/'([^']*)'/);
  if (m2) return m2[1] ?? '';
  return '';
}

/**
 * Google Sheets often stores text CF as expression formulas.
 * Detect and map common text-oriented expressions to project condition names.
 */
function mapExpressionTextCf(
  formula: string | undefined,
): { conditionName: string; conditionValue: string[] } | null {
  if (!formula || typeof formula !== 'string') return null;
  const f = formula.trim().toUpperCase();
  const text = extractTextFromSearchFormula(formula) || extractFirstQuotedText(formula);
  if (!text) return null;

  // contains / not contains
  if (f.includes('SEARCH(')) {
    if (f.includes('ISERROR(SEARCH(') || f.includes('NOTNUMBER(SEARCH(')) {
      return { conditionName: 'textDoesNotContain', conditionValue: [text] };
    }
    return { conditionName: 'textContains', conditionValue: [text] };
  }
  // starts with
  if (f.includes('LEFT(')) {
    return { conditionName: 'textStartsWith', conditionValue: [text] };
  }
  // ends with
  if (f.includes('RIGHT(')) {
    return { conditionName: 'textEndsWith', conditionValue: [text] };
  }
  // exact text check
  if (f.includes('EXACT(') || f.includes('="')) {
    return { conditionName: 'textExactly', conditionValue: [text] };
  }
  return null;
}

/** Map ExcelJS cfRule type/operator to project conditionName; return null if unsupported */
function excelCfTypeToConditionName(
  type: string,
  operator?: string,
  opts?: {
    percent?: boolean;
    bottom?: boolean;
    rank?: number;
    aboveAverage?: boolean;
    text?: string;
    timePeriod?: string;
  },
): { conditionName: string; conditionValue: string[] } | null {
  const t = (type || '').toLowerCase();
  if (t === 'cellis') {
    const op = (operator || '').toLowerCase();
    if (op === 'greaterthan')
      return { conditionName: 'greaterThan', conditionValue: [] };
    if (op === 'greaterthanorequal')
      return { conditionName: 'greaterThanOrEqual', conditionValue: [] };
    if (op === 'lessthan')
      return { conditionName: 'lessThan', conditionValue: [] };
    if (op === 'lessthanorequal')
      return { conditionName: 'lessThanOrEqual', conditionValue: [] };
    if (op === 'equal') return { conditionName: 'equal', conditionValue: [] };
    if (op === 'notequal')
      return { conditionName: 'notEqual', conditionValue: [] };
    if (op === 'between')
      return { conditionName: 'between', conditionValue: [] };
    if (op === 'notbetween')
      return { conditionName: 'notBetween', conditionValue: [] };
    return null;
  }
  if (
    t === 'containstext' ||
    t === 'notcontainstext' ||
    t === 'beginswith' ||
    t === 'endswith' ||
    t === 'containsblanks' ||
    t === 'notcontainsblanks'
  ) {
    const op = (operator ?? '').toLowerCase();
    if (t === 'containsblanks' || op === 'containsblanks')
      return { conditionName: 'empty', conditionValue: [''] };
    if (t === 'notcontainsblanks' || op === 'notcontainsblanks')
      return { conditionName: 'notEmpty', conditionValue: [''] };
    if (t === 'notcontainstext' || op === 'notcontainstext' || op === 'notcontains')
      return { conditionName: 'textDoesNotContain', conditionValue: [] };
    if (t === 'beginswith' || op === 'beginswith')
      return { conditionName: 'textStartsWith', conditionValue: [] };
    if (t === 'endswith' || op === 'endswith')
      return { conditionName: 'textEndsWith', conditionValue: [] };
    if (op === 'equal') return { conditionName: 'textExactly', conditionValue: [] };
    const text = opts?.text ?? '';
    return {
      conditionName: 'textContains',
      conditionValue: text ? [text] : [],
    };
  }
  if (t === 'duplicatevalues')
    return { conditionName: 'duplicateValue', conditionValue: ['0'] };
  if (t === 'uniquevalues')
    return { conditionName: 'duplicateValue', conditionValue: ['1'] };
  if (t === 'top10') {
    const rank = opts?.rank ?? 10;
    if (opts?.percent && opts?.bottom)
      return { conditionName: 'last10_percent', conditionValue: [String(rank)] };
    if (opts?.percent)
      return { conditionName: 'top10_percent', conditionValue: [String(rank)] };
    if (opts?.bottom)
      return { conditionName: 'last10', conditionValue: [String(rank)] };
    return { conditionName: 'top10', conditionValue: [String(rank)] };
  }
  if (t === 'aboveaverage') {
    if (opts?.aboveAverage === false)
      return { conditionName: 'belowAverage', conditionValue: [] };
    return { conditionName: 'aboveAverage', conditionValue: [] };
  }
  if (t === 'timeperiod') {
    const tp = (opts?.timePeriod ?? '').toLowerCase();
    if (tp === 'today' || tp === 'tomorrow' || tp === 'yesterday') {
      return {
        conditionName: 'dateIs',
        conditionValue: [`preset:${tp}`, '', 'DD/MM/YYYY'],
      };
    }
    if (tp === 'last7days') {
      return {
        conditionName: 'dateIs',
        conditionValue: ['preset:pastWeek', '', 'DD/MM/YYYY'],
      };
    }
    if (tp === 'lastmonth') {
      return {
        conditionName: 'dateIs',
        conditionValue: ['preset:pastMonth', '', 'DD/MM/YYYY'],
      };
    }
    if (tp === 'lastyear') {
      return {
        conditionName: 'dateIs',
        conditionValue: ['preset:pastYear', '', 'DD/MM/YYYY'],
      };
    }
    return null;
  }
  return null;
}

/** One ExcelJS conditional format rule -> one luckysheet_conditionformat_save entry, or null if unsupported */
function excelCfRuleToLuckysheet(
  ref: string,
  rule: {
    type?: string;
    operator?: string;
    formulae?: string[];
    style?: Record<string, unknown>;
    text?: string;
    timePeriod?: string;
    percent?: boolean;
    bottom?: boolean;
    rank?: number;
    aboveAverage?: boolean;
  },
): Record<string, unknown> | null {
  if (!rule.type) return null;

  // Text CF: Google often puts text only in formulae and leaves `text` empty.
  let resolvedText = (rule.text ?? '').trim();
  const firstFormula =
    Array.isArray(rule.formulae) && rule.formulae[0]
      ? String(rule.formulae[0])
      : undefined;

  // Google may export text CF as expression formulas; detect these before enum mapping.
  const expressionMapped =
    (rule.type.toLowerCase() === 'expression' ||
      rule.type.toLowerCase() === 'customformula') &&
    mapExpressionTextCf(firstFormula);
  if (expressionMapped) {
    const cellrange = buildCellrange(ref);
    if (!cellrange) return null;
    const format = dxfStyleToFormat(rule.style as any);
    return {
      type: 'default',
      cellrange,
      format: {
        textColor: format.textColor,
        cellColor: format.cellColor,
        bold: format.bold,
        italic: format.italic,
        underline: format.underline,
        strikethrough: format.strikethrough,
      },
      conditionName: expressionMapped.conditionName,
      conditionRange: [],
      conditionValue: expressionMapped.conditionValue,
    };
  }

  if (
    (rule.type === 'containsText' ||
      rule.type === 'notContainsText' ||
      rule.type === 'beginsWith' ||
      rule.type === 'endsWith') &&
    !resolvedText
  ) {
    resolvedText = extractTextFromSearchFormula(firstFormula);
    if (!resolvedText) {
      resolvedText = extractFirstQuotedText(firstFormula);
    }
  }

  const mapped = excelCfTypeToConditionName(rule.type, rule.operator, {
    percent: rule.percent,
    bottom: rule.bottom,
    rank: rule.rank,
    aboveAverage: rule.aboveAverage,
    text: resolvedText || rule.text,
    timePeriod: rule.timePeriod,
  });
  if (!mapped) return null;

  let conditionValue: string[];
  if (
    rule.type === 'cellIs' &&
    Array.isArray(rule.formulae) &&
    rule.formulae.length > 0
  ) {
    conditionValue = rule.formulae.map((f) => String(f ?? ''));
  } else if (
    mapped.conditionName === 'empty' ||
    mapped.conditionName === 'notEmpty'
  ) {
    conditionValue = [''];
  } else if (
    rule.type === 'containsText' ||
    rule.type === 'notContainsText' ||
    rule.type === 'beginsWith' ||
    rule.type === 'endsWith'
  ) {
    conditionValue = resolvedText
      ? [resolvedText]
      : extractFirstQuotedText(firstFormula)
        ? [extractFirstQuotedText(firstFormula)]
        : [];
  } else {
    conditionValue = mapped.conditionValue.map((v) =>
      v == null ? '' : String(v),
    );
  }

  const cellrange = buildCellrange(ref);
  if (!cellrange) return null;

  const format = dxfStyleToFormat(rule.style as any);

  return {
    type: 'default',
    cellrange,
    format: {
      textColor: format.textColor,
      cellColor: format.cellColor,
      bold: format.bold,
      italic: format.italic,
      underline: format.underline,
      strikethrough: format.strikethrough,
    },
    conditionName: mapped.conditionName,
    conditionRange: [],
    conditionValue,
  };
}

export const useXLSXImport = ({
  sheetEditorRef,
  ydocRef,
  setForceSheetRender,
  dsheetId,
  currentDataRef,
  updateDocumentTitle,
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<object | null>;
  updateDocumentTitle?: (title: string) => void;
}) => {
  const [filterToastShown, setFilterToastShown] = useState(false);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement> | undefined,
    fileArg: File,
    importType?: 'new-dsheet' | 'merge-current-dsheet' | 'new-current-dsheet',
  ): Promise<void> => {
    const input = event?.target;
    if (!input?.files?.length && !fileArg) {
      return Promise.resolve();
    }
    const file = input?.files?.[0] || fileArg;
    /** dataVerification per sheet: sheetIndex -> { row_column: entry } */
    const dataVerificationBySheet: Record<
      number,
      Record<string, Record<string, unknown>>
    > = {};
    /** conditional formatting per sheet: sheetIndex -> luckysheet_conditionformat_save array */
    const conditionFormatBySheet: Record<number, Record<string, unknown>[]> =
      {};

    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = async (e) => {
        if (!e.target) {
          console.error('FileReader event target is null');
          reject(new Error('FileReader event target is null'));
          return;
        }
        const arrayBuffer = e.target.result;
        const workbook = new Workbook();
        try {
          //@ts-expect-error, later
          await workbook.xlsx.load(arrayBuffer);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const workbookDefaultFontSize: number | undefined = (workbook as any)
            .model?.styles?.fonts?.[0]?.size;
          // Extract hyperlinks, freeze info, cell formatting, and data validation from all worksheets
          const hyperlinksBySheet: Record<
            number,
            Record<string, { linkType: string; linkAddress: string }[]>
          > = {};
          const frozenBySheet: Record<
            number,
            {
              type:
              | 'row'
              | 'column'
              | 'both'
              | 'rangeRow'
              | 'rangeColumn'
              | 'rangeBoth';
              range: { row_focus: number; column_focus: number };
            }
          > = {};
          const cellStylesBySheet: Record<
            number,
            Record<
              string,
              {
                bl?: number;
                it?: number;
                fs?: number;
                ff?: string;
                fc?: string;
                bg?: string;
                un?: number;
              }
            >
          > = {};
          // Raw image data keyed by 0-based sheet index.
          // Pixel positions are deferred to sheets.map where FortuneSheet
          // column/row dimensions are available.
          const imagesBySheet: Record<number, RawSheetImage[]> = {};

          workbook.eachSheet((ws, sheetIndex) => {
            const idx = sheetIndex - 1; // exceljs is 1-based

            // Hyperlinks
            const sheetHyperlinks: Record<
              string,
              { linkType: string; linkAddress: string }[]
            > = {};

            // Freeze panes from worksheet views
            const views = ws.views;
            if (views && views.length > 0) {
              const view = views[0];
              if (view.state === 'frozen') {
                const xSplit = view.xSplit || 0;
                const ySplit = view.ySplit || 0;
                let type: 'rangeRow' | 'rangeColumn' | 'rangeBoth' | null =
                  null;
                if (xSplit > 0 && ySplit > 0) type = 'rangeBoth';
                else if (ySplit > 0) type = 'rangeRow';
                else if (xSplit > 0) type = 'rangeColumn';
                if (type) {
                  frozenBySheet[idx] = {
                    type,
                    range: {
                      row_focus: ySplit - 1,
                      column_focus: xSplit - 1,
                    },
                  };
                }
              }
            }

            // Cell-level formatting and hyperlinks
            const styles: Record<
              string,
              {
                bl?: number;
                it?: number;
                fs?: number;
                ff?: string;
                fc?: string;
                bg?: string;
                un?: number;
              }
            > = {};
            ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                const key = `${rowNumber - 1}_${colNumber - 1}`;

                if (cell.hyperlink) {
                  sheetHyperlinks[key] = [
                    {
                      linkType: 'webpage',
                      linkAddress: cell.hyperlink,
                    },
                  ];
                }

                // Extract cell formatting
                const font = cell.style?.font;
                const fill = cell.style?.fill;
                const cellStyle: Record<string, string | number> = {};

                if (font) {
                  if (font.bold) cellStyle.bl = 1;
                  if (font.italic) cellStyle.it = 1;
                  if (font.underline) cellStyle.un = 1;
                  const effectiveFontSize =
                    font.size ?? workbookDefaultFontSize;
                  if (effectiveFontSize) cellStyle.fs = effectiveFontSize;
                  if (font.name) cellStyle.ff = font.name;
                  if (font.color?.argb) {
                    const argb = font.color.argb;
                    const hex = '#' + argb.substring(argb.length - 6);
                    cellStyle.fc = hex;
                  }
                }
                if (
                  fill?.type === 'pattern' &&
                  fill.pattern === 'solid' &&
                  fill.fgColor
                ) {
                  if (fill.fgColor.argb) {
                    const argb = fill.fgColor.argb;
                    const hex = '#' + argb.substring(argb.length - 6);
                    cellStyle.bg = hex;
                  }
                }
                if (Object.keys(cellStyle).length > 0) {
                  styles[key] = cellStyle;
                }
              });
            });

            if (Object.keys(sheetHyperlinks).length > 0) {
              hyperlinksBySheet[idx] = sheetHyperlinks;
            }
            if (Object.keys(styles).length > 0) {
              cellStylesBySheet[idx] = styles;
            }

            // Extract images — pixel positions are deferred to sheets.map
            const sheetImages = extractImagesFromWorksheet(ws, workbook);
            if (sheetImages.length > 0) imagesBySheet[idx] = sheetImages;

            // Log table data if present (for inspection purposes)
            const wsTables = (ws as any).tables;
            if (wsTables && Object.keys(wsTables).length > 0) {
              toast({
                title: 'Tables are not fully supported',
                description: 'Table styles will not be applied',
                variant: 'warning',
                showCloseButton: true,
                duration: 40 * 1000,
              });
            }

            // Extract data validation for this sheet (row_column keys for dataVerification)
            const dvModel = (
              ws as { dataValidations?: { model?: Record<string, unknown> } }
            ).dataValidations?.model;
            if (dvModel && typeof dvModel === 'object') {
              const sheetDv: Record<string, Record<string, unknown>> = {};
              for (const [address, dv] of Object.entries(dvModel)) {
                const dvObj = dv as {
                  type?: string;
                  formulae?: unknown[];
                  prompt?: string;
                  showInputMessage?: boolean;
                  allowBlank?: boolean;
                };
                const result = excelDataValidationToSheetEntry(address, dvObj);
                if (result) sheetDv[result.rowColKey] = result.entry;
              }
              if (Object.keys(sheetDv).length > 0) {
                dataVerificationBySheet[idx] = sheetDv;
              }
            }

            // Extract conditional formatting for this sheet (luckysheet_conditionformat_save)
            const cfs = (
              ws as {
                conditionalFormattings?: { ref: string; rules: unknown[] }[];
              }
            ).conditionalFormattings;
            if (Array.isArray(cfs) && cfs.length > 0) {
              const sheetCf: Record<string, unknown>[] = [];
              for (const cf of cfs) {
                const ref = cf.ref;
                const rules = cf.rules || [];
                for (const rule of rules) {
                  const r = rule as {
                    type?: string;
                    operator?: string;
                    formulae?: string[];
                    style?: Record<string, unknown>;
                    text?: string;
                    timePeriod?: string;
                    percent?: boolean;
                    bottom?: boolean;
                    rank?: number;
                    aboveAverage?: boolean;
                  };
                  console.log('[XLSX CF RAW]', {
                    ref,
                    type: r.type,
                    operator: r.operator,
                    formulae: r.formulae,
                    text: r.text,
                    timePeriod: r.timePeriod,
                    percent: r.percent,
                    bottom: r.bottom,
                    rank: r.rank,
                    aboveAverage: r.aboveAverage,
                  });
                  const entry = r.type ? excelCfRuleToLuckysheet(ref, r) : null;
                  if (!entry) {
                    console.log('[XLSX CF MAPPED] skipped', {
                      ref,
                      type: r.type,
                      operator: r.operator,
                      formulae: r.formulae,
                      text: r.text,
                    });
                  } else {
                    console.log('[XLSX CF MAPPED] accepted', entry);
                  }
                  if (entry) sheetCf.push(entry);
                }
              }
              if (sheetCf.length > 0) {
                conditionFormatBySheet[idx] = sheetCf;
              }
            }

            const autoFilter = (ws as any).autoFilter;
            if (autoFilter) {
              if (!filterToastShown) {
                setFilterToastShown(true);
                toast({
                  title: 'Filters are not supported in imported files',
                  variant: 'warning',
                  showCloseButton: true,
                  duration: 30 * 1000,
                });
              }
            }
          }); // close workbook.eachSheet

          transformExcelToLucky(
            file,
            function (exportJson: { sheets: Sheet[] }) {
              let sheets = exportJson.sheets;
              sheets.forEach((sheet, sheetIndex) => {
                const sheetDv = dataVerificationBySheet[sheetIndex];
                if (sheetDv && Object.keys(sheetDv).length > 0) {
                  sheet.dataVerification = sheetDv;
                }
                // Always set condition format: use our imported rules or empty array. Avoids leaving
                // stale/malformed rules from luckyexcel (e.g. type "colorGradation" with undefined format)
                // which cause "Cannot read properties of undefined (reading '0')" in fortune-core ConditionFormat.js
                const sheetCf = conditionFormatBySheet[sheetIndex];
                sheet.luckysheet_conditionformat_save =
                  Array.isArray(sheetCf) && sheetCf.length > 0 ? sheetCf : [];
              });

              if (!ydocRef.current) {
                console.error('ydocRef.current is null');
                return;
              }
              const sheetArray = ydocRef.current.getArray(dsheetId);
              const localSheetsArray = Array.from(sheetArray) as Sheet[];
              const isDateCache = new Map<string, boolean>();
              sheets = sheets.map((sheet, sheetIndex) => {
                const lastCell = sheet?.celldata?.[sheet.celldata.length - 1];

                const lastRow = lastCell?.r ?? 0;
                const lastCol = lastCell?.c ?? 0;

                sheet.row = Math.max(lastRow, 500);
                sheet.column = Math.max(lastCol, 36);

                if (!sheet.id) {
                  sheet.id = sheetEditorRef.current
                    ?.getSettings()
                    .generateSheetId();
                }
                // Attach freeze pane info
                if (frozenBySheet[sheetIndex]) {
                  sheet.frozen = frozenBySheet[sheetIndex];
                }
                // Attach hyperlinks extracted from exceljs for this sheet
                if (hyperlinksBySheet[sheetIndex]) {
                  sheet.hyperlink = {
                    ...(sheet.hyperlink || {}),
                    ...hyperlinksBySheet[sheetIndex],
                  };
                }
                // Correct column widths before image position conversion so that
                // nativeColToPx uses the same MDW=7 values the grid renders with.
                if (sheet.config?.columnlen) {
                  const corrected: Record<string, number> = {};
                  Object.entries(sheet.config.columnlen).forEach(
                    ([col, px]) => {
                      const wch = (Number(px) - 5) / 8 + 0.83;
                      corrected[col] = Math.round(wch * 7 + 5);
                    },
                  );
                  sheet.config.columnlen = corrected;
                }

                // Drop rowlen entries at or near the default row height so Fortune
                // uses its own default for rows the user never manually resized.
                // Also done before image conversion so nativeRowToPx uses the
                // same rowlen the grid renders with.
                if (sheet.config?.rowlen) {
                  const defaultRowPx = Math.round(
                    Number(sheet.defaultRowHeight) || 21,
                  );
                  const filtered: Record<string, number> = {};
                  Object.entries(sheet.config.rowlen).forEach(([row, h]) => {
                    if (Math.abs(Math.round(Number(h)) - defaultRowPx) > 1) {
                      filtered[row] = Number(h);
                    }
                  });
                  sheet.config.rowlen = filtered;
                }

                if (sheet.config?.customHeight) {
                  const keep = new Set<string>(
                    Object.keys((sheet.config.rowlen as any) || {}),
                  );
                  const next: Record<string, number> = {};
                  Object.entries(sheet.config.customHeight).forEach(
                    ([row, flag]) => {
                      if (keep.has(row) && Number(flag) === 1) {
                        next[row] = 1;
                      }
                    },
                  );
                  sheet.config.customHeight = next;
                }

                // Attach images — convert fractional col/row to pixels using
                // FortuneSheet's actual column/row dimensions so positions match.
                if (imagesBySheet[sheetIndex]) {
                  const defaultColPx =
                    Number(sheet.defaultColWidth) ||
                    Number(
                      sheetEditorRef.current?.getSettings?.()?.defaultColWidth,
                    ) ||
                    99;
                  const defaultRowPx =
                    Number(sheet.defaultRowHeight) ||
                    Number(
                      sheetEditorRef.current?.getSettings?.()?.defaultRowHeight,
                    ) ||
                    21;
                  sheet.images = convertRawImagesToFortuneSheet(
                    imagesBySheet[sheetIndex],
                    sheet,
                    defaultColPx,
                    defaultRowPx,
                  );
                }
                // Apply cell formatting from exceljs (hyperlink styling, bold, italic, bg, etc.)
                // Also fix date cells: set ct.t="d", coerce v to number, compute m
                const hlKeys = hyperlinksBySheet[sheetIndex];
                const styleKeys = cellStylesBySheet[sheetIndex];
                const calcChain: { r: number; c: number; id: string }[] = [];
                const pushCalcChainOnce = (r: number, c: number) => {
                  const k = `${r}_${c}`;
                  if ((pushCalcChainOnce as any)._seen == null) {
                    (pushCalcChainOnce as any)._seen = new Set<string>();
                  }
                  const seen = (pushCalcChainOnce as any)._seen as Set<string>;
                  if (seen.has(k)) return;
                  seen.add(k);
                  calcChain.push({ r, c, id: sheet.id as string });
                };
                // Built during the celldata loop below; only allocated when merges exist
                const celldataMap = sheet.config?.merge
                  ? new Map<
                    string,
                    { r: number; c: number; v: Record<string, unknown> }
                  >()
                  : null;
                if (sheet.celldata) {
                  for (const cell of sheet.celldata) {
                    const key = `${cell.r}_${cell.c}`;
                    celldataMap?.set(
                      key,
                      cell as {
                        r: number;
                        c: number;
                        v: Record<string, unknown>;
                      },
                    );
                    if (cell.v) {
                      if (cell.v.f) {
                        const fStr = String(cell.v.f);
                        if (!fStr.startsWith('=')) {
                          cell.v.f = `=${fStr}`;
                        }
                      }
                      // Mark formula cells so FortuneSheet recalculates them on dependency change.
                      // Keep cached m/v so the workbook shows something during the remount phase;
                      // schedulePostImportFormulaRecalc will overwrite them once the engine runs.
                      if (cell.v.f && cell.v.ct?.t !== 'd') {
                        cell.v.ct = { ...(cell.v.ct ?? {}), t: 'str' };
                        pushCalcChainOnce(cell.r, cell.c);
                      }
                      // Apply formatting extracted from exceljs
                      if (styleKeys?.[key]) {
                        const styleFromExcel = styleKeys[key] as Record<
                          string,
                          unknown
                        >;
                        const hasHyperlink = !!hlKeys?.[key];
                        if (hasHyperlink) {
                          // Hyperlink cells: avoid root-level fc/un inheritance.
                          const { fc: _fc, un: _un, ...rest } = styleFromExcel;
                          void _fc;
                          void _un;
                          Object.assign(cell.v, rest);
                        } else {
                          Object.assign(cell.v, styleFromExcel);
                        }
                      }
                      // Hyperlink cells: shared normalization (single ct.s run, styles on segment only).
                      if (hlKeys?.[key] && !cell.v.f) {
                        const hyperlink = hlKeys[key][0];
                        if (hyperlink) {
                          normalizeImportedHyperlinkCellV(
                            cell.v as Record<string, unknown>,
                            hyperlink,
                          );
                        }
                      }
                      // Fix date cells: luckyexcel leaves ct.t unset and v as a string
                      const fa = cell.v.ct?.fa;
                      const normalizedFa =
                        typeof fa === 'string' ? fa.trim().toLowerCase() : '';
                      const isGeneralLikeFormat =
                        normalizedFa === 'general' || cell.v.ct?.t === 'g';
                      const isTextLikeFormat =
                        normalizedFa === '@' || cell.v.ct?.t === 's';
                      if (fa && !isDateCache.has(fa)) {
                        isDateCache.set(fa, SSF.is_date(fa));
                      }

                      if (!cell.v.f && fa && isDateCache.get(fa)) {
                        const numV =
                          typeof cell.v.v === 'string'
                            ? parseFloat(cell.v.v)
                            : cell.v.v;
                        if (typeof numV === 'number' && !isNaN(numV)) {
                          try {
                            cell.v.v = numV;
                            cell.v.m = SSF.format(fa, numV);
                            cell.v.ct = { ...cell.v.ct, t: 'd' };
                          } catch {
                            // malformed format string — leave cell as-is
                          }
                        }
                        // luckyexcel stores numeric values as strings (e.g. "59.0"); parse to number and recompute m so integers don't display with a trailing ".0"
                      } else if (
                        !cell.v.f &&
                        typeof cell.v.v === 'string' &&
                        !isTextLikeFormat &&
                        !isGeneralLikeFormat
                      ) {
                        const rawStringValue = (cell.v.v as string).trim();
                        const isStrictNumericString =
                          /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(
                            rawStringValue,
                          );
                        if (isStrictNumericString) {
                          const numV = Number(rawStringValue);
                          if (!isFinite(numV)) {
                            continue;
                          }
                          cell.v.v = numV;
                          if (cell.v.ht == null) {
                            cell.v.ht = 2;
                          }
                          if (!fa) {
                            cell.v.m = String(numV);
                          } else {
                            try {
                              cell.v.m = SSF.format(fa, numV);
                            } catch {
                              // malformed format string — leave m as-is
                            }
                          }
                        }
                      } else if (
                        !cell.v.f &&
                        typeof cell.v.v === 'number' &&
                        isFinite(cell.v.v) &&
                        cell.v.ct?.t !== 's' &&
                        cell.v.ct?.t !== 'd'
                      ) {
                        if (cell.v.ht == null) {
                          cell.v.ht = 2;
                        }
                      }

                      // Ensure non-empty imported cells always have a display mask `m`.
                      // Filter-by-values uses `m` for display; when it is missing, values collapse to (Null).
                      if (
                        !cell.v.f &&
                        (cell.v.m === undefined || cell.v.m === null) &&
                        cell.v.ct?.t !== 'd'
                      ) {
                        const richText = richTextRunsToPlainText(cell.v.ct?.s);
                        const rawV = cell.v.v;
                        const isBlankLike =
                          rawV == null || String(rawV).trim() === '';
                        if (!isBlankLike) {
                          // Prefer rich text if present (hyperlinks are typically stored in ct.s).
                          if (richText != null) {
                            cell.v.m = richText;
                          } else if (typeof rawV === 'boolean') {
                            cell.v.m = excelishBooleanText(rawV);
                          } else if (
                            typeof rawV === 'number' &&
                            isFinite(rawV)
                          ) {
                            const fa2 = cell.v.ct?.fa;
                            if (
                              typeof fa2 === 'string' &&
                              fa2 &&
                              isDateCache.get(fa2) === false
                            ) {
                              try {
                                cell.v.m = SSF.format(fa2, rawV);
                              } catch {
                                cell.v.m = String(rawV);
                              }
                            } else {
                              cell.v.m = String(rawV);
                            }
                          } else if (typeof rawV === 'object') {
                            // Unknown complex value; leave `m` unset to avoid misleading text.
                          } else {
                            cell.v.m = String(rawV);
                          }
                        }
                      }
                    }
                  }
                }

                // Normalize formula cells in the data grid (luckyexcel may populate sheet.data
                // in addition to sheet.celldata). Keep cached m/v for display during remount.
                if (Array.isArray((sheet as any).data)) {
                  const data = (sheet as any).data as any[][];
                  for (let r = 0; r < data.length; r++) {
                    const row = data[r];
                    if (!Array.isArray(row)) continue;
                    for (let c = 0; c < row.length; c++) {
                      const v = row[c];
                      if (!v || typeof v !== 'object') continue;
                      if (!v.f) continue;

                      const fStr = String(v.f);
                      if (!fStr.startsWith('=')) v.f = `=${fStr}`;
                      if (v.ct?.t !== 'd') {
                        v.ct = { ...(v.ct ?? {}), t: 'str' };
                        pushCalcChainOnce(r, c);
                      }
                    }
                  }
                }

                sheet.calcChain = calcChain;

                // luckyexcel only sets config.merge but not cell-level mc properties.
                // FortuneSheet's canvas renderer needs mc on each cell in the merge range.
                // celldataMap was built during the celldata loop above (single pass).
                if (celldataMap && sheet.config?.merge && sheet.celldata) {
                  for (const merge of Object.values(sheet.config.merge) as {
                    r: number;
                    c: number;
                    rs: number;
                    cs: number;
                  }[]) {
                    const { r, c, rs, cs } = merge;
                    for (let dr = 0; dr < rs; dr++) {
                      for (let dc = 0; dc < cs; dc++) {
                        const key = `${r + dr}_${c + dc}`;
                        let cell = celldataMap.get(key);
                        if (!cell) {
                          cell = { r: r + dr, c: c + dc, v: {} };
                          sheet.celldata.push(cell as never);
                          celldataMap.set(key, cell);
                        }
                        if (!cell.v) cell.v = {};
                        cell.v.mc =
                          dr === 0 && dc === 0 ? { r, c, rs, cs } : { r, c };
                      }
                    }
                  }
                }

                return sheet;
              });
              console.log('[xlsx-import] parsed sheets data', {
                fileName: file.name,
                sheetCount: sheets.length,
                sheets,
              });

              let combinedSheets;

              if (importType === 'merge-current-dsheet') {
                combinedSheets = [...localSheetsArray, ...sheets];
              } else {
                combinedSheets = [...sheets];
              }

              combinedSheets = combinedSheets.map((sheet, index) => {
                sheet.order = index;
                return sheet;
              });

              const ydoc = ydocRef.current;
              ydoc.transact(() => {
                if (importType !== 'merge-current-dsheet') {
                  sheetArray.delete(0, sheetArray.length);
                }

                combinedSheets.forEach((sheet) => {
                  if (sheet instanceof Y.Map) return;

                  const factory = migrateSheetFactoryForImport(sheet);
                  sheetArray.push([factory()]);
                });
              });

              // Update UI immediately so sync handler sees correct count before it can run
              if (ydocRef?.current) {
                const arr = ydocRef.current.getArray(dsheetId);
                const plain = ySheetArrayToPlain(arr);
                currentDataRef.current = plain;
                setForceSheetRender((prev: number) => prev + 1);
              }
              schedulePostImportFormulaRecalc(sheetEditorRef);
              // @ts-expect-error later
              const fileName = removeFileExtension(exportJson?.info?.name);
              updateDocumentTitle?.(fileName);
              resolve();
            },
          );
        } catch (error) {
          console.error('Error loading the workbook', error);
          alert(
            'Error loading the workbook. Please ensure it is a valid .xlsx file.',
          );
          reject(error);
        }
      };

      reader.readAsArrayBuffer(file);
    });
  };

  return { handleXLSXUpload: handleFileUpload };
};
