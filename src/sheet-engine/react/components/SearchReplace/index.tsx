import {
  api,
  locale,
  searchAll,
  searchNext,
  SearchResult,
  normalizeSelection,
  replace,
  replaceAllScoped,
  scrollToHighlightCell,
  getSearchIndexArr,
  getFlowdata,
  changeSheet,
  CheckModes,
  getSheetIndex,
  getFindRangeOnCurrentSheet,
  parseRangeText,
  replaceHtml,
  type CellMatrix,
  type FindSearchScope,
  type HyperlinkMap,
  type ReplaceScope,
  type Selection,
} from '@sheet-engine/core';
import {
  Button,
  Checkbox,
  cn,
  Divider,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextField,
} from '@fileverse/ui';
import produce from 'immer';
import React, {
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import _ from 'lodash';
import WorkbookContext from '../../context';
import { useAlert } from '../../hooks/useAlert';
import './index.css';

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 10;

const LARGE_REPLACE_THRESHOLD = 100;

function fullSheetRangeForData(
  flowdata: CellMatrix | undefined,
  sheetRow?: number,
  sheetColumn?: number,
): { row: number[]; column: number[] }[] | null {
  const rowCountFromData = flowdata?.length ?? 0;
  const colCountFromData = flowdata?.[0]?.length ?? 0;
  const rowCount =
    rowCountFromData > 0 ? rowCountFromData : Math.max(0, sheetRow ?? 0);
  const colCount =
    colCountFromData > 0 ? colCountFromData : Math.max(0, sheetColumn ?? 0);
  if (rowCount <= 0 || colCount <= 0) return null;
  return [{ row: [0, rowCount - 1], column: [0, colCount - 1] }];
}

const SearchReplace: React.FC<{
  getContainer: () => HTMLDivElement;
}> = ({ getContainer }) => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const { findAndReplace } = locale(context);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>();
  const [inlineInfo, setInlineInfo] = useState<string | null>(null);
  const { showAlert } = useAlert();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dragTranslate, setDragTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragTranslateRef = useRef(dragTranslate);
  dragTranslateRef.current = dragTranslate;
  const dragSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const wasDialogOpenRef = useRef(false);
  const contextRef = useRef(context);
  contextRef.current = context;

  // Fix 5: track scroll position for virtual list
  const [scrollTop, setScrollTop] = useState(0);

  const [checkMode, checkModeReplace] = useState<CheckModes>({
    regCheck: false,
    wordCheck: false,
    caseCheck: false,
    formulaCheck: false,
    linkCheck: false,
  });
  const [searchScope, setSearchScope] = useState<FindSearchScope>('allSheets');
  const replaceScope: ReplaceScope =
    searchScope === 'allSheets' ? 'allSheets' : 'thisSheet';
  const [rangeText, setRangeText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);

  /** Returns the parsed Selection when scope is specificRange, or undefined otherwise. */
  const getScopedRange = useCallback((): Selection | undefined => {
    if (searchScope !== 'specificRange') return undefined;
    const parsed = parseRangeText(rangeText, contextRef.current);
    return parsed ?? undefined;
  }, [searchScope, rangeText]);

  /** Validates the range input; returns true if valid (or scope is not specificRange). */
  const validateRangeInput = useCallback((): boolean => {
    if (searchScope !== 'specificRange') return true;
    if (!rangeText.trim()) {
      setRangeError(findAndReplace.rangeInputInvalidError);
      return false;
    }
    const parsed = parseRangeText(rangeText, contextRef.current);
    if (!parsed) {
      setRangeError(findAndReplace.rangeInputInvalidError);
      return false;
    }
    setRangeError(null);
    return true;
  }, [searchScope, rangeText, findAndReplace.rangeInputInvalidError]);

  const closeDialog = useCallback(() => {
    _.set(refs.globalCache, 'searchDialog.mouseEnter', false);
    setContext((draftCtx) => {
      draftCtx.showSearch = false;
      draftCtx.showReplace = false;
      draftCtx.findReplacePrefill = undefined;
      draftCtx.searchRangeScopeHighlight = null;
      draftCtx.searchRangeScopeEmphasis = false;
      draftCtx.showFormulasFromFindReplace = false;
      draftCtx.findReplaceHiddenDuringRangePick = false;
      draftCtx.findReplaceRestoreVisibility = undefined;
    });
  }, [refs.globalCache, setContext]);

  useEffect(() => {
    const open = !!(context.showSearch || context.showReplace);
    const enabled = open && !!checkMode.formulaCheck;
    if (!!context.showFormulasFromFindReplace === enabled) return;
    setContext((d) => {
      d.showFormulasFromFindReplace = enabled;
    });
  }, [
    context.showSearch,
    context.showReplace,
    context.showFormulasFromFindReplace,
    checkMode.formulaCheck,
    setContext,
  ]);

  useEffect(() => {
    if (!(context.showSearch || context.showReplace)) return;
    const pre = context.findReplacePrefill;
    if (pre == null || pre === '') return;
    setSearchText(pre);
    setInlineInfo(null);
    setContext((d) => {
      d.findReplacePrefill = undefined;
    });
  }, [
    context.showSearch,
    context.showReplace,
    context.findReplacePrefill,
    setContext,
  ]);

  useEffect(() => {
    if (!(context.showSearch || context.showReplace)) return;
    setInlineInfo(null);
  }, [context.showSearch, context.showReplace]);

  const clampTranslate = useCallback(
    (tx: number, ty: number) => {
      const container = getContainer();
      const dialog = dialogRef.current;
      if (!container || !dialog) return { x: tx, y: ty };
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const dw = dialog.offsetWidth;
      const dh = dialog.offsetHeight;
      const loX = Math.min((dw - cw) / 2, (cw - dw) / 2);
      const hiX = Math.max((dw - cw) / 2, (cw - dw) / 2);
      const loY = Math.min((dh - ch) / 2, (ch - dh) / 2);
      const hiY = Math.max((dh - ch) / 2, (ch - dh) / 2);
      return {
        x: Math.min(hiX, Math.max(loX, tx)),
        y: Math.min(hiY, Math.max(loY, ty)),
      };
    },
    [getContainer],
  );

  useEffect(() => {
    const open = !!(
      context.showSearch ||
      context.showReplace ||
      context.findReplaceHiddenDuringRangePick
    );
    if (open && !wasDialogOpenRef.current) {
      setDragTranslate({ x: 0, y: 0 });
    }
    wasDialogOpenRef.current = open;
  }, [
    context.showSearch,
    context.showReplace,
    context.findReplaceHiddenDuringRangePick,
  ]);

  useEffect(() => {
    const open = !!(
      context.showSearch ||
      context.showReplace ||
      context.findReplaceHiddenDuringRangePick
    );
    if (!open) return;
    const el = getContainer();
    const ro = new ResizeObserver(() => {
      setDragTranslate((t) => clampTranslate(t.x, t.y));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    context.showSearch,
    context.showReplace,
    context.findReplaceHiddenDuringRangePick,
    getContainer,
    clampTranslate,
  ]);

  const endHeaderDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    dragSessionRef.current = null;
    setIsDragging(false);
    document.body.style.userSelect = '';
    (document.body.style as { webkitUserSelect?: string }).webkitUserSelect =
      '';
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button')) return;
      const t = dragTranslateRef.current;
      dragSessionRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTx: t.x,
        startTy: t.y,
      };
      setIsDragging(true);
      document.body.style.userSelect = 'none';
      (document.body.style as { webkitUserSelect?: string }).webkitUserSelect =
        'none';
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;
      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      setDragTranslate(
        clampTranslate(session.startTx + dx, session.startTy + dy),
      );
    },
    [clampTranslate],
  );

  useEffect(
    () => () => {
      dragSessionRef.current = null;
      document.body.style.userSelect = '';
      (document.body.style as { webkitUserSelect?: string }).webkitUserSelect =
        '';
    },
    [],
  );

  const setCheckMode = useCallback(
    (mode: string, value: boolean) =>
      checkModeReplace(
        produce((draft) => {
          _.set(draft, mode, value);
        }),
      ),
    [],
  );

  // Fix 5: virtual list helpers
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT));
  const endIdx = Math.min(startIdx + VISIBLE_ROWS + 2, searchResult.length);
  const visibleItems = searchResult.slice(startIdx, endIdx);
  const totalHeight = searchResult.length * ROW_HEIGHT;

  // When scope switches to specificRange, pre-populate rangeText from current selection.
  const prevScopeRef = useRef<FindSearchScope>(searchScope);
  useEffect(() => {
    if (
      searchScope === 'specificRange' &&
      prevScopeRef.current !== 'specificRange'
    ) {
      const sel = context.luckysheet_select_save;
      if (sel && sel.length > 0) {
        const last = sel[sel.length - 1]!;
        const c1 = last.column[0]!;
        const c2 = last.column[1]!;
        const r1 = last.row[0]!;
        const r2 = last.row[1]!;
        // Convert to A1 notation: chatatABC is not available here, use simple letter fn
        const colToLetter = (n: number): string => {
          let s = '';
          let col = n + 1;
          while (col > 0) {
            const rem = (col - 1) % 26;
            s = String.fromCharCode(65 + rem) + s;
            col = Math.floor((col - 1) / 26);
          }
          return s;
        };
        setRangeText(`${colToLetter(c1)}${r1 + 1}:${colToLetter(c2)}${r2 + 1}`);
      }
    }
    if (searchScope !== 'specificRange') {
      setRangeError(null);
      setContext((draftCtx) => {
        draftCtx.searchRangeScopeHighlight = null;
        draftCtx.searchRangeScopeEmphasis = false;
      });
    }
    prevScopeRef.current = searchScope;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchScope]);

  // Sync scope highlight into context whenever rangeText changes (debounced).
  useEffect(() => {
    if (
      !(
        context.showSearch ||
        context.showReplace ||
        context.findReplaceHiddenDuringRangePick
      )
    )
      return;
    if (searchScope !== 'specificRange') return;
    const t = setTimeout(() => {
      const parsed = parseRangeText(rangeText, contextRef.current);
      setContext((draftCtx) => {
        draftCtx.searchRangeScopeHighlight = parsed
          ? { row: parsed.row, column: parsed.column }
          : null;
        // New/edited range: show the lighter border until the user runs Find.
        draftCtx.searchRangeScopeEmphasis = false;
      });
    }, 150);
    return () => clearTimeout(t);
  }, [
    rangeText,
    searchScope,
    context.showSearch,
    context.showReplace,
    context.findReplaceHiddenDuringRangePick,
    context.currentSheetId,
    setContext,
  ]);

  // After the range dialog closes, restore Find & Replace visibility and apply range.
  useEffect(() => {
    const rd = context.rangeDialog;
    if (!rd || rd.show || rd.type !== 'searchRange') return;

    const restoreVis = context.findReplaceRestoreVisibility;
    if (context.findReplaceHiddenDuringRangePick && restoreVis) {
      setContext((d) => {
        d.showSearch = restoreVis.showSearch;
        d.showReplace = restoreVis.showReplace;
        d.findReplaceHiddenDuringRangePick = false;
        d.findReplaceRestoreVisibility = undefined;
      });
    }

    if (rd.rangeTxt) {
      setRangeText(rd.rangeTxt.trim());
      setRangeError(null);
    }
  }, [
    context.rangeDialog,
    context.findReplaceHiddenDuringRangePick,
    context.findReplaceRestoreVisibility,
    setContext,
  ]);

  /** Execute a do-replace wrapped in a confirmation for large counts (Fix 15) */
  const doReplaceAll = useCallback(() => {
    setContext((draftCtx) => {
      setSelectedCell(undefined);
      const result = replaceAllScoped(
        draftCtx,
        searchText,
        replaceText,
        checkMode,
        replaceScope,
      );
      if (!result.ok) {
        setInlineInfo(result.message);
        return;
      }
      const { findAndReplace: fr } = locale(draftCtx);
      const find = searchText;
      const replace = replaceText;
      if (result.skipped > 0) {
        setInlineInfo(
          replaceHtml(fr.replaceAllSuccessWithSkippedInfotext, {
            n: result.replaced,
            skipped: result.skipped,
            find,
            replace,
          }),
        );
      } else {
        setInlineInfo(
          replaceHtml(fr.replaceAllSuccessInfotext, {
            n: result.replaced,
            find,
            replace,
          }),
        );
      }
    });
  }, [checkMode, replaceScope, replaceText, searchText, setContext]);

  const runFindNext = useCallback(
    (direction: 'next' | 'prev') => {
      if (!validateRangeInput()) return;
      const scopedRange = getScopedRange();
      setContext((draftCtx) => {
        if (searchScope === 'specificRange') {
          draftCtx.searchRangeScopeEmphasis = true;
        }
        setSearchResult([]);
        const result = searchNext(
          draftCtx,
          searchText,
          checkMode,
          searchScope,
          direction,
          scopedRange,
        );
        if (result.alertMsg === findAndReplace.noFindTip) {
          setInlineInfo(result.alertMsg);
          return;
        }
        setInlineInfo(null);
        if (result.alertMsg != null) showAlert(result.alertMsg);
      });
    },
    [
      checkMode,
      findAndReplace.noFindTip,
      getScopedRange,
      searchScope,
      searchText,
      setContext,
      showAlert,
      validateRangeInput,
    ],
  );

  const workbookReadOnly = context.allowEdit === false || context.isFlvReadOnly;

  const findReplaceUiSuspended =
    !!context.findReplaceHiddenDuringRangePick &&
    !context.showSearch &&
    !context.showReplace;

  if (findReplaceUiSuspended) {
    return null;
  }

  return (
    <div
      id="fortune-search-replace"
      ref={dialogRef}
      className="fortune-search-replace fortune-dialog"
      style={{
        top: '50%',
        left: '50%',
        transform: `translate(calc(-50% + ${dragTranslate.x}px), calc(-50% + ${dragTranslate.y}px))`,
      }}
      onMouseEnter={() => {
        _.set(refs.globalCache, 'searchDialog.mouseEnter', true);
      }}
      onMouseLeave={() => {
        _.set(refs.globalCache, 'searchDialog.mouseEnter', false);
      }}
    >
      <div>
        <div
          className={cn(
            'fortune-search-replace-header flex items-center justify-between border-b color-border-default py-3 px-6',
            isDragging && 'fortune-search-replace-header--dragging',
          )}
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endHeaderDrag}
          onPointerCancel={endHeaderDrag}
        >
          <h3 className="text-heading-sm">Find and replace</h3>
          <IconButton
            icon="X"
            variant="ghost"
            onClick={closeDialog}
            tabIndex={0}
          />
        </div>
        <div className="px-6 pb-6 pt-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4">
              <div
                id="searchInput"
                className="flex flex-row gap-2 items-center"
              >
                <span className="find-replace-label text-heading-xsm">
                  {findAndReplace.findTextbox}：
                </span>
                <TextField
                  ref={searchInputRef}
                  className="formulaInputFocus"
                  autoFocus
                  spellCheck="false"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      runFindNext(e.shiftKey ? 'prev' : 'next');
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      closeDialog();
                      return;
                    }
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    if (
                      e.target === searchInputRef.current ||
                      searchInputRef.current?.contains(e.target as Node)
                    ) {
                      e.stopPropagation();
                    }
                  }}
                  value={searchText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchText(v);
                    setInlineInfo(null);
                    if (v.length === 0) setSearchResult([]);
                  }}
                />
              </div>
              <div
                id="replaceInput"
                className="flex flex-row gap-2 items-center"
              >
                <span className="find-replace-label text-heading-xsm">
                  {findAndReplace.replaceTextbox}：
                </span>
                <TextField
                  ref={replaceInputRef}
                  className="formulaInputFocus"
                  spellCheck="false"
                  disabled={workbookReadOnly}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      runFindNext(e.shiftKey ? 'prev' : 'next');
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      closeDialog();
                      return;
                    }
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    if (
                      e.target === replaceInputRef.current ||
                      replaceInputRef.current?.contains(e.target as Node)
                    ) {
                      e.stopPropagation();
                    }
                  }}
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                />
              </div>
              <div className="flex flex-row gap-2 items-center min-w-0">
                <span className="find-replace-label text-heading-xsm shrink-0">
                  {findAndReplace.searchScopeLabel}：
                </span>
                <Select
                  value={searchScope}
                  onValueChange={(v) => setSearchScope(v as FindSearchScope)}
                >
                  <SelectTrigger className="w-44 shrink-0 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allSheets">
                      {findAndReplace.searchScopeAllSheets}
                    </SelectItem>
                    <SelectItem value="thisSheet">
                      {findAndReplace.searchScopeThisSheet}
                    </SelectItem>
                    <SelectItem value="specificRange">
                      {findAndReplace.searchScopeSpecificRange}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {searchScope === 'specificRange' && (
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="find-replace-range-field relative min-w-0 flex-1">
                      <TextField
                        className="formulaInputFocus min-w-0 w-full [&_input]:pr-10"
                        spellCheck="false"
                        placeholder={findAndReplace.rangeInputPlaceholder}
                        value={rangeText}
                        onChange={(e) => {
                          setRangeText(e.target.value);
                          setRangeError(null);
                        }}
                        onBlur={() => {
                          if (rangeText.trim()) {
                            setRangeText(rangeText.trim().toUpperCase());
                          }
                          validateRangeInput();
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      <IconButton
                        type="button"
                        className="absolute right-1 top-1/2 z-[1] -translate-y-1/2"
                        icon="LayoutGrid"
                        variant="ghost"
                        title={findAndReplace.rangeSelectOnSheetTitle}
                        aria-label={findAndReplace.rangeSelectOnSheetTitle}
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          _.set(
                            refs.globalCache,
                            'searchDialog.mouseEnter',
                            false,
                          );
                          setContext((draftCtx) => {
                            draftCtx.findReplaceRestoreVisibility = {
                              showSearch: !!draftCtx.showSearch,
                              showReplace: !!draftCtx.showReplace,
                            };
                            draftCtx.findReplaceHiddenDuringRangePick = true;
                            draftCtx.showSearch = false;
                            draftCtx.showReplace = false;

                            const trimmed = rangeText.trim();
                            if (trimmed) {
                              const parsed = parseRangeText(trimmed, draftCtx);
                              if (parsed) {
                                api.setSelection(draftCtx, [parsed], {});
                              }
                            }
                            draftCtx.rangeDialog = {
                              show: true,
                              rangeTxt: trimmed,
                              type: 'searchRange',
                              singleSelect: false,
                            };
                          });
                        }}
                      />
                    </div>
                    {rangeError && (
                      <div className="find-replace-range-error text-body-sm">
                        {rangeError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-row gap-2">
              <div className="find-replace-label" />
              <div className="flex flex-col gap-2 text-body-sm">
                <div
                  id="caseCheck"
                  className="flex flex-row gap-2 items-center"
                >
                  <Checkbox
                    className="border-2"
                    checked={checkMode.caseCheck}
                    onCheckedChange={(e) =>
                      setCheckMode('caseCheck', e.target.checked)
                    }
                  />
                  <span>{findAndReplace.distinguishTextbox}</span>
                </div>
                <div
                  id="wordCheck"
                  className="flex flex-row gap-2 items-center"
                >
                  <Checkbox
                    className="border-2"
                    checked={checkMode.wordCheck}
                    onCheckedChange={(e) =>
                      setCheckMode('wordCheck', e.target.checked)
                    }
                  />
                  <span>{findAndReplace.wholeTextbox}</span>
                </div>
                <div id="regCheck" className="flex flex-row gap-2 items-center">
                  <Checkbox
                    className="border-2"
                    checked={checkMode.regCheck}
                    onCheckedChange={(e) =>
                      setCheckMode('regCheck', e.target.checked)
                    }
                  />
                  <span>{findAndReplace.regexTextbox}</span>
                </div>
                <div
                  id="formulaCheck"
                  className="flex flex-row gap-2 items-center"
                >
                  <Checkbox
                    className="border-2"
                    checked={checkMode.formulaCheck}
                    onCheckedChange={(e) =>
                      setCheckMode('formulaCheck', e.target.checked)
                    }
                  />
                  <span>{findAndReplace.formulaTextbox}</span>
                </div>
                <div
                  id="linkCheck"
                  className="flex flex-row gap-2 items-center"
                >
                  <Checkbox
                    className="border-2"
                    checked={checkMode.linkCheck}
                    onCheckedChange={(e) =>
                      setCheckMode('linkCheck', e.target.checked)
                    }
                  />
                  <span>{findAndReplace.linkTextbox}</span>
                </div>
              </div>
            </div>
            <div
              className={cn(
                'find-replace-inline-info',
                !inlineInfo && 'find-replace-inline-info--empty',
              )}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {inlineInfo || ''}
            </div>
            <div className="flex flex-row gap-2 justify-end items-center mb-4 flex-wrap">
              <Button
                id="searchNextBtn"
                variant="default"
                className="min-w-fit"
                onClick={() => {
                  runFindNext('next');
                }}
                tabIndex={0}
                disabled={searchText.length === 0}
              >
                {findAndReplace.findBtn}
              </Button>
              <Button
                id="searchAllBtn"
                variant="secondary"
                className="min-w-fit"
                onClick={() => {
                  if (!validateRangeInput()) return;
                  const scopedRange = getScopedRange();
                  setContext((draftCtx) => {
                    if (searchScope === 'specificRange') {
                      draftCtx.searchRangeScopeEmphasis = true;
                    }
                    setSelectedCell(undefined);
                    if (!searchText) return;
                    const res = searchAll(
                      draftCtx,
                      searchText,
                      checkMode,
                      searchScope,
                      scopedRange,
                    );
                    setSearchResult(res);
                    if (_.isEmpty(res)) {
                      setInlineInfo(findAndReplace.noFindTip);
                    } else {
                      setInlineInfo(null);
                    }
                  });
                }}
                tabIndex={0}
                disabled={searchText.length === 0}
              >
                {findAndReplace.allFindBtn}
              </Button>
              <Button
                id="replaceBtn"
                variant="secondary"
                className="min-w-fit"
                onClick={() => {
                  if (!validateRangeInput()) return;
                  setContext((draftCtx) => {
                    setSelectedCell(undefined);
                    const alertMsg = replace(
                      draftCtx,
                      searchText,
                      replaceText,
                      checkMode,
                    );
                    setInlineInfo(null);
                    if (alertMsg != null) {
                      showAlert(alertMsg);
                    }
                  });
                }}
                tabIndex={0}
                disabled={
                  searchText.length === 0 ||
                  replaceText.length === 0 ||
                  workbookReadOnly
                }
              >
                {findAndReplace.replaceBtn}
              </Button>
              <Button
                id="replaceAllBtn"
                variant="secondary"
                className="min-w-fit"
                onClick={() => {
                  if (!validateRangeInput()) return;
                  let matchCount = 0;
                  if (replaceScope === 'allSheets') {
                    for (const sheet of context.luckysheetfile) {
                      const data = sheet.data;
                      if (!data) continue;
                      const range = fullSheetRangeForData(
                        data,
                        sheet.row,
                        sheet.column,
                      );
                      if (range == null) continue;
                      matchCount += getSearchIndexArr(
                        searchText,
                        range,
                        data,
                        checkMode,
                        sheet.hyperlink as HyperlinkMap | undefined,
                      ).length;
                    }
                  } else {
                    const flowdata = getFlowdata(context);
                    if (!flowdata) {
                      doReplaceAll();
                      return;
                    }
                    const range = getFindRangeOnCurrentSheet(flowdata);
                    if (range == null) return;
                    const sheetIdx = getSheetIndex(
                      context,
                      context.currentSheetId,
                    );
                    const hyperlinkMap = (
                      sheetIdx != null
                        ? context.luckysheetfile[sheetIdx]?.hyperlink
                        : undefined
                    ) as HyperlinkMap | undefined;
                    matchCount = getSearchIndexArr(
                      searchText,
                      range,
                      flowdata,
                      checkMode,
                      hyperlinkMap,
                    ).length;
                  }

                  if (matchCount > 0) {
                    if (matchCount >= LARGE_REPLACE_THRESHOLD) {
                      const msg = `Replace ${matchCount} cells?`;
                      showAlert(msg, 'yesno', doReplaceAll);
                      return;
                    }
                  }
                  doReplaceAll();
                }}
                tabIndex={0}
                disabled={
                  searchText.length === 0 ||
                  replaceText.length === 0 ||
                  workbookReadOnly
                }
              >
                {findAndReplace.allReplaceBtn}
              </Button>
            </div>
          </div>

          {searchResult.length > 0 && (
            <>
              <Divider className="w-full border-t-[1px] mb-4" />
              {/* Fix 5: Virtualized results table */}
              <div
                ref={tableContainerRef}
                className="mb-6 table-container overflow-y-auto"
                style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT }}
                onMouseDown={(e) => {
                  if (
                    e.target === tableContainerRef.current ||
                    tableContainerRef.current?.contains(e.target as Node)
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                    tableContainerRef.current?.focus();
                  }
                }}
                onWheel={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (tableContainerRef.current) {
                    tableContainerRef.current.scrollTop += e.deltaY;
                    setScrollTop(tableContainerRef.current.scrollTop);
                  }
                }}
                onScroll={(e) => {
                  setScrollTop((e.target as HTMLDivElement).scrollTop);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                tabIndex={0}
              >
                <Table id="searchAllbox">
                  <TableHeader className="color-bg-secondary">
                    <TableRow>
                      <TableHead>{findAndReplace.searchTargetSheet}</TableHead>
                      <TableHead>{findAndReplace.searchTargetCell}</TableHead>
                      <TableHead>{findAndReplace.searchTargetValue}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Spacer above visible rows */}
                    {startIdx > 0 && (
                      <tr
                        aria-hidden
                        style={{ height: startIdx * ROW_HEIGHT }}
                      />
                    )}
                    {visibleItems.map((v) => (
                      <TableRow
                        style={{ height: ROW_HEIGHT }}
                        className={cn(
                          _.isEqual(selectedCell, { r: v.r, c: v.c })
                            ? 'color-bg-default-selected'
                            : '',
                        )}
                        key={`${v.sheetId}-${v.cellPosition}`}
                        onClick={() => {
                          setContext((draftCtx) => {
                            // Fix 8: Switch to the result's sheet if needed
                            if (v.sheetId !== draftCtx.currentSheetId) {
                              const toIdx = getSheetIndex(draftCtx, v.sheetId);
                              if (toIdx != null) {
                                draftCtx.luckysheetfile[
                                  toIdx
                                ].luckysheet_select_save = [
                                    {
                                      row: [v.r, v.r],
                                      column: [v.c, v.c],
                                      row_focus: v.r,
                                      column_focus: v.c,
                                    },
                                  ];
                              }
                              changeSheet(draftCtx, v.sheetId);
                            }
                            draftCtx.luckysheet_select_save =
                              normalizeSelection(draftCtx, [
                                {
                                  row: [v.r, v.r],
                                  column: [v.c, v.c],
                                },
                              ]);
                            scrollToHighlightCell(draftCtx, v.r, v.c);
                          });
                          setSelectedCell({ r: v.r, c: v.c });
                        }}
                        tabIndex={0}
                      >
                        <TableCell className="find-replace-table-cell">
                          {v.sheetName}
                        </TableCell>
                        <TableCell className="find-replace-table-cell">
                          {v.cellPosition}
                        </TableCell>
                        <TableCell className="find-replace-table-cell">
                          {v.value}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Spacer below visible rows */}
                    {endIdx < searchResult.length && (
                      <tr
                        aria-hidden
                        style={{
                          height: (searchResult.length - endIdx) * ROW_HEIGHT,
                        }}
                      />
                    )}
                  </TableBody>
                </Table>
                {/* Invisible full-height div to give the scrollbar the right total height */}
                <div
                  aria-hidden
                  style={{
                    height: totalHeight,
                    position: 'absolute',
                    top: 0,
                    width: 1,
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchReplace;
