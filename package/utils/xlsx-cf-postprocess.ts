import JSZip from 'jszip';
import { colorToArgb, type FortuneFormat, type PendingDuplicateRule } from './xlsx-cf-export-utils';

export type SheetCfPatch = {
  duplicateValues: PendingDuplicateRule[];
};

// ---------------------------------------------------------------------------
// DXF (differential format) helpers — used to persist CF styles in styles.xml
// ---------------------------------------------------------------------------

/** Build a <dxf> XML string for the given FortuneSheet format. */
function buildDxfXml(format: FortuneFormat): string {
  let inner = '';

  const fontParts: string[] = [];
  if (format.bold) fontParts.push('<b/>');
  if (format.italic) fontParts.push('<i/>');
  if (format.underline) fontParts.push('<u/>');
  if (format.strikethrough) fontParts.push('<strike/>');
  if (format.textColor && format.textColor.toLowerCase() !== '#000000') {
    const argb = colorToArgb(format.textColor);
    if (argb) fontParts.push(`<color rgb="${argb}"/>`);
  }
  if (fontParts.length > 0) inner += `<font>${fontParts.join('')}</font>`;

  const bg = format.cellColor;
  if (bg && bg.toLowerCase() !== '#ffffff') {
    const argb = colorToArgb(bg);
    if (argb) {
      inner += `<fill><patternFill patternType="solid"><fgColor rgb="${argb}"/></patternFill></fill>`;
    }
  }

  return `<dxf>${inner}</dxf>`;
}

/**
 * Append one dxf entry to the styles XML.
 * Returns the updated XML and the dxfId that was assigned (0-based index).
 */
function injectDxf(
  stylesXml: string,
  dxfXml: string,
): { xml: string; dxfId: number } {
  // Case 1: <dxfs count="N"> … </dxfs>
  const countMatch = stylesXml.match(/<dxfs count="(\d+)"/);
  if (countMatch) {
    const dxfId = parseInt(countMatch[1], 10);
    return {
      xml: stylesXml
        .replace(/<dxfs count="\d+"/, `<dxfs count="${dxfId + 1}"`)
        .replace('</dxfs>', dxfXml + '</dxfs>'),
      dxfId,
    };
  }

  // Case 2: <dxfs/> (empty, self-closing)
  if (stylesXml.includes('<dxfs/>')) {
    return {
      xml: stylesXml.replace('<dxfs/>', `<dxfs count="1">${dxfXml}</dxfs>`),
      dxfId: 0,
    };
  }

  // Case 3: no <dxfs> section at all
  return {
    xml: stylesXml.replace(
      '</styleSheet>',
      `<dxfs count="1">${dxfXml}</dxfs></styleSheet>`,
    ),
    dxfId: 0,
  };
}

// ---------------------------------------------------------------------------
// Worksheet XML helpers
// ---------------------------------------------------------------------------

/** Escape a string for use inside a regex. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Add a cfRule element inside the appropriate <conditionalFormatting sqref="…">
 * section. Creates the section if it doesn't exist yet.
 */
function injectCfRule(
  wsXml: string,
  ref: string,
  cfRuleXml: string,
): string {
  // Try to find an existing <conditionalFormatting> with this sqref
  const existing = new RegExp(
    `(<conditionalFormatting[^>]*\\bsqref="${escapeRegExp(ref)}"[^>]*>)`,
  );
  if (existing.test(wsXml)) {
    return wsXml.replace(existing, `$1${cfRuleXml}`);
  }

  // Create a new <conditionalFormatting> element and insert it before the
  // first sensible anchor, or just before </worksheet>.
  const newSection = `<conditionalFormatting sqref="${ref}">${cfRuleXml}</conditionalFormatting>`;
  for (const anchor of [
    '<pageMargins',
    '<pageSetup',
    '<headerFooter',
    '<drawing',
    '</worksheet>',
  ]) {
    if (wsXml.includes(anchor)) {
      return wsXml.replace(anchor, newSection + anchor);
    }
  }

  return wsXml + newSection;
}

/**
 * Add the missing `text` attribute to `<cfRule type="containsText">` elements.
 * ExcelJS writes the SEARCH formula but omits the `text` attribute; Excel and
 * some readers need it for round-trip editing.
 */
function patchContainsTextAttr(wsXml: string): string {
  return wsXml.replace(
    /<cfRule([^>]*)type="containsText"([^>]*?)>([\s\S]*?)<\/cfRule>/g,
    (match, before, after, inner) => {
      // Skip if text attribute is already present
      if (/\btext=/.test(before) || /\btext=/.test(after)) return match;

      const formulaMatch = inner.match(/<formula[^>]*>([\s\S]*?)<\/formula>/);
      if (!formulaMatch) return match;

      // Decode XML entities in the formula content before matching
      const formula = formulaMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      const searchMatch = formula.match(/SEARCH\s*\(\s*"([^"]*)"/i);
      if (!searchMatch) return match;

      // Re-encode the extracted text for use as an XML attribute value
      const text = searchMatch[1]
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      return `<cfRule${before}type="containsText"${after} text="${text}">${inner}</cfRule>`;
    },
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Post-process an XLSX buffer produced by ExcelJS to fix conditional
 * formatting issues that ExcelJS cannot handle natively:
 *
 *   1. Adds the `text` attribute to `containsText` cfRules (ExcelJS omits it).
 *   2. Injects `duplicateValues` cfRules that ExcelJS's renderer skips entirely,
 *      including their dxf style entries in xl/styles.xml.
 */
export async function patchXlsxCf(
  buffer: ArrayBuffer | Buffer,
  sheetPatches: SheetCfPatch[],
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);

  const stylesFile = zip.file('xl/styles.xml');
  let stylesXml = stylesFile ? await stylesFile.async('text') : '';
  let stylesModified = false;

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const sheetNumMatch = path.match(/^xl\/worksheets\/sheet(\d+)\.xml$/);
    if (!sheetNumMatch) continue;

    const sheetIndex = parseInt(sheetNumMatch[1], 10) - 1;
    let wsXml = await file.async('text');
    let wsModified = false;

    // 1. Patch missing text= attribute on containsText rules
    const patched = patchContainsTextAttr(wsXml);
    if (patched !== wsXml) {
      wsXml = patched;
      wsModified = true;
    }

    // 2. Inject duplicateValues rules (ExcelJS renders nothing for these)
    const pending = sheetPatches[sheetIndex]?.duplicateValues ?? [];
    for (const rule of pending) {
      const dxfXml = buildDxfXml(rule.format);
      const { xml: newStylesXml, dxfId } = injectDxf(stylesXml, dxfXml);
      stylesXml = newStylesXml;
      stylesModified = true;

      const cfRuleXml = `<cfRule type="duplicateValues" dxfId="${dxfId}" priority="${rule.priority}"/>`;
      wsXml = injectCfRule(wsXml, rule.ref, cfRuleXml);
      wsModified = true;
    }

    if (wsModified) {
      zip.file(path, wsXml);
    }
  }

  if (stylesModified && stylesFile) {
    zip.file('xl/styles.xml', stylesXml);
  }

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
