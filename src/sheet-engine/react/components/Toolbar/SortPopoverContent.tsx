import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Context,
  indexToColumnChar,
  sortSelection,
  sortSheetBySelectedColumn,
} from '@sheet-engine/core';
import { LucideIcon } from '@fileverse/ui';
import { Option } from './Select';

export type SortLocaleLabels = {
  sortSheet: string;
  sortRange: string;
  sortSheetByColumnAZ: string;
  sortSheetByColumnZA: string;
  sortRangeByColumnAZ: string;
  sortRangeByColumnZA: string;
};

const SortPopoverContent: React.FC<{
  context: Context;
  setContext: (updater: (draftCtx: Context) => void) => void;
  sortLocale: SortLocaleLabels;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ context, setContext, sortLocale, setOpen }) => {
  const [submenu, setSubmenu] = useState<'sheet' | 'range' | null>(null);
  const rootMenuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const sortSheetItemRef = useRef<HTMLDivElement>(null);
  const sortRangeItemRef = useRef<HTMLDivElement>(null);
  const [submenuPos, setSubmenuPos] = useState<{
    left?: number;
    right?: number;
    top: number;
  }>({ left: 0, top: 0 });
  const selection = context.luckysheet_select_save?.[0];
  const selectedColumn = selection?.column_focus ?? selection?.column?.[0] ?? 0;
  const selectedColumnChar = indexToColumnChar(Math.max(0, selectedColumn));
  const selectedRangeStart = selection?.column?.[0] ?? selectedColumn;
  const rangeColIndex = Math.max(0, selectedColumn - selectedRangeStart);

  const sortSheetLabelAZ = (sortLocale.sortSheetByColumnAZ || '').replace(
    '{col}',
    selectedColumnChar,
  );
  const sortSheetLabelZA = (sortLocale.sortSheetByColumnZA || '').replace(
    '{col}',
    selectedColumnChar,
  );
  const sortRangeLabelAZ = (sortLocale.sortRangeByColumnAZ || '').replace(
    '{col}',
    selectedColumnChar,
  );
  const sortRangeLabelZA = (sortLocale.sortRangeByColumnZA || '').replace(
    '{col}',
    selectedColumnChar,
  );

  const runSortSheet = (isAsc: boolean) => {
    setContext((draftCtx: Context) => {
      sortSheetBySelectedColumn(draftCtx, isAsc);
    });
    setOpen(false);
  };

  const runSortRange = (isAsc: boolean) => {
    setContext((draftCtx: Context) => {
      sortSelection(draftCtx, isAsc, rangeColIndex);
    });
    setOpen(false);
  };

  const computeSubmenuPosition = useCallback(() => {
    if (!submenu) return;
    const viewportGap = 8;
    const rootRect = rootMenuRef.current?.getBoundingClientRect();
    const subRect = submenuRef.current?.getBoundingClientRect();
    const anchorRect =
      submenu === 'sheet'
        ? sortSheetItemRef.current?.getBoundingClientRect()
        : sortRangeItemRef.current?.getBoundingClientRect();
    if (!rootRect || !subRect || !anchorRect) return;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const preferredTop = anchorRect.top - rootRect.top;
    let top = preferredTop;
    if (anchorRect.top + subRect.height > winH - viewportGap) {
      top = Math.max(
        viewportGap - rootRect.top,
        winH - viewportGap - rootRect.top - subRect.height,
      );
    }

    const overflowsRight = rootRect.right + subRect.width > winW - viewportGap;
    if (overflowsRight) {
      setSubmenuPos({ right: rootRect.width, left: undefined, top });
      return;
    }
    setSubmenuPos({ left: rootRect.width, right: undefined, top });
  }, [submenu]);

  useEffect(() => {
    computeSubmenuPosition();
  }, [computeSubmenuPosition]);

  useEffect(() => {
    if (!submenu) return;
    const onResize = () => computeSubmenuPosition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [submenu, computeSubmenuPosition]);

  return (
    <div
      ref={rootMenuRef}
      className="fortune-toolbar-select fortune-toolbar-sort-root"
      style={{ minWidth: '220px', position: 'relative' }}
      onMouseLeave={() => setSubmenu(null)}
    >
      <div ref={sortSheetItemRef}>
        <Option
          onMouseEnter={() => setSubmenu('sheet')}
          onClick={() => setSubmenu('sheet')}
        >
          <div className="fortune-toolbar-menu-line">
            <span>{sortLocale.sortSheet}</span>
            <LucideIcon name="ChevronRight" className="w-4 h-4" />
          </div>
        </Option>
      </div>
      <div ref={sortRangeItemRef}>
        <Option
          onMouseEnter={() => setSubmenu('range')}
          onClick={() => setSubmenu('range')}
        >
          <div className="fortune-toolbar-menu-line">
            <span>{sortLocale.sortRange}</span>
            <LucideIcon name="ChevronRight" className="w-4 h-4" />
          </div>
        </Option>
      </div>
      {submenu && (
        <div
          ref={submenuRef}
          className="fortune-toolbar-select fortune-toolbar-sort-submenu"
          style={{
            position: 'absolute',
            left: submenuPos.left,
            right: submenuPos.right,
            top: submenuPos.top,
            minWidth: '320px',
          }}
        >
          <Option
            onClick={() =>
              submenu === 'sheet' ? runSortSheet(true) : runSortRange(true)
            }
          >
            <span>
              {submenu === 'sheet' ? sortSheetLabelAZ : sortRangeLabelAZ}
            </span>
          </Option>
          <Option
            onClick={() =>
              submenu === 'sheet' ? runSortSheet(false) : runSortRange(false)
            }
          >
            <span>
              {submenu === 'sheet' ? sortSheetLabelZA : sortRangeLabelZA}
            </span>
          </Option>
        </div>
      )}
    </div>
  );
};

export default SortPopoverContent;
