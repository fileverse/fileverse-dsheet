export function isTransparentBorderColor(color: string): boolean {
  if (!color) return true;
  const normalized = color.trim().toLowerCase();
  if (normalized === 'transparent') return true;

  const rgba = normalized.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/,
  );
  if (rgba) {
    const alpha = rgba[4] != null ? parseFloat(rgba[4]) : 1;
    return alpha === 0;
  }
  return false;
}

export function isMeaningfulBorderSide(
  side: { style?: number; color?: string } | undefined,
): boolean {
  if (!side) return false;
  if (!side.style || side.style === 0) return false;
  return !isTransparentBorderColor(String(side.color ?? ''));
}

export function filterMeaningfulBorderSides(sides: {
  l?: { style?: number; color?: string };
  r?: { style?: number; color?: string };
  t?: { style?: number; color?: string };
  b?: { style?: number; color?: string };
}): typeof sides {
  const out: typeof sides = {};
  if (isMeaningfulBorderSide(sides.l)) out.l = sides.l;
  if (isMeaningfulBorderSide(sides.r)) out.r = sides.r;
  if (isMeaningfulBorderSide(sides.t)) out.t = sides.t;
  if (isMeaningfulBorderSide(sides.b)) out.b = sides.b;
  return out;
}

/** Drop junk borderInfo entries. Returns undefined when unchanged. */
export function compactBorderInfo(
  borderInfo: any[] | undefined,
): any[] | undefined {
  if (!borderInfo?.length) return undefined;

  const next: any[] = [];
  let changed = false;

  for (let i = 0; i < borderInfo.length; i += 1) {
    const entry = borderInfo[i];
    if (!entry || typeof entry !== 'object') {
      changed = true;
      continue;
    }

    if (entry.rangeType === 'cell' && entry.value) {
      const filtered = filterMeaningfulBorderSides(entry.value);
      if (!filtered.l && !filtered.r && !filtered.t && !filtered.b) {
        changed = true;
        continue;
      }
      if (
        filtered.l !== entry.value.l ||
        filtered.r !== entry.value.r ||
        filtered.t !== entry.value.t ||
        filtered.b !== entry.value.b
      ) {
        next.push({ ...entry, value: { ...entry.value, ...filtered } });
        changed = true;
      } else {
        next.push(entry);
      }
      continue;
    }

    if (entry.rangeType === 'range') {
      if (entry.borderType === 'border-none') {
        next.push(entry);
        continue;
      }
      const style = Number(entry.style);
      if (!style || isTransparentBorderColor(String(entry.color ?? ''))) {
        changed = true;
        continue;
      }
      next.push(entry);
      continue;
    }

    next.push(entry);
  }

  return changed ? next : undefined;
}
