import { locale, getRangetxt, isValidRangeText } from '@sheet-engine/core';
import { Button, cn, IconButton, TextField } from '@fileverse/ui';
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import WorkbookContext from '../../context';
import './index.css';

const parseRangeValues = (value: string): string[] => {
  const ranges = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return ranges.length > 0 ? ranges : [''];
};

const RangeDialog: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const { dataVerification, button, findAndReplace } = locale(context);
  const [rangeValues, setRangeValues] = useState<string[]>(['']);
  const [focusedRangeIndex, setFocusedRangeIndex] = useState<number | null>(
    null,
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogPosition, setDialogPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  /** Snapshot of grid A1 range when a row is focused; input updates only when selection differs from this. */
  const lastSyncedGridRangeRef = useRef<string>('');

  const clampPosition = useCallback((left: number, top: number) => {
    const el = dialogRef.current;
    const w = el?.offsetWidth ?? 360;
    const h = el?.offsetHeight ?? 200;
    const margin = 8;
    const maxL = Math.max(margin, window.innerWidth - w - margin);
    const maxT = Math.max(margin, window.innerHeight - h - margin);
    return {
      left: Math.min(maxL, Math.max(margin, left)),
      top: Math.min(maxT, Math.max(margin, top)),
    };
  }, []);

  const getActiveSelectionRange = useCallback((): string => {
    const selections = context.luckysheet_select_save ?? [];
    if (selections.length <= 0) return '';
    const activeRange = selections[selections.length - 1];
    return getRangetxt(
      context,
      context.currentSheetId,
      activeRange,
      context.currentSheetId,
    ).trim();
  }, [context, context.currentSheetId, context.luckysheet_select_save]);

  const close = useCallback(() => {
    const rangeDialogType = context.rangeDialog?.type ?? '';
    dragRef.current = null;
    setDialogPosition(null);
    setContext((ctx) => {
      if (ctx.rangeDialog) {
        ctx.rangeDialog.show = false;
        ctx.rangeDialog.singleSelect = false;
      }
    });

    if (rangeDialogType === 'searchRange') {
      return;
    }

    document.getElementById('data-verification-button')?.click();
    if (rangeDialogType.indexOf('between') >= 0) {
      document.getElementById('conditional-format-button')?.click();
      return;
    }
    if (rangeDialogType.indexOf('conditionRules') >= 0) {
      document.getElementById('conditional-format-button')?.click();
    }
  }, [setContext, context.rangeDialog?.type]);

  useLayoutEffect(() => {
    if (!context.rangeDialog?.show) return undefined;
    const apply = () => {
      const el = dialogRef.current;
      const w = el?.offsetWidth ?? 360;
      const h = el?.offsetHeight ?? 200;
      setDialogPosition(
        clampPosition((window.innerWidth - w) / 2, window.innerHeight * 0.12),
      );
    };
    apply();
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  }, [context.rangeDialog?.show, clampPosition]);

  useEffect(() => {
    if (!context.rangeDialog?.show) return;
    const defaultRanges = parseRangeValues(context.rangeDialog?.rangeTxt ?? '');
    setRangeValues(defaultRanges);
    setFocusedRangeIndex(null);
    lastSyncedGridRangeRef.current = '';
  }, [context.rangeDialog?.show, context.rangeDialog?.rangeTxt]);

  useEffect(() => {
    if (!context.rangeDialog?.show) return;
    if (focusedRangeIndex === null) return;
    const activeSelection = getActiveSelectionRange();
    if (!activeSelection) return;
    if (activeSelection === lastSyncedGridRangeRef.current) return;
    lastSyncedGridRangeRef.current = activeSelection;
    setRangeValues((prev) => {
      const next = prev.length > 0 ? [...prev] : [''];
      const targetIndex = Math.min(
        Math.max(focusedRangeIndex, 0),
        next.length - 1,
      );
      next[targetIndex] = activeSelection;
      return next;
    });
  }, [
    context.rangeDialog?.show,
    context.luckysheet_select_save,
    focusedRangeIndex,
    getActiveSelectionRange,
  ]);

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (dialogPosition === null) return;
    e.preventDefault();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: dialogPosition.left,
      startTop: dialogPosition.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setDialogPosition(clampPosition(d.startLeft + dx, d.startTop + dy));
  };

  const onHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const rangeDialogCombined = rangeValues
    .map((v) => v.trim())
    .filter(Boolean)
    .join(',');
  const isRangeDialogRangeValid = isValidRangeText(
    context,
    rangeDialogCombined,
  );
  const showRangeTextError =
    rangeDialogCombined !== '' && !isRangeDialogRangeValid;

  return (
    <div
      ref={dialogRef}
      id="range-dialog"
      className={cn(
        'fortune-dialog fortune-range-dialog',
        dialogPosition && 'fortune-range-dialog--positioned',
      )}
      data-testid="range-dialog"
      style={
        dialogPosition
          ? {
              left: dialogPosition.left,
              top: dialogPosition.top,
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      tabIndex={0}
    >
      <div
        className={cn(
          'fortune-range-dialog__header fortune-range-dialog__header--draggable flex items-center justify-between border-b color-border-default py-3 px-6',
        )}
        data-testid="range-dialog-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div
          className="fortune-range-dialog__heading text-heading-sm"
          data-testid="range-dialog-heading"
        >
          {context.rangeDialog?.type === 'searchRange'
            ? findAndReplace.selectDataRangeTitle
            : dataVerification.selectCellRange}
        </div>
        <IconButton
          icon="X"
          variant="ghost"
          onClick={close}
          tabIndex={0}
          className="fortune-range-dialog__icon fortune-range-dialog__icon--close"
          data-testid="range-dialog-icon-close"
        />
      </div>
      <div
        className="fortune-range-dialog__para px-6 pb-4 pt-4 text-body-sm"
        data-testid="range-dialog-para"
      >
        <div className="flex flex-col gap-2">
          {rangeValues.map((rangeValue, index) => (
            <div
              key={`range-${index}`}
              className="flex flex-row items-center gap-2 w-full min-w-0"
            >
              <TextField
                className={cn(
                  'w-full min-w-0 flex-1',
                  showRangeTextError &&
                    'ring-1 ring-[hsl(var(--color-border-negative))] rounded-md',
                )}
                placeholder={
                  context.rangeDialog?.type === 'searchRange'
                    ? findAndReplace.rangeInputPlaceholder
                    : dataVerification.selectCellRange2
                }
                value={rangeValue}
                onFocus={() => {
                  setFocusedRangeIndex(index);
                  lastSyncedGridRangeRef.current = getActiveSelectionRange();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                onChange={(e) => {
                  const { value } = e.target;
                  setRangeValues((prev) => {
                    const next = [...prev];
                    next[index] = value;
                    return next;
                  });
                }}
              />
              <IconButton
                icon="Trash2"
                variant="ghost"
                size="md"
                aria-label="Remove range"
                className="fortune-range-dialog__remove-range shrink-0 border-0 shadow-none text-[hsl(var(--color-icon-secondary))]"
                data-testid={`range-dialog-remove-range-${index}`}
                onClick={() => {
                  setRangeValues((prev) => {
                    const next = prev.filter((_, j) => j !== index);
                    return next.length > 0 ? next : [''];
                  });
                  setFocusedRangeIndex((fi) => {
                    if (fi === null) return null;
                    if (fi === index) return null;
                    if (fi > index) return fi - 1;
                    return fi;
                  });
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="fortune-range-dialog__add-range justify-start self-start"
            style={{ minWidth: '80px', width: '50%' }}
            data-testid="range-dialog-add-range"
            onClick={() => {
              setRangeValues((prev) => [...prev, '']);
            }}
          >
            Add another range
          </Button>
          {showRangeTextError ? (
            <p
              className="text-body-xs text-[hsl(var(--color-text-negative))] mt-1"
              role="alert"
            >
              {dataVerification.invalidRangeText}
            </p>
          ) : null}
        </div>
      </div>
      <div
        className="fortune-range-dialog__actions px-6 pb-6 flex flex-row gap-2 justify-end"
        data-testid="range-dialog-actions"
      >
        <Button
          variant="secondary"
          className="fortune-range-dialog__cta fortune-range-dialog__cta--close"
          style={{ minWidth: '80px' }}
          onClick={close}
          tabIndex={0}
          data-testid="range-dialog-cta-close"
        >
          {button.close}
        </Button>
        <Button
          variant="default"
          className="fortune-range-dialog__cta fortune-range-dialog__cta--confirm"
          style={{ minWidth: '80px' }}
          disabled={showRangeTextError}
          onClick={() => {
            if (showRangeTextError) return;
            const normalizedRangeTxt = rangeValues
              .map((value) => value.trim())
              .filter(Boolean)
              .join(',');
            setContext((ctx) => {
              ctx.rangeDialog!.rangeTxt = normalizedRangeTxt;
            });
            close();
          }}
          tabIndex={0}
          data-testid="range-dialog-cta-confirm"
        >
          {button.confirm}
        </Button>
      </div>
    </div>
  );
};

export default RangeDialog;
