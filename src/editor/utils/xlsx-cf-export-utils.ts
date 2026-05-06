import { utils as XLSXUtil } from 'xlsx-js-style';
import type { Worksheet } from 'exceljs';

type CellRange = {
  row: [number, number];
  column: [number, number];
  [key: string]: unknown;
};

export type FortuneFormat = {
  textColor?: string;
  cellColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
};

type FortuneRule = {
  type: string;
  cellrange: CellRange[];
  format?: FortuneFormat;
  conditionName: string;
  conditionValue?: string[];
};

type Sheet = {
  luckysheet_conditionformat_save?: FortuneRule[];
  [key: string]: unknown;
};

export type PendingDuplicateRule = {
  ref: string;
  format: FortuneFormat;
  priority: number;
  type: 'duplicateValues' | 'uniqueValues';
};

export type CfExportResult = {
  nextPriority: number;
  pendingDuplicateValues: PendingDuplicateRule[];
};

/** Convert any CSS color string to an 8-char ARGB hex (e.g. "FFFF0000"). Returns null if unparseable. */
export function colorToArgb(color: string): string | null {
  if (!color || typeof color !== 'string') return null;
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.replace('#', '').toUpperCase();
    if (hex.length === 3) {
      return (
        'FF' +
        hex
          .split('')
          .map((x) => x + x)
          .join('')
      );
    }
    if (hex.length === 6) return 'FF' + hex;
    return null;
  }
  const m = c.match(/rgba?\s*\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) {
    const toHex = (n: number) =>
      Math.min(255, Math.max(0, Math.round(n)))
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
    return (
      'FF' +
      toHex(parseFloat(m[1])) +
      toHex(parseFloat(m[2])) +
      toHex(parseFloat(m[3]))
    );
  }
  return null;
}

/** Convert FortuneSheet format descriptor to an ExcelJS dxf style object. */
function fortuneFormatToExcelStyle(
  format: FortuneFormat,
): Record<string, unknown> {
  const style: Record<string, unknown> = {};

  const font: Record<string, unknown> = {};
  if (format.textColor && format.textColor.toLowerCase() !== '#000000') {
    const argb = colorToArgb(format.textColor);
    if (argb) font.color = { argb };
  }
  if (format.bold) font.bold = true;
  if (format.italic) font.italic = true;
  if (format.underline) font.underline = true;
  if (format.strikethrough) font.strike = true;
  if (Object.keys(font).length > 0) style.font = font;

  const bg = format.cellColor;
  if (bg && bg.toLowerCase() !== '#ffffff') {
    const argb = colorToArgb(bg);
    if (argb) {
      style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    }
  }

  return style;
}

/** Convert a FortuneSheet cellrange array to an OOXML sqref string (e.g. "A1:C500"). */
function cellrangeToRef(cellrange: CellRange[]): string {
  if (!Array.isArray(cellrange) || cellrange.length === 0) return '';
  const parts = cellrange
    .map((cr) => {
      const [r1, r2] = cr.row;
      const [c1, c2] = cr.column;
      const start = XLSXUtil.encode_cell({ r: r1, c: c1 });
      const end = XLSXUtil.encode_cell({ r: r2, c: c2 });
      return start === end ? start : `${start}:${end}`;
    })
    .filter(Boolean);
  return parts.join(' ');
}

/** Map a single FortuneSheet CF rule to an ExcelJS rule object, or null if unsupported. */
function luckysheetConditionToExcelCf(
  rule: FortuneRule,
  ref: string,
  priority: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, unknown> | null {
  const { conditionName, conditionValue = [], format = {} } = rule;
  const style = fortuneFormatToExcelStyle(format);
  const escapeForFormula = (s: string) => s.replace(/"/g, '""');

  // Top-left cell of range (needed for text-contains formula)
  const topLeft = ref.split(/[\s:]/)[0];

  switch (conditionName) {
    case 'greaterThan':
    case 'greaterThanOrEqual':
    case 'lessThan':
    case 'lessThanOrEqual':
    case 'equal': {
      if (!conditionValue[0]) return null;
      return {
        type: 'cellIs',
        operator: conditionName,
        formulae: [conditionValue[0]],
        priority,
        style,
      };
    }
    case 'notEqual': {
      if (!conditionValue[0]) return null;
      return {
        type: 'cellIs',
        operator: 'notEqual',
        formulae: [conditionValue[0]],
        priority,
        style,
      };
    }
    case 'between': {
      if (conditionValue.length < 2) return null;
      return {
        type: 'cellIs',
        operator: 'between',
        formulae: [conditionValue[0], conditionValue[1]],
        priority,
        style,
      };
    }
    case 'notBetween': {
      if (conditionValue.length < 2) return null;
      return {
        type: 'cellIs',
        operator: 'notBetween',
        formulae: [conditionValue[0], conditionValue[1]],
        priority,
        style,
      };
    }
    case 'textContains': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      // Google Sheets requires the SEARCH formula to apply the rule correctly
      return {
        type: 'containsText',
        operator: 'containsText',
        text,
        formulae: [`NOT(ISERROR(SEARCH("${escapeForFormula(text)}",${topLeft})))`],
        priority,
        style,
      };
    }
    case 'containsText': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      return {
        type: 'containsText',
        operator: 'containsText',
        text,
        formulae: [`NOT(ISERROR(SEARCH("${escapeForFormula(text)}",${topLeft})))`],
        priority,
        style,
      };
    }
    case 'textDoesNotContain': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      return {
        type: 'notContainsText',
        operator: 'notContainsText',
        text,
        formulae: [`ISERROR(SEARCH("${escapeForFormula(text)}",${topLeft}))`],
        priority,
        style,
      };
    }
    case 'notContainsText':
    case 'notContains': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      return {
        type: 'notContainsText',
        operator: 'notContainsText',
        text,
        formulae: [`ISERROR(SEARCH("${escapeForFormula(text)}",${topLeft}))`],
        priority,
        style,
      };
    }
    case 'textStartsWith': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      return {
        type: 'beginsWith',
        operator: 'beginsWith',
        text,
        formulae: [`LEFT(${topLeft},${text.length})="${escapeForFormula(text)}"`],
        priority,
        style,
      };
    }
    case 'beginsWith': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      return {
        type: 'beginsWith',
        operator: 'beginsWith',
        text,
        formulae: [`LEFT(${topLeft},${text.length})="${escapeForFormula(text)}"`],
        priority,
        style,
      };
    }
    case 'textEndsWith': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      return {
        type: 'endsWith',
        operator: 'endsWith',
        text,
        formulae: [
          `RIGHT(${topLeft},${text.length})="${escapeForFormula(text)}"`,
        ],
        priority,
        style,
      };
    }
    case 'endsWith': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      return {
        type: 'endsWith',
        operator: 'endsWith',
        text,
        formulae: [
          `RIGHT(${topLeft},${text.length})="${escapeForFormula(text)}"`,
        ],
        priority,
        style,
      };
    }
    case 'textExactly': {
      if (!conditionValue[0]) return null;
      const text = conditionValue[0];
      return {
        // Keep this in the text-rule family so Google/OOXML readers preserve it
        // similarly to other text CF rules.
        type: 'containsText',
        operator: 'equal',
        text,
        formulae: [`EXACT(${topLeft},"${escapeForFormula(text)}")`],
        priority,
        style,
      };
    }
    case 'empty':
      // ExcelJS's renderText uses model.operator as the XML type attribute;
      // passing type:'containsText' + operator:'containsBlanks' produces
      // <cfRule type="containsBlanks" operator="containsBlanks">
      return {
        type: 'containsText',
        operator: 'containsBlanks',
        formulae: [`LEN(TRIM(${topLeft}))=0`],
        priority,
        style,
      };
    case 'containsBlanks':
      return {
        type: 'containsText',
        operator: 'containsBlanks',
        formulae: [`LEN(TRIM(${topLeft}))=0`],
        priority,
        style,
      };
    case 'notEmpty':
      return {
        type: 'containsText',
        operator: 'notContainsBlanks',
        formulae: [`LEN(TRIM(${topLeft}))>0`],
        priority,
        style,
      };
    case 'notContainsBlanks':
      return {
        type: 'containsText',
        operator: 'notContainsBlanks',
        formulae: [`LEN(TRIM(${topLeft}))>0`],
        priority,
        style,
      };
    case 'top10': {
      const rank = parseInt(conditionValue[0] || '10', 10) || 10;
      return {
        type: 'top10',
        rank,
        percent: false,
        bottom: false,
        priority,
        style,
      };
    }
    case 'top10Percent':
    case 'top10_percent': {
      const rank = parseInt(conditionValue[0] || '10', 10) || 10;
      return {
        type: 'top10',
        rank,
        percent: true,
        bottom: false,
        priority,
        style,
      };
    }
    case 'last10': {
      const rank = parseInt(conditionValue[0] || '10', 10) || 10;
      return {
        type: 'top10',
        rank,
        percent: false,
        bottom: true,
        priority,
        style,
      };
    }
    case 'last10Percent':
    case 'last10_percent': {
      const rank = parseInt(conditionValue[0] || '10', 10) || 10;
      return {
        type: 'top10',
        rank,
        percent: true,
        bottom: true,
        priority,
        style,
      };
    }
    case 'aboveAverage':
      return { type: 'aboveAverage', aboveAverage: true, priority, style };
    case 'belowAverage':
      return { type: 'aboveAverage', aboveAverage: false, priority, style };
    case 'date':
    case 'dateIs':
    case 'dateBefore':
    case 'dateAfter': {
      const preset = String(conditionValue[0] ?? '');
      const presetName = preset.startsWith('preset:')
        ? preset.slice(7)
        : preset.toLowerCase();
      if (
        presetName === 'today' ||
        presetName === 'tomorrow' ||
        presetName === 'yesterday'
      ) {
        return { type: 'timePeriod', timePeriod: presetName, priority, style };
      }
      if (presetName === 'pastWeek') {
        return { type: 'timePeriod', timePeriod: 'last7Days', priority, style };
      }
      if (presetName === 'pastMonth') {
        return { type: 'timePeriod', timePeriod: 'lastMonth', priority, style };
      }
      if (presetName === 'pastYear') {
        return { type: 'timePeriod', timePeriod: 'lastYear', priority, style };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Writes all luckysheet_conditionformat_save rules from `sheet` into the
 * ExcelJS worksheet.
 *
 * Returns the next available priority integer and any `duplicateValue` rules
 * that ExcelJS cannot render — those must be injected later via
 * `patchXlsxCf` in the post-processing step.
 */
export function exportConditionalFormatting(
  ws: Worksheet,
  sheet: Sheet,
  startPriority: number,
): CfExportResult {
  const cfRules = sheet.luckysheet_conditionformat_save;
  const pendingDuplicateValues: PendingDuplicateRule[] = [];
  if (!Array.isArray(cfRules) || cfRules.length === 0) {
    return { nextPriority: startPriority, pendingDuplicateValues };
  }

  let priority = startPriority;

  for (const rule of cfRules) {
    // colorGradation / dataBar / iconSet require a different OOXML structure — skip for now
    if (rule.type !== 'default') continue;

    const ref = cellrangeToRef(rule.cellrange);
    if (!ref) continue;

    // ExcelJS has no renderer for duplicateValues — collect for ZIP post-processing
    if (rule.conditionName === 'duplicateValue') {
      const type =
        String(rule.conditionValue?.[0] ?? '0') === '1'
          ? 'uniqueValues'
          : 'duplicateValues';
      pendingDuplicateValues.push({
        ref,
        format: rule.format || {},
        priority,
        type,
      });
      priority++;
      continue;
    }

    const excelRule = luckysheetConditionToExcelCf(rule, ref, priority);
    if (!excelRule) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws as any).addConditionalFormatting({ ref, rules: [excelRule] });
    priority++;
  }

  return { nextPriority: priority, pendingDuplicateValues };
}
