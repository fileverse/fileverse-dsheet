import _ from 'lodash';
import { Context, getFlowdata } from '../context';
import { getSheetIndex, isAllowEdit } from '../utils';
import { cancelNormalSelected, mergeBorder } from './cell';
import { setSelectionByCharacterOffset } from './cursor';
import { getcellrange, iscelldata } from './formula';
import { applyLinkToSelection } from './inline-string';
import { colLocation, rowLocation } from './location';
import { normalizeSelection } from './selection';
import { changeSheet } from './sheet';
import { locale } from '../locale';
import { GlobalCache } from '../types';

export function getCellRowColumn(
  ctx: Context,
  e: MouseEvent,
  container: HTMLDivElement,
  scrollX: HTMLDivElement,
  scrollY: HTMLDivElement,
) {
  const flowdata = getFlowdata(ctx);
  if (flowdata == null) return undefined;
  const { scrollLeft } = scrollX;
  const { scrollTop } = scrollY;
  const rect = container.getBoundingClientRect();
  let x = e.pageX - rect.left - ctx.rowHeaderWidth;
  let y = e.pageY - rect.top - ctx.columnHeaderHeight;
  x += scrollLeft;
  y += scrollTop;
  let r = rowLocation(y, ctx.visibledatarow)[2];
  let c = colLocation(x, ctx.visibledatacolumn)[2];

  const margeset = mergeBorder(ctx, flowdata, r, c);
  if (margeset) {
    [, , r] = margeset.row;
    [, , c] = margeset.column;
  }

  return { r, c };
}

export function getCellHyperlink(ctx: Context, r: number, c: number) {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex != null) {
    return ctx.luckysheetfile[sheetIndex].hyperlink?.[`${r}_${c}`];
  }
  return undefined;
}

export function saveHyperlink(
  ctx: Context,
  r: number,
  c: number,
  linkText: string,
  linkType: string,
  linkAddress: string,
  options?: { applyToSelection?: boolean; cellInput?: HTMLDivElement | null },
) {
  const applyToSelection = options?.applyToSelection && options?.cellInput;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const flowdata = getFlowdata(ctx);

  if (applyToSelection) {
    if (sheetIndex != null && flowdata != null && linkType && linkAddress) {
      let cell = flowdata[r][c];
      if (cell == null) cell = {};
      _.set(ctx.luckysheetfile[sheetIndex], ['hyperlink', `${r}_${c}`], {
        linkType,
        linkAddress,
      });
      cell.v = linkText || linkAddress;
      cell.m = linkText || linkAddress;
      cell.hl = { r, c, id: ctx.currentSheetId };
      flowdata[r][c] = cell;

      if (ctx?.hooks?.updateCellYdoc) {
        ctx.hooks.updateCellYdoc([
          {
            sheetId: ctx.currentSheetId,
            path: ['hyperlink'],
            key: `${r}_${c}`,
            value: { linkType, linkAddress },
            type: 'update',
          },
          {
            sheetId: ctx.currentSheetId,
            path: ['celldata'],
            value: { r, c, v: cell },
            key: `${r}_${c}`,
            type: 'update',
          },
        ]);
      }
    }
    const offsets = ctx.linkCard?.selectionOffsets;
    if (offsets) {
      setSelectionByCharacterOffset(
        options.cellInput!,
        offsets.start,
        offsets.end,
      );
    }
    applyLinkToSelection(options.cellInput!, linkType, linkAddress);
    ctx.linkCard = undefined;
    return;
  }
  if (options?.cellInput) {
    cancelNormalSelected(ctx);
  }

  if (sheetIndex != null && flowdata != null && linkType && linkAddress) {
    let cell = flowdata[r][c];
    if (cell == null) cell = {};
    _.set(ctx.luckysheetfile[sheetIndex], ['hyperlink', `${r}_${c}`], {
      linkType,
      linkAddress,
    });
    cell.fc = 'rgb(0, 0, 255)';
    cell.un = 1;
    cell.v = linkText || linkAddress;
    cell.m = linkText || linkAddress;
    cell.hl = { r, c, id: ctx.currentSheetId };
    flowdata[r][c] = cell;
    ctx.linkCard = undefined;
    if (ctx?.hooks?.updateCellYdoc) {
      ctx?.hooks?.updateCellYdoc([
        {
          sheetId: ctx.currentSheetId,
          path: ['celldata'],
          value: {
            r,
            c,
            v: cell,
          },
          key: `${r}_${c}`,
          type: 'update',
        },
      ]);
    }
  }
}

export function removeHyperlink(ctx: Context, r: number, c: number) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const flowdata = getFlowdata(ctx);
  let updatedCell: any = null;
  if (flowdata != null && sheetIndex != null) {
    const hyperlink = _.omit(
      ctx.luckysheetfile[sheetIndex].hyperlink,
      `${r}_${c}`,
    );
    _.set(ctx.luckysheetfile[sheetIndex], 'hyperlink', hyperlink);
    const cell = flowdata[r][c];
    if (cell != null) {
      delete flowdata[r][c]?.hl;
      delete flowdata[r][c]?.un;
      delete flowdata[r][c]?.fc;
      updatedCell = flowdata[r][c];
    }
  }
  ctx.linkCard = undefined;

  if (ctx?.hooks?.updateCellYdoc) {
    const changes: any[] = [
      {
        sheetId: ctx.currentSheetId,
        path: ['hyperlink'],
        key: `${r}_${c}`,
        value: null,
        type: 'delete',
      },
    ];
    if (updatedCell != null) {
      changes.push({
        sheetId: ctx.currentSheetId,
        path: ['celldata'],
        value: { r, c, v: updatedCell },
        key: `${r}_${c}`,
        type: 'update',
      });
    }
    ctx.hooks.updateCellYdoc(changes);
  }
}

export function showLinkCard(
  ctx: Context,
  r: number,
  c: number,
  options?: {
    applyToSelection?: boolean;
    originText?: string;
    selectionOffsets?: { start: number; end: number };
  },
  isEditing = false,
  isMouseDown = false,
) {
  if (ctx.linkCard?.selectingCellRange) return;
  if (`${r}_${c}` === ctx.linkCard?.rc) return;
  const link = getCellHyperlink(ctx, r, c);
  const cell = getFlowdata(ctx)?.[r]?.[c];
  if (
    !isEditing &&
    link == null &&
    (isMouseDown ||
      !ctx.linkCard?.isEditing ||
      ctx.linkCard.sheetId !== ctx.currentSheetId)
  ) {
    ctx.linkCard = undefined;
    return;
  }
  if (
    isEditing ||
    (link != null && (!ctx.linkCard?.isEditing || isMouseDown)) ||
    ctx.linkCard?.sheetId !== ctx.currentSheetId
  ) {
    const col_pre = c - 1 === -1 ? 0 : ctx.visibledatacolumn[c - 1];
    const row = ctx.visibledatarow[r];
    const originText = (() => {
      if (options?.originText !== undefined) return options.originText;
      if (cell?.v == null) return '';
      return `${cell.v}`;
    })();
    ctx.linkCard = {
      sheetId: ctx.currentSheetId,
      r,
      c,
      rc: `${r}_${c}`,
      originText,
      originType: link?.linkType || 'webpage',
      originAddress: link?.linkAddress || '',
      position: {
        cellLeft: col_pre,
        cellBottom: row,
      },
      isEditing,
      applyToSelection: options?.applyToSelection ?? false,
      selectionOffsets: options?.selectionOffsets,
    };
  }
}

export function goToLink(
  ctx: Context,
  r: number,
  c: number,
  linkType: string,
  linkAddress: string,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement,
) {
  const currSheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (currSheetIndex == null) return;
  if (ctx.luckysheetfile[currSheetIndex].hyperlink?.[`${r}_${c}`] == null) {
    return;
  }
  if (linkType === 'webpage') {
    if (!/^http[s]?:\/\//.test(linkAddress)) {
      linkAddress = `https://${linkAddress}`;
    }
    window.open(linkAddress);
  } else if (linkType === 'sheet') {
    let sheetId;
    _.forEach(ctx.luckysheetfile, (f) => {
      if (linkAddress === f.name) {
        sheetId = f.id;
      }
    });
    if (sheetId != null) changeSheet(ctx, sheetId);
  } else {
    const range = _.cloneDeep(getcellrange(ctx, linkAddress));
    if (range == null) return;
    const row_pre =
      range.row[0] - 1 === -1 ? 0 : ctx.visibledatarow[range.row[0] - 1];
    const col_pre =
      range.column[0] - 1 === -1
        ? 0
        : ctx.visibledatacolumn[range.column[0] - 1];
    scrollbarX.scrollLeft = col_pre;
    scrollbarY.scrollLeft = row_pre;
    ctx.luckysheet_select_save = normalizeSelection(ctx, [range]);
    changeSheet(ctx, range.sheetId);
  }
  ctx.linkCard = undefined;
}

export function isLinkValid(
  ctx: Context,
  linkType: string,
  linkAddress: string,
) {
  if (!linkAddress) return { isValid: false, tooltip: '' };
  const { insertLink } = locale(ctx);
  // prepend https:// if missing
  if (!/^https?:\/\//i.test(linkAddress)) {
    linkAddress = `https://${linkAddress}`;
  }

  // general URL pattern (protocol + domain + optional port/path/query/hash)
  const urlPattern = /^(https?):\/\/[^\s$.?#].[^\s]*$/i;

  const isValid = urlPattern.test(linkAddress);

  if (!isValid) {
    return { isValid: false, tooltip: insertLink.tooltipInfo1 };
  }
  if (linkType === 'cellrange' && !iscelldata(linkAddress)) {
    return { isValid: false, tooltip: insertLink.invalidCellRangeTip };
  }
  return { isValid: true, tooltip: '' };
}

export function onRangeSelectionModalMoveStart(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
) {
  const box = document.querySelector(
    'div.fortune-link-modify-modal.range-selection-modal',
  ) as HTMLDivElement;
  if (!box) return;
  const { width, height } = box.getBoundingClientRect();
  const left = box.offsetLeft;
  const top = box.offsetTop;
  const initialPosition = { left, top, width, height };
  _.set(globalCache, 'linkCard.rangeSelectionModal', {
    cursorMoveStartPosition: {
      x: e.pageX,
      y: e.pageY,
    },
    initialPosition,
  });
}

export function onRangeSelectionModalMove(
  globalCache: GlobalCache,
  e: MouseEvent,
) {
  const moveProps = globalCache.linkCard?.rangeSelectionModal;
  if (moveProps == null) return;
  const modal = document.querySelector(
    'div.fortune-link-modify-modal.range-selection-modal',
  );
  const { x: startX, y: startY } = moveProps.cursorMoveStartPosition!;
  let { top, left } = moveProps.initialPosition!;
  left += e.pageX - startX;
  top += e.pageY - startY;
  if (top < 0) top = 0;
  (modal as HTMLDivElement).style.left = `${left}px`;
  (modal as HTMLDivElement).style.top = `${top}px`;
}

export function onRangeSelectionModalMoveEnd(globalCache: GlobalCache) {
  _.set(globalCache, 'linkCard.rangeSelectionModal', undefined);
}
