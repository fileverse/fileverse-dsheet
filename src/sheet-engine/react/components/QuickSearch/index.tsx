import {
  getFlowdata,
  locale,
  scrollToHighlightCell,
  getQuickSearchIndexArr,
  shouldQuickSearchUseAsync,
  runQuickSearchIndexArrAsync,
  type Context,
} from '@sheet-engine/core';
import { IconButton, TextField, cn } from '@fileverse/ui';
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

const DEBOUNCE_MS = 125;

const QuickSearchBar: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const contextRef = useRef<Context>(context);
  contextRef.current = context;

  const { findAndReplace } = locale(context);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null);
  const hadQuickSearchOpenRef = useRef(false);

  const closeQuickSearch = useCallback(() => {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    setQuery('');
    setContext((d) => {
      d.showQuickSearch = false;
      d.quickSearchHighlight = null;
      d.quickSearchLoading = false;
    });
  }, [setContext]);

  useLayoutEffect(() => {
    if (!context.showQuickSearch) return;
    refs.globalCache.quickSearchReturnFocus = document.activeElement;
  }, [
    context.showQuickSearch,
    context.quickSearchFocusNonce,
    refs.globalCache,
  ]);

  useLayoutEffect(() => {
    if (!context.showQuickSearch) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [context.showQuickSearch, context.quickSearchFocusNonce]);

  useEffect(() => {
    if (context.showQuickSearch) {
      hadQuickSearchOpenRef.current = true;
      return;
    }
    if (!hadQuickSearchOpenRef.current) return;
    hadQuickSearchOpenRef.current = false;

    const el = refs.globalCache.quickSearchReturnFocus;
    refs.globalCache.quickSearchReturnFocus = null;
    if (el instanceof HTMLElement) {
      el.focus();
    } else {
      refs.workbookContainer.current?.focus();
    }
  }, [context.showQuickSearch, refs]);

  useEffect(() => {
    if (!context.showQuickSearch) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      scanAbortRef.current?.abort();
      scanAbortRef.current = null;

      const ctx = contextRef.current;
      const flowdata = getFlowdata(ctx);
      if (!flowdata) {
        setContext((d) => {
          d.quickSearchHighlight = null;
          d.quickSearchLoading = false;
        });
        return;
      }

      const q = query.trim();
      if (!q) {
        setContext((d) => {
          d.quickSearchHighlight = null;
          d.quickSearchLoading = false;
        });
        return;
      }

      if (shouldQuickSearchUseAsync(flowdata)) {
        setContext((d) => {
          d.quickSearchLoading = true;
        });
        scanAbortRef.current = runQuickSearchIndexArrAsync(
          ctx,
          q,
          flowdata,
          (partial) => {
            setContext((d) => {
              d.quickSearchHighlight = {
                matches: partial,
                activeIndex: Math.min(
                  d.quickSearchHighlight?.activeIndex ?? 0,
                  Math.max(0, partial.length - 1),
                ),
              };
            });
          },
          (all) => {
            setContext((d) => {
              d.quickSearchLoading = false;
              d.quickSearchHighlight = {
                matches: all,
                activeIndex: all.length > 0 ? 0 : 0,
              };
            });
            scanAbortRef.current = null;
          },
        );
      } else {
        const matches = getQuickSearchIndexArr(ctx, q, flowdata);
        setContext((d) => {
          d.quickSearchLoading = false;
          d.quickSearchHighlight = {
            matches,
            activeIndex: matches.length > 0 ? 0 : 0,
          };
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    query,
    context.currentSheetId,
    context.showQuickSearch,
    context.luckysheetCellUpdate.length,
    setContext,
    refs.globalCache.undoList.length,
    refs.globalCache.redoList.length,
  ]);

  useEffect(
    () => () => {
      scanAbortRef.current?.abort();
    },
    [],
  );

  const hl = context.quickSearchHighlight;
  const matchCount = hl?.matches.length ?? 0;
  const activeIdx = hl?.activeIndex ?? 0;
  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && !context.quickSearchLoading && matchCount === 0;

  const goNext = useCallback(() => {
    if (!hl || hl.matches.length === 0) return;
    setContext((d) => {
      const h = d.quickSearchHighlight;
      if (!h || h.matches.length === 0) return;
      const next = (h.activeIndex + 1) % h.matches.length;
      d.quickSearchHighlight = { ...h, activeIndex: next };
      const { r, c } = h.matches[next]!;
      scrollToHighlightCell(d, r, c);
    });
  }, [hl, setContext]);

  const goPrev = useCallback(() => {
    if (!hl || hl.matches.length === 0) return;
    setContext((d) => {
      const h = d.quickSearchHighlight;
      if (!h || h.matches.length === 0) return;
      const next = (h.activeIndex - 1 + h.matches.length) % h.matches.length;
      d.quickSearchHighlight = { ...h, activeIndex: next };
      const { r, c } = h.matches[next]!;
      scrollToHighlightCell(d, r, c);
    });
  }, [hl, setContext]);

  const openFindReplace = useCallback(() => {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    const q = query.trim();
    setQuery('');
    setContext((d) => {
      d.showQuickSearch = false;
      d.quickSearchHighlight = null;
      d.quickSearchLoading = false;
      d.findReplacePrefill = q;
      d.showSearch = true;
      d.showReplace = false;
    });
  }, [query, setContext]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) goPrev();
      else goNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeQuickSearch();
    } else {
      e.stopPropagation();
    }
  };

  const liveMsg =
    !hasQuery || context.quickSearchLoading
      ? ''
      : matchCount === 0
        ? findAndReplace.quickSearchNoResults
        : findAndReplace.quickSearchMatchCountAria
            .replace('{current}', String(activeIdx + 1))
            .replace('{total}', String(matchCount));

  return (
    <div
      role="dialog"
      aria-label={findAndReplace.quickSearchDialogAria}
      className="fortune-quick-search"
    >
      <div
        className={cn(
          'fortune-quick-search-field',
          noResults && 'fortune-quick-search-field--error',
        )}
      >
        <div className="fortune-quick-search-input-wrap">
          <TextField
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={findAndReplace.quickSearchPlaceholder}
            className="fortune-quick-search-input"
            spellCheck={false}
            aria-invalid={noResults}
          />
        </div>
        <div
          className="fortune-quick-search-counter"
          aria-live="polite"
          aria-atomic="true"
        >
          {context.quickSearchLoading ? (
            <span className="fortune-quick-search-loading">
              {findAndReplace.quickSearchSearching}
            </span>
          ) : !hasQuery ? null : noResults ? (
            findAndReplace.quickSearchNoResults
          ) : (
            findAndReplace.quickSearchCounterTemplate
              .replace('{current}', String(activeIdx + 1))
              .replace('{total}', String(matchCount))
          )}
        </div>
      </div>
      <span className="fortune-quick-search-sr-only">{liveMsg}</span>
      <IconButton
        type="button"
        icon="ChevronUp"
        variant="ghost"
        className="fortune-quick-search-icon-btn"
        aria-label={findAndReplace.quickSearchPrevAria}
        disabled={matchCount === 0}
        onClick={goPrev}
      />
      <IconButton
        type="button"
        icon="ChevronDown"
        variant="ghost"
        className="fortune-quick-search-icon-btn"
        aria-label={findAndReplace.quickSearchNextAria}
        disabled={matchCount === 0}
        onClick={goNext}
      />
      <IconButton
        type="button"
        icon="EllipsisVertical"
        variant="ghost"
        className="fortune-quick-search-icon-btn"
        title={findAndReplace.quickSearchMoreOptionsTitle}
        aria-label={findAndReplace.quickSearchOpenFindReplaceAria}
        onClick={openFindReplace}
      />
      <IconButton
        type="button"
        icon="X"
        variant="ghost"
        className="fortune-quick-search-icon-btn"
        aria-label={findAndReplace.quickSearchCloseAria}
        onClick={closeQuickSearch}
      />
    </div>
  );
};

export default QuickSearchBar;
