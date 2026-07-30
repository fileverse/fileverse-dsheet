import type { Context } from '../context';

/**
 * Defer sheet-level metadata hooks until after React applies Immer updates, so
 * getSheet() / Yjs diff see dataVerification, CF rules, and hyperlinks from paste/cut.
 *
 * Capture the hook fns themselves (not `ctx.hooks`): paste runs inside produce,
 * and reading a draft `hooks` proxy after it is revoked throws
 * "Cannot perform 'get' on a proxy that has been revoked".
 */
export function scheduleSheetMetadataSyncHooks(ctx: Context) {
  const dataVerificationChange = ctx.hooks?.dataVerificationChange;
  const conditionFormatChange = ctx.hooks?.conditionFormatChange;
  const hyperlinkChange = ctx.hooks?.hyperlinkChange;
  if (
    !dataVerificationChange &&
    !conditionFormatChange &&
    !hyperlinkChange
  ) {
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dataVerificationChange?.();
      conditionFormatChange?.();
      hyperlinkChange?.();
    });
  });
}
