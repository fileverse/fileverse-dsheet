import _ from 'lodash';
import { Context } from '../context';
import { getSheetIndex } from '../utils';

// Contract: `config.rowhidden` is the render-time union (manual ∪ filter); do not write it directly.
export function getFilterHiddenRowsUnionFromFilterMap(
  filter: Context['filter'] | null | undefined,
): Record<string, number> {
  return _.reduce(
    filter || {},
    (pre, curr) => _.assign(pre, curr?.rowhidden || {}),
    {} as Record<string, number>,
  );
}

export function getFilterHiddenRowsUnion(ctx: Context): Record<string, number> {
  return getFilterHiddenRowsUnionFromFilterMap(ctx.filter);
}

/**
 * Migration/initialization helper:
 * - If `rowhidden_manual` exists, keep it.
 * - Otherwise, derive it from existing `rowhidden` by subtracting active filter-hidden rows
 *   (if a filter is active), else treat all `rowhidden` as manual.
 */
export function ensureManualHiddenInitialized(ctx: Context) {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) return;
  const sheet = ctx.luckysheetfile[sheetIndex];
  const cfg = sheet.config || {};

  if (cfg.rowhidden_manual != null) {
    // Keep sheet + ctx in sync (ctx.config is sometimes a clone).
    ctx.config.rowhidden_manual = cfg.rowhidden_manual;
    return;
  }

  const union = (ctx.config?.rowhidden || {}) as Record<string, number>;
  const filterActive =
    ctx.currentSheetId === sheet.id &&
    !_.isNil(ctx.luckysheet_filter_save) &&
    !_.isEmpty(ctx.filter);
  const filterUnion = filterActive ? getFilterHiddenRowsUnion(ctx) : {};
  const manual = filterActive
    ? _.omit(union, _.keys(filterUnion))
    : { ...union };

  cfg.rowhidden_manual = manual;
  sheet.config = cfg;
  ctx.config.rowhidden_manual = manual;
}

export function rebuildRowHiddenUnion(ctx: Context) {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) return;

  // Ensure `rowhidden_manual` exists before rebuilding the union.
  ensureManualHiddenInitialized(ctx);

  const sheet = ctx.luckysheetfile[sheetIndex];
  const cfg = sheet.config || {};

  const manual = (ctx.config.rowhidden_manual || {}) as Record<string, number>;
  const filterUnion = getFilterHiddenRowsUnion(ctx);
  const viewerFilterVisible = ctx.viewerFilterVisible !== false;
  const effectiveFilterUnion = viewerFilterVisible ? filterUnion : {};
  const union = _.assign({}, manual, effectiveFilterUnion);

  // Optional explicitness: persist the filter-hidden union separately.
  ctx.config.rowhidden_filter = filterUnion;
  cfg.rowhidden_filter = filterUnion;

  ctx.config.rowhidden = union;
  cfg.rowhidden = union;
  cfg.rowhidden_manual = manual;
  sheet.config = cfg;

  if (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV !== 'production'
  ) {
    const rowhidden = (ctx.config.rowhidden || {}) as Record<string, number>;
    const expected = _.assign({}, manual, effectiveFilterUnion);
    const same =
      _.size(expected) === _.size(rowhidden) &&
      _.every(expected, (v, k) => rowhidden[k] === v);
    if (!same) {
      console.warn('[rowVisibility] ctx.config.rowhidden diverged from union', {
        manual: _.size(manual),
        filter: _.size(filterUnion),
        union: _.size(expected),
        actual: _.size(rowhidden),
      });
    }
  }
}
