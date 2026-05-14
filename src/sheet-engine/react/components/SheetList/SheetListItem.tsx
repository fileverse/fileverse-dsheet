import {
  Sheet,
  cancelNormalSelected,
  cancelActiveImgItem,
  getSheetIndex,
  defaultLuckysheetSelectRanges,
} from '@sheet-engine/core';
import _ from 'lodash';
import { LucideIcon } from '@fileverse/ui';
import React, { useContext, useEffect, useRef } from 'react';
import WorkbookContext from '../../context';
import './index.css';
import SheetHiddenButton from './SheetHiddenButton';

type Props = {
  sheet: Sheet;
  isDropPlaceholder?: boolean;
};

const SheetListItem: React.FC<Props> = ({ sheet, isDropPlaceholder }) => {
  const { context, setContext, refs, settings } = useContext(WorkbookContext);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContext((draftCtx) => {
      const r = context.sheetScrollRecord[draftCtx?.currentSheetId];
      if (r) {
        draftCtx.scrollLeft = r.scrollLeft ?? 0;
        draftCtx.scrollTop = r.scrollTop ?? 0;
        draftCtx.luckysheet_select_status = r.luckysheet_select_status ?? false;
        draftCtx.luckysheet_select_save = r.luckysheet_select_save ?? undefined;
      } else {
        draftCtx.scrollLeft = 0;
        draftCtx.scrollTop = 0;
        draftCtx.luckysheet_select_status = false;
        if (settings.suppressInitialCellSelection) {
          draftCtx.luckysheet_select_save = undefined;
        } else {
          const sheetIdx = getSheetIndex(draftCtx, draftCtx.currentSheetId);
          const sh =
            sheetIdx != null ? draftCtx.luckysheetfile[sheetIdx] : undefined;
          if (sh) {
            if (!_.isEmpty(sh.luckysheet_select_save)) {
              draftCtx.luckysheet_select_save = sh.luckysheet_select_save;
            } else {
              draftCtx.luckysheet_select_save = defaultLuckysheetSelectRanges(
                sh.data,
              );
            }
          } else {
            draftCtx.luckysheet_select_save = undefined;
          }
        }
      }
      draftCtx.luckysheet_selection_range = [];
    });
  }, [
    context.currentSheetId,
    context.sheetScrollRecord,
    setContext,
    settings.suppressInitialCellSelection,
  ]);

  return (
    <div
      className="fortune-sheet-list-item flex items-center gap-2 px-2"
      key={sheet.id}
      ref={containerRef}
      onClick={() => {
        if (isDropPlaceholder) return;
        setContext((draftCtx) => {
          draftCtx.sheetScrollRecord[draftCtx.currentSheetId] = {
            scrollLeft: draftCtx.scrollLeft,
            scrollTop: draftCtx.scrollTop,
            luckysheet_select_status: draftCtx.luckysheet_select_status,
            luckysheet_select_save: draftCtx.luckysheet_select_save,
            luckysheet_selection_range: draftCtx.luckysheet_selection_range,
          };
          draftCtx.currentSheetId = sheet.id!;
          draftCtx.zoomRatio = sheet.zoomRatio || 1;
          cancelActiveImgItem(draftCtx, refs.globalCache);
          cancelNormalSelected(draftCtx);
        });
      }}
      tabIndex={0}
    >
      <span className="w-4">
        {sheet.id === context.currentSheetId && (
          <LucideIcon
            name="Check"
            size="sm"
            className="color-text-default w-4 h-4"
          />
        )}
      </span>
      {!!sheet.color && (
        <div
          className="luckysheet-sheets-list-item-color"
          style={{ background: sheet.color }}
        />
      )}
      <span
        className="luckysheet-sheets-item-name fortune-sheet-list-item-name"
        spellCheck="false"
      >
        <div>{sheet.name}</div>
      </span>
      {sheet.hide && <SheetHiddenButton sheet={sheet} />}
    </div>
  );
};

export default SheetListItem;
