import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { useCallback, useContext, useMemo, useState } from 'react';
import { LucideIcon } from '@fileverse/ui';
import { HoverMenuItem } from './HoverMenuItem';
import WorkbookContext from '../../../context';
import {
  api,
  escapeHTMLTag,
  escapeScriptTag,
  functionHTMLGenerate,
  getFormulaEditorOwner,
  setFormulaEditorOwner,
  locale,
} from '@sheet-engine/core';
import {
  buildFormulaSuggestionText,
  setCursorPosition,
} from '../../SheetOverlay/helper';

const POPOVER_STYLE = {
  border: '1px solid hsl(var(--color-border-default, #E8EBEC))',
  boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.15)',
};

const QUICK_ACTIONS = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'] as const;

const TYPE_TO_CATEGORY_KEY: Record<number, string> = {
  0: 'Math',
  1: 'Statistical',
  2: 'Lookup',
  6: 'Date',
  8: 'Financial',
  9: 'Engineering',
  10: 'Logical',
  11: 'Operator',
  12: 'Text',
  13: 'Engineering',
  14: 'Array',
  15: 'Info',
  16: 'Operator',
  17: 'Database',
  20: 'Crypto',
};

const CATEGORY_ORDER = [
  'All',
  'Array',
  'Database',
  'Date',
  'Engineering',
  'Financial',
  'Info',
  'Logical',
  'Lookup',
  'Math',
  'Operator',
  'Parser',
  'Statistical',
  'Text',
  'Crypto',
  'Other',
] as const;

type FunctionLocaleItem = {
  n?: string;
  t?: number | string;
};

type OutsideEvent = {
  target: EventTarget | null;
  preventDefault: () => void;
};

const isFromFunctionListSubmenuTarget = (target: EventTarget | null) => {
  return Boolean(
    target instanceof HTMLElement &&
    target.closest('[data-hovermenu-submenu="true"]'),
  );
};

export const FunctionList = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const [isFunctionOpen, setIsFunctionOpen] = useState<boolean>(false);
  const [openSampleCategory, setOpenSampleCategory] = useState<string | null>(
    null,
  );

  const insertFormulaIntoActiveCell = useCallback(
    (formulaName: string) => {
      if (context.allowEdit === false || context.isFlvReadOnly === true) {
        setIsFunctionOpen(false);
        setOpenSampleCategory(null);
        return;
      }

      const selection = context.luckysheet_select_save?.[0];
      const row = selection?.row_focus ?? 0;
      const col = selection?.column_focus ?? 0;

      // If there's no selection yet, establish one (A1) before entering edit mode.
      if (!selection) {
        setContext((draftCtx) => {
          api.setSelection(draftCtx, [{ row: [0, 0], column: [0, 0] }], {
            id: draftCtx.currentSheetId,
          });
        });
      }

      const owner =
        context.luckysheetCellUpdate.length > 0
          ? getFormulaEditorOwner(context)
          : 'cell';

      refs.globalCache.doNotFocus = true;
      refs.globalCache.doNotUpdateCell = true;

      setContext((draftCtx) => {
        setFormulaEditorOwner(draftCtx, owner);
        draftCtx.luckysheetCellUpdate = [row, col];
      });

      requestAnimationFrame(() => {
        const cellEditor = refs.cellInput.current;
        const fxEditor = refs.fxInput.current;
        const target = owner === 'fx' ? fxEditor : cellEditor;
        if (!target) return;

        const upper = String(formulaName || '')
          .trim()
          .toUpperCase();
        const { text: baseText, caretOffset: baseCaret } =
          buildFormulaSuggestionText(target, `=${upper}`);

        const caretInsideParen = baseText.slice(baseCaret).startsWith('(')
          ? baseCaret + 1
          : baseCaret;

        const nextText =
          baseText[caretInsideParen] === ')'
            ? baseText
            : `${baseText.slice(0, caretInsideParen)})${baseText.slice(caretInsideParen)}`;

        const safeText = escapeScriptTag(nextText);
        const html = safeText.startsWith('=')
          ? functionHTMLGenerate(safeText)
          : escapeHTMLTag(safeText);

        if (cellEditor) cellEditor.innerHTML = html;
        if (fxEditor) fxEditor.innerHTML = html;

        setCursorPosition(target, caretInsideParen);
        target.focus({ preventScroll: true });
      });

      setIsFunctionOpen(false);
      setOpenSampleCategory(null);
    },
    [context, refs.cellInput, refs.fxInput, refs.globalCache, setContext],
  );

  const groupedFunctions = useMemo(() => {
    const functionlist =
      (locale(context).functionlist as unknown as FunctionLocaleItem[]) || [];

    const byCategory = new Map<string, Set<string>>();

    for (const item of functionlist) {
      const name = (item?.n ? String(item.n) : '').trim();
      if (!name) continue;

      const typeId = Number(item?.t);
      const categoryKey =
        typeId === 11 ? 'Operator' : TYPE_TO_CATEGORY_KEY[typeId] || 'Other';

      if (!byCategory.has(categoryKey)) byCategory.set(categoryKey, new Set());
      byCategory.get(categoryKey)!.add(name);
    }

    // Synthetic "All" category.
    const all = new Set<string>();
    for (const set of byCategory.values()) {
      for (const fn of set) all.add(fn);
    }
    byCategory.set('All', all);

    const toSortedArray = (set: Set<string> | undefined) =>
      set ? Array.from(set).sort((a, b) => a.localeCompare(b)) : [];

    return {
      categories: CATEGORY_ORDER.filter(
        (k) => k === 'All' || (byCategory.get(k)?.size ?? 0) > 0,
      ),
      getFunctions: (categoryKey: string) =>
        toSortedArray(byCategory.get(categoryKey)),
    };
  }, [context]);

  return (
    <div>
      <Popover
        open={isFunctionOpen}
        onOpenChange={(open: boolean) => {
          setIsFunctionOpen(open);
          if (!open) setOpenSampleCategory(null);
        }}
      >
        <PopoverTrigger asChild>
          <div className="flex items-center justify-center w-[30px] h-[30px] hover:!color-bg-default-hover rounded">
            <LucideIcon name="Sigma" className="w-[16px] h-[16px]" />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-full p-2 border-[1px] border-solid border-[var(--color-border-default,#E8EBEC)] min-w-[240px]"
          elevation={2}
          side="bottom"
          sideOffset={4}
          style={POPOVER_STYLE}
          // Nested submenus render in their own Popover (portal). Without this,
          // Radix can treat entering the submenu as an "outside interaction" and
          // close the parent popover immediately.
          onInteractOutside={(e: OutsideEvent) => {
            if (isFromFunctionListSubmenuTarget(e.target)) e.preventDefault();
          }}
          onPointerDownOutside={(e: OutsideEvent) => {
            if (isFromFunctionListSubmenuTarget(e.target)) e.preventDefault();
          }}
          onFocusOutside={(e: OutsideEvent) => {
            if (isFromFunctionListSubmenuTarget(e.target)) e.preventDefault();
          }}
        >
          <div className="color-text-default">
            {QUICK_ACTIONS.map((action) => (
              <HoverMenuItem
                key={action}
                label={action}
                onClick={() => {
                  insertFormulaIntoActiveCell(action);
                }}
              />
            ))}
            <hr className="color-border-default my-1" />
            {groupedFunctions.categories.map((categoryKey) => (
              <HoverMenuItem
                key={categoryKey}
                label={categoryKey}
                rightSlot={
                  <LucideIcon
                    name="ChevronRight"
                    className="w-[17px] h-[17px]"
                  />
                }
                open={openSampleCategory === categoryKey}
                onOpenChange={(open: boolean) => {
                  if (open) {
                    setOpenSampleCategory(categoryKey);
                    return;
                  }

                  // If the user has already moved to another category, ignore stale
                  // close events coming from the previous category's delayed timer.
                  setOpenSampleCategory((current) =>
                    current === categoryKey ? null : current,
                  );
                }}
                contentStyle={{
                  ...POPOVER_STYLE,
                  minWidth: '220px',
                  maxHeight: '360px',
                  overflowY: 'auto',
                }}
                renderSubmenu={() => (
                  <div className="flex flex-col">
                    {groupedFunctions.getFunctions(categoryKey).map((fn) => (
                      <HoverMenuItem
                        key={fn}
                        label={fn}
                        onClick={() => {
                          insertFormulaIntoActiveCell(fn);
                        }}
                      />
                    ))}
                  </div>
                )}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
