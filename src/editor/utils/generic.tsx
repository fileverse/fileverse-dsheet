export function isNumericOnly(value: string | number) {
  return Number.isFinite(Number(value)) && !Number.isNaN(Number(value));
}

export function isHexValue(str: string): boolean {
  // Accepts with or without 0x prefix
  return /^0x?[a-fA-F0-9]+$/.test(str);
}