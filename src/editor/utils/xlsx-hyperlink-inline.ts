/* eslint-disable @typescript-eslint/no-explicit-any */

/** Legacy single entry or multi-link array — XLSX round-trip uses the first link only. */
export function getFirstHyperlinkEntry(
  raw: unknown,
): { linkType: string; linkAddress: string } | undefined {
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (
      first &&
      typeof first === 'object' &&
      typeof (first as any).linkType === 'string' &&
      typeof (first as any).linkAddress === 'string'
    ) {
      return first as { linkType: string; linkAddress: string };
    }
    return undefined;
  }
  if (
    raw &&
    typeof raw === 'object' &&
    typeof (raw as any).linkType === 'string' &&
    typeof (raw as any).linkAddress === 'string'
  ) {
    return raw as { linkType: string; linkAddress: string };
  }
  return undefined;
}

/** Plain text from `ct.s` — fast path when a single run (e.g. post-import normalization). */
export function concatInlineStrRunsText(runs: unknown[]): string {
  if (!Array.isArray(runs) || runs.length === 0) return '';
  if (runs.length === 1) return String((runs[0] as any)?.v ?? '');
  let out = '';
  for (let i = 0; i < runs.length; i += 1) {
    out += String((runs[i] as any)?.v ?? '');
  }
  return out;
}

/** Copy `ct` fields except text container keys (fc/un/s/t) — avoids spreading large `s` arrays. */
function pickCtPreservedForHyperlinkInline(ct: unknown): Record<string, unknown> {
  if (!ct || typeof ct !== 'object' || Array.isArray(ct)) return {};
  const src = ct as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    if (k === 'fc' || k === 'un' || k === 's' || k === 't') continue;
    out[k] = src[k];
  }
  return out;
}

export type HyperlinkEntryLite = { linkType: string; linkAddress: string };

/**
 * After Excel import: one `ct.s` run with link + typography; strip root/ct fc/un so the grid
 * reads styles from segments only (matches native hyperlink cells).
 */
export function normalizeImportedHyperlinkCellV(
  cellV: Record<string, unknown>,
  hyperlink: HyperlinkEntryLite,
): void {
  const fallbackInlineText = String(cellV.m ?? cellV.v ?? '').replace(/\r\n/g, '\n');

  let mergedText = '';
  let baseRun: Record<string, unknown> | null = null;
  const ctPrev = cellV.ct as { t?: string; s?: unknown[] } | undefined;

  if (
    ctPrev?.t === 'inlineStr' &&
    Array.isArray(ctPrev.s) &&
    ctPrev.s.length > 0
  ) {
    const runs = ctPrev.s as Record<string, unknown>[];
    if (runs.length === 1) {
      const seg0 = runs[0];
      mergedText = String(seg0?.v ?? '');
      if (mergedText.length > 0) baseRun = seg0;
    } else {
      for (let i = 0; i < runs.length; i += 1) {
        const seg = runs[i];
        const txt = String(seg?.v ?? '');
        if (txt.length > 0 && baseRun == null) baseRun = seg;
        mergedText += txt;
      }
    }
  }
  if (mergedText.length === 0) {
    mergedText = fallbackInlineText;
  }

  const singleRun: Record<string, unknown> = {
    v: mergedText,
    fs: baseRun?.fs ?? cellV.fs ?? 10,
    ff: baseRun?.ff ?? cellV.ff ?? 0,
    bl: baseRun?.bl ?? cellV.bl ?? 0,
    it: baseRun?.it ?? cellV.it ?? 0,
    cl: baseRun?.cl ?? cellV.cl ?? 0,
    fc:
      baseRun?.fc != null && String(baseRun.fc).length > 0
        ? baseRun.fc
        : 'rgb(0, 0, 255)',
    un:
      baseRun?.un != null && baseRun.un !== 0 ? baseRun.un : 1,
    link: {
      linkType: hyperlink.linkType,
      linkAddress: hyperlink.linkAddress,
    },
  };

  const prevCt = pickCtPreservedForHyperlinkInline(cellV.ct);
  cellV.ct = {
    ...prevCt,
    t: 'inlineStr',
    s: [singleRun],
  };
  cellV.m = mergedText;
  cellV.v = mergedText;

  delete cellV.fc;
  delete cellV.un;
  const ct = cellV.ct;
  if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
    delete (ct as { fc?: unknown }).fc;
    delete (ct as { un?: unknown }).un;
  }
}
