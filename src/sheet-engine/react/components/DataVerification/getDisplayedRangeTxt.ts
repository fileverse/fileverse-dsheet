import { getRangetxt, Context } from "@sheet-engine/core";

export function getDisplayedRangeTxt(context: Context): string {
  if (context.luckysheet_select_save) {
    const range =
      context.luckysheet_select_save[context.luckysheet_select_save.length - 1];
    return getRangetxt(
      context,
      context.currentSheetId,
      range,
      context.currentSheetId
    );
  }
  return context.rangeDialog?.rangeTxt ?? "";
}
