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
