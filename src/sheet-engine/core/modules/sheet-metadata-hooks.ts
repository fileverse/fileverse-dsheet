import type { Context } from "../context";

/**
 * Defer sheet-level metadata hooks until after React applies Immer updates, so
 * getSheet() / Yjs diff see dataVerification, CF rules, and hyperlinks from paste/cut.
 */
export function scheduleSheetMetadataSyncHooks(ctx: Context) {
  const h = ctx.hooks;
  if (
    !h?.dataVerificationChange &&
    !h?.conditionFormatChange &&
    !h?.hyperlinkChange
  ) {
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      h.dataVerificationChange?.();
      h.conditionFormatChange?.();
      h.hyperlinkChange?.();
    });
  });
}
