import { DatePicker, cn } from '@fileverse/ui';
import {
  detectDateFormat,
  getDateBaseLocale,
  getCellValue,
  getFlowdata,
  getFormulaEditorOwner,
  moveHighlightCell,
  moveToEnd,
  updateCell,
} from '@sheet-engine/core';
import React, { useCallback, useContext, useMemo } from 'react';
import WorkbookContext from '../../context';

export type CellDatePickerVariant = 'cell' | 'fx';

function mergePickedDateWithPreservedTime(
  picked: Date,
  previousBase: string,
): string {
  const isUsDateBase = getDateBaseLocale() === 'us';
  const dd = String(picked.getDate()).padStart(2, '0');
  const mm = String(picked.getMonth() + 1).padStart(2, '0');
  const yyyy = picked.getFullYear();
  const trimmed = previousBase.trim();
  const prev = detectDateFormat(trimmed);
  const hadTime =
    prev != null &&
    (prev.hours !== 0 ||
      prev.minutes !== 0 ||
      prev.seconds !== 0 ||
      /\d{1,2}\s*:\s*\d{2}/.test(trimmed));
  if (hadTime && prev) {
    const h = prev.hours;
    const mi = prev.minutes;
    const s = prev.seconds;
    const baseDate = isUsDateBase
      ? `${mm}/${dd}/${yyyy}`
      : `${dd}/${mm}/${yyyy}`;
    return `${baseDate} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return isUsDateBase ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
}

/**
 * Fileverse UI date picker shown below the in-cell editor when editing a date cell
 * (same general area as formula hint). Inserts canonical base date format (with time
 * preserved when the current base value includes time).
 */
const CellDatePicker: React.FC<{ variant?: CellDatePickerVariant }> = ({
  variant = 'cell',
}) => {
  const { context, refs, setContext } = useContext(WorkbookContext);

  const active = useMemo(() => {
    if (context.luckysheetCellUpdate.length !== 2) return null;
    const [r, c] = context.luckysheetCellUpdate;
    const d = getFlowdata(context);
    const cell = d?.[r]?.[c];
    if (cell?.ct?.t !== 'd') return null;
    return { r, c, cell };
  }, [
    context.luckysheetCellUpdate,
    context.currentSheetId,
    context.luckysheetfile,
  ]);

  const owner = getFormulaEditorOwner(context);
  const ownerMatchesVariant =
    variant === 'cell' ? owner !== 'fx' : owner === 'fx';

  const activeEditor =
    variant === 'fx' ? refs.fxInput.current : refs.cellInput.current;
  const editorText = activeEditor?.innerText?.trim() ?? '';
  const isFormulaLike = editorText.startsWith('=');

  const selectedDay = useMemo(() => {
    if (!active) return undefined;
    const { r, c, cell } = active;
    const d = getFlowdata(context);
    if (!d) return undefined;
    const parseDateCandidate = (candidate: unknown) => {
      const text = String(candidate ?? '').trim();
      if (!text) return null;
      const parsed = detectDateFormat(text);
      if (!parsed) return null;
      return new Date(parsed.year, parsed.month - 1, parsed.day);
    };
    // In edit mode, prioritize the live editor text so picker month/day stays in sync
    // with what the user is currently typing, not just the last persisted cell value.
    const fromEditorText = parseDateCandidate(editorText);
    if (fromEditorText) return fromEditorText;
    const fromDisplay = parseDateCandidate(cell?.m);
    if (fromDisplay) return fromDisplay;
    const fromFormulaBase = parseDateCandidate(getCellValue(r, c, d, 'f'));
    if (fromFormulaBase) return fromFormulaBase;
    const fromValue = parseDateCandidate(getCellValue(r, c, d, 'v'));
    if (fromValue) return fromValue;
    const fromDisplayValue = parseDateCandidate(getCellValue(r, c, d, 'm'));
    if (fromDisplayValue) return fromDisplayValue;
    if (typeof cell?.v === 'number' && Number.isFinite(cell.v)) {
      const excelEpochUtc = Date.UTC(1899, 11, 30);
      return new Date(excelEpochUtc + Math.round(cell.v * 24 * 60 * 60 * 1000));
    }
    return new Date();
  }, [active, context, editorText]);

  const onSelect = useCallback(
    (picked: Date | undefined) => {
      if (!picked || !active) return;
      const editor =
        variant === 'fx' ? refs.fxInput.current : refs.cellInput.current;
      if (!editor) return;

      const { r, c } = active;
      const d = getFlowdata(context);
      if (!d) return;
      const prevBase = String(getCellValue(r, c, d, 'f') ?? '');
      const merged = mergePickedDateWithPreservedTime(picked, prevBase);

      const sel = window.getSelection();
      if (
        sel &&
        sel.rangeCount > 0 &&
        !sel.isCollapsed &&
        editor.contains(sel.anchorNode)
      ) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(merged));
      } else {
        editor.textContent = merged;
      }

      editor.dispatchEvent(new Event('input', { bubbles: true }));
      moveToEnd(editor);
      // Date picker selection is a complete edit action; commit immediately and
      // leave edit mode so the picker panel closes right away.
      setContext((draftCtx) => {
        updateCell(draftCtx, active.r, active.c, editor);
        moveHighlightCell(draftCtx, 'down', 0, 'rangeOfSelect');
      });
    },
    [active, context, refs.cellInput, refs.fxInput, setContext, variant],
  );

  if (!active || isFormulaLike || !ownerMatchesVariant) {
    return null;
  }

  return (
    <div
      className={cn(
        'luckysheet-cell-date-picker-panel',
        'pointer-events-auto rounded-lg border border-black/10 bg-white p-2 shadow-md',
      )}
      style={{
        zIndex: 1005,
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        width: 320,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <DatePicker
        key={`${selectedDay?.getTime() ?? 0}-${active.r}-${active.c}`}
        mode="single"
        selected={selectedDay}
        defaultMonth={selectedDay}
        onSelect={onSelect}
      />
    </div>
  );
};

export default CellDatePicker;
