import {
  getFlowdata,
  cancelNormalSelected,
  getCellValue,
  updateCell,
  getInlineStringNoStyle,
  isInlineStringCell,
  escapeScriptTag,
  moveHighlightCell,
  handleFormulaInput,
  rangeHightlightselected,
  valueShowEs,
  isShowHidenCR,
  escapeHTMLTag,
  isAllowEdit,
} from "@sheet-engine/core";
import React, {
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import "./index.css";
import _ from "lodash";
import WorkbookContext from "../../context";
import ContentEditable from "../SheetOverlay/ContentEditable";
import NameBox from "./NameBox";
import FormulaSearch from "../../components/SheetOverlay/FormulaSearch";
import FormulaHint from "../../components/SheetOverlay/FormulaHint";
import usePrevious from "../../hooks/usePrevious";
import { LucideIcon } from "../../components/SheetOverlay/LucideIcon";

import {
  countCommasBeforeCursor,
  isLetterNumberPattern,
  moveCursorToEnd,
} from "../../components/SheetOverlay/helper";

const FxEditor: React.FC = () => {
  const hideFormulaHintLocal = localStorage.getItem("formulaMore") === "true";
  const [showSearchHint, setShowSearchHint] = useState(false);
  const [showFormulaHint, setShowFormulaHint] = useState(!hideFormulaHintLocal);
  const [commaCount, setCommaCount] = useState(0);
  const { context, setContext, refs } = useContext(WorkbookContext);
  const lastKeyDownEventRef = useRef<KeyboardEvent | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [isHidenRC, setIsHidenRC] = useState<boolean>(false);
  const firstSelection = context.luckysheet_select_save?.[0];
  const prevFirstSelection = usePrevious(firstSelection);
  const prevSheetId = usePrevious(context.currentSheetId);
  const recentText = useRef("");

  const handleShowFormulaHint = () => {
    localStorage.setItem("formulaMore", String(showFormulaHint));
    setShowFormulaHint(!showFormulaHint);
  };

  useEffect(() => {
    // 当选中行列是处于隐藏状态的话则不允许编辑
    setIsHidenRC(isShowHidenCR(context));
    if (
      _.isEqual(prevFirstSelection, firstSelection) &&
      context.currentSheetId === prevSheetId
    ) {
      // data change by a collabrative update should not trigger this effect
      return;
    }
    const d = getFlowdata(context);
    let value = "";
    if (firstSelection) {
      const r = firstSelection.row_focus;
      const c = firstSelection.column_focus;
      if (_.isNil(r) || _.isNil(c)) return;

      const cell = d?.[r]?.[c];
      if (cell) {
        if (isInlineStringCell(cell)) {
          value = getInlineStringNoStyle(r, c, d);
        } else if (cell.f) {
          value = getCellValue(r, c, d, "f");
        } else {
          value = valueShowEs(r, c, d);
        }
      }
      refs.fxInput.current!.innerHTML = escapeHTMLTag(escapeScriptTag(value));
    } else {
      refs.fxInput.current!.innerHTML = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.luckysheetfile,
    context.currentSheetId,
    context.luckysheet_select_save,
  ]);

  const onFocus = useCallback(() => {
    if (context.allowEdit === false) {
      return;
    }
    if (
      (context.luckysheet_select_save?.length ?? 0) > 0 &&
      !context.luckysheet_cell_selected_move &&
      isAllowEdit(context, context.luckysheet_select_save)
    ) {
      setContext((draftCtx) => {
        const last =
          draftCtx.luckysheet_select_save![
            draftCtx.luckysheet_select_save!.length - 1
          ];

        const row_index = last.row_focus;
        const col_index = last.column_focus;

        draftCtx.luckysheetCellUpdate = [row_index, col_index];
        refs.globalCache.doNotFocus = true;
        // formula.rangeResizeTo = $("#luckysheet-functionbox-cell");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.config,
    context.luckysheet_select_save,
    context.luckysheetfile,
    context.currentSheetId,
    refs.globalCache,
    setContext,
  ]);

  const getActiveFormula = useCallback(
    () => document.querySelector(".luckysheet-formula-search-item-active"),
    []
  );
  const insertSelectedFormula = useCallback(
    (formulaName: string) => {
      const ht = `<span dir="auto" class="luckysheet-formula-text-color">=</span><span dir="auto" class="luckysheet-formula-text-func">${formulaName}</span><span dir="auto" class="luckysheet-formula-text-lpar">(</span>`;
      refs.fxInput.current!.innerHTML = ht;
      const cellEditor = document.getElementById("luckysheet-rich-text-editor");
      if (cellEditor) {
        cellEditor.innerHTML = ht;
      }

      moveCursorToEnd(refs.fxInput.current!);
      setContext((draftCtx) => {
        draftCtx.functionCandidates = [];
        draftCtx.defaultCandidates = [];
        draftCtx.functionHint = formulaName;
      });
    },
    [setContext]
  );

  const clearSearchItemActiveClass = useCallback(() => {
    const activeFormula = getActiveFormula();
    if (activeFormula) {
      activeFormula.classList.remove("luckysheet-formula-search-item-active");
    }
  }, [getActiveFormula]);

  const getLastInputSpanText = () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div>${refs.fxInput?.current?.innerHTML}</div>`,
      "text/html"
    );
    const spans = doc.querySelectorAll("span");
    const lastSpan = spans[spans.length - 1];
    return lastSpan?.innerText;
  };

  const selectActiveFormulaOnClick = useCallback(
    (e: React.MouseEvent) => {
      // @ts-expect-error later
      if (e.target.className.includes("sign-fortune")) return;
      recentText.current = refs.fxInput?.current!.innerText;
      const formulaName = getActiveFormula()?.querySelector(
        ".luckysheet-formula-search-func"
      )?.textContent;
      const lastSpanText = getLastInputSpanText();

      if (formulaName && !isLetterNumberPattern(lastSpanText)) {
        insertSelectedFormula(formulaName);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [getActiveFormula, insertSelectedFormula]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (context.allowEdit === false) {
        return;
      }
      const currentCommaCount = countCommasBeforeCursor(refs.fxInput?.current!);
      setCommaCount(currentCommaCount);
      lastKeyDownEventRef.current = new KeyboardEvent(e.type, e.nativeEvent);
      const { key } = e;
      recentText.current = refs.fxInput.current!.innerText;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        e.stopPropagation();
      }

      if (
        (e.key === "Enter" || e.key === "Tab") &&
        context.luckysheetCellUpdate.length > 0
      ) {
        if (e.altKey || e.metaKey) {
          // originally `enterKeyControll`
          document.execCommand("insertHTML", false, "\n "); // 换行符后面的空白符是为了强制让他换行，在下一步的delete中会删掉
          document.execCommand("delete", false);
          e.stopPropagation();
        } else {
          const event = e as unknown;
          selectActiveFormulaOnClick(event as React.MouseEvent);
        }
        return;
      }

      if (e.key === "ArrowUp" && context.luckysheetCellUpdate.length > 0) {
        if (document.getElementById("luckysheet-formula-search-c")) {
          const formulaSearchContainer = document.getElementById(
            "luckysheet-formula-search-c"
          );
          const activeItem = formulaSearchContainer?.querySelector(
            ".luckysheet-formula-search-item-active"
          );
          let previousItem = activeItem
            ? activeItem.previousElementSibling
            : null;
          while (
            previousItem &&
            !previousItem.classList.contains("luckysheet-formula-search-item")
          ) {
            previousItem = previousItem.previousElementSibling;
          }
          if (!previousItem) {
            const items = formulaSearchContainer?.querySelectorAll(
              ".luckysheet-formula-search-item"
            );
            const lastItem = items?.[items.length - 1];
            previousItem = lastItem || null;
          }
          clearSearchItemActiveClass();
          if (previousItem) {
            previousItem.classList.add("luckysheet-formula-search-item-active");
          }
        }
        e.preventDefault();
      } else if (
        e.key === "ArrowDown" &&
        context.luckysheetCellUpdate.length > 0
      ) {
        if (document.getElementById("luckysheet-formula-search-c")) {
          const formulaSearchContainer = document.getElementById(
            "luckysheet-formula-search-c"
          );
          const activeItem = formulaSearchContainer?.querySelector(
            ".luckysheet-formula-search-item-active"
          );
          let nextItem = activeItem ? activeItem.nextElementSibling : null;
          while (
            nextItem &&
            !nextItem.classList.contains("luckysheet-formula-search-item")
          ) {
            nextItem = nextItem.nextElementSibling;
          }
          if (!nextItem) {
            nextItem =
              formulaSearchContainer?.querySelector(
                ".luckysheet-formula-search-item"
              ) || null;
          }
          clearSearchItemActiveClass();
          if (nextItem) {
            nextItem.classList.add("luckysheet-formula-search-item-active");
          }
        }
        e.preventDefault();
      }

      setContext((draftCtx) => {
        if (context.luckysheetCellUpdate.length > 0) {
          switch (key) {
            case "Enter": {
              // if (
              //   $("#luckysheet-formula-search-c").is(":visible") &&
              //   formula.searchFunctionCell != null
              // ) {
              //   formula.searchFunctionEnter(
              //     $("#luckysheet-formula-search-c").find(
              //       ".luckysheet-formula-search-item-active"
              //     )
              //   );
              // } else {
              const lastCellUpdate = _.clone(draftCtx.luckysheetCellUpdate);
              updateCell(
                draftCtx,
                draftCtx.luckysheetCellUpdate[0],
                draftCtx.luckysheetCellUpdate[1],
                refs.fxInput.current!
              );
              draftCtx.luckysheet_select_save = [
                {
                  row: [lastCellUpdate[0], lastCellUpdate[0]],
                  column: [lastCellUpdate[1], lastCellUpdate[1]],
                  row_focus: lastCellUpdate[0],
                  column_focus: lastCellUpdate[1],
                },
              ];
              moveHighlightCell(draftCtx, "down", 1, "rangeOfSelect");
              // $("#luckysheet-rich-text-editor").focus();
              // }
              e.preventDefault();
              e.stopPropagation();
              break;
            }
            case "Escape": {
              cancelNormalSelected(draftCtx);
              moveHighlightCell(draftCtx, "down", 0, "rangeOfSelect");
              // $("#luckysheet-functionbox-cell").blur();
              // $("#luckysheet-rich-text-editor").focus();
              e.preventDefault();
              e.stopPropagation();
              break;
            }
            /*
              case "F4": {
                formula.setfreezonFuc(event);
                e.preventDefault();
                e.stopPropagation();
                break;
              }
              case "ArrowUp": {
                if ($("#luckysheet-formula-search-c").is(":visible")) {
                  let $up = $("#luckysheet-formula-search-c")
                    .find(".luckysheet-formula-search-item-active")
                    .prev();
                  if ($up.length === 0) {
                    $up = $("#luckysheet-formula-search-c")
                      .find(".luckysheet-formula-search-item")
                      .last();
                  }
                  $("#luckysheet-formula-search-c")
                    .find(".luckysheet-formula-search-item")
                    .removeClass("luckysheet-formula-search-item-active");
                  $up.addClass("luckysheet-formula-search-item-active");
                }
                e.preventDefault();
                e.stopPropagation();
                break;
              }
              case "ArrowDown": {
                if ($("#luckysheet-formula-search-c").is(":visible")) {
                  let $up = $("#luckysheet-formula-search-c")
                    .find(".luckysheet-formula-search-item-active")
                    .next();
                  if ($up.length === 0) {
                    $up = $("#luckysheet-formula-search-c")
                      .find(".luckysheet-formula-search-item")
                      .first();
                  }
                  $("#luckysheet-formula-search-c")
                    .find(".luckysheet-formula-search-item")
                    .removeClass("luckysheet-formula-search-item-active");
                  $up.addClass("luckysheet-formula-search-item-active");
                }
                e.preventDefault();
                e.stopPropagation();
                break;
              }
              */
            case "ArrowLeft": {
              rangeHightlightselected(draftCtx, refs.fxInput.current!);
              break;
            }
            case "ArrowRight": {
              rangeHightlightselected(draftCtx, refs.fxInput.current!);
              break;
            }
            default:
              break;
          }
        }
      });
    },
    [
      context.allowEdit,
      context.luckysheetCellUpdate.length,
      refs.fxInput,
      setContext,
    ]
  );

  const handleHideShowHint = () => {
    const el = document.getElementsByClassName("cell-hint")?.[0];
    const fxHint = document.getElementsByClassName("fx-hint")?.[0];
    const searchElFx = document.getElementsByClassName("fx-search")?.[0];
    const searchElCell = document.getElementsByClassName("cell-search")?.[0];
    if (searchElFx) {
      // @ts-ignore
      searchElFx.style.display = "block";
    }
    if (searchElCell) {
      // @ts-ignore
      searchElCell.style.display = "none";
    }
    if (el) {
      // @ts-ignore
      el.style.display = "none";
    }
    if (fxHint) {
      // @ts-ignore
      fxHint.style.display = "block";
    }
  };

  const onChange = useCallback(() => {
    if (context.isFlvReadOnly) return;
    handleHideShowHint();
    if (
      refs.fxInput?.current?.innerText.includes("=") &&
      /^=?[A-Za-z]*$/.test(getLastInputSpanText())
    ) {
      setShowSearchHint(true);
    } else {
      setShowSearchHint(false);
    }

    const currentCommaCount = countCommasBeforeCursor(refs.fxInput?.current!);
    setCommaCount(currentCommaCount);
    const e = lastKeyDownEventRef.current;
    if (!e) return;
    const kcode = e.keyCode;
    if (!kcode) return;

    if (
      !(
        (kcode >= 112 && kcode <= 123) ||
        kcode <= 46 ||
        kcode === 144 ||
        kcode === 108 ||
        e.ctrlKey ||
        e.altKey ||
        (e.shiftKey &&
          (kcode === 37 || kcode === 38 || kcode === 39 || kcode === 40))
      ) ||
      kcode === 8 ||
      kcode === 32 ||
      kcode === 46 ||
      (e.ctrlKey && kcode === 86)
    ) {
      setContext((draftCtx) => {
        handleFormulaInput(
          draftCtx,
          refs.cellInput.current!,
          refs.fxInput.current!,
          kcode,
          recentText.current
        );
      });
    }
  }, [refs.cellInput, refs.fxInput, setContext]);

  // Helper function to extract function name from input text
  const getFunctionNameFromInput = useCallback(() => {
    const inputText = refs.fxInput?.current?.innerText || "";
    if (!inputText.startsWith("=")) return null;

    // Try to find function name pattern: =FUNCTIONNAME(
    const functionMatch = inputText.match(/^=([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (functionMatch) {
      return functionMatch[1].toUpperCase();
    }

    // Also check if there's a function with class luckysheet-formula-text-func in the HTML
    if (refs.fxInput?.current) {
      const funcSpan = refs.fxInput.current.querySelector(
        ".luckysheet-formula-text-func"
      );
      if (funcSpan) {
        return funcSpan.textContent?.toUpperCase() || null;
      }
    }

    return null;
  }, []);

  // Get function name from context.functionHint (current cursor position) or from input text
  const functionName = context.functionHint || getFunctionNameFromInput();

  // Get function object using the detected function name
  const fn = functionName
    ? context.formulaCache.functionlistMap[functionName]
    : null;

  const allowEdit = useMemo(() => {
    if (context.allowEdit === false) {
      return false;
    }
    if (isHidenRC) {
      return false;
    }
    if (!isAllowEdit(context, context.luckysheet_select_save)) {
      return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.config,
    context.luckysheet_select_save,
    context.luckysheetfile,
    context.currentSheetId,
    isHidenRC,
  ]);

  const divRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = divRef.current!.offsetHeight;

    const onMouseMove = (ev: MouseEvent) => {
      const newHeight = startHeight + (ev.clientY - startY);
      divRef.current!.style.height = `${Math.max(newHeight, 20)}px`; // min height = 100
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div>
      <div className="fortune-fx-editor" ref={divRef}>
        <NameBox />
        <div
          className="fortune-fx-icon"
          style={{ cursor: "pointer" }}
          onClick={() => {
            document.getElementById("function-button")?.click();
          }}
        >
          {/* <SVGIcon name="fx" width={18} height={18} /> */}
          <LucideIcon
            name="DSheetOnlyText"
            fill="black"
            style={{
              width: "14px",
              height: "14px",
              margin: "auto",
              marginTop: "1px",
            }}
          />
        </div>
        <div ref={inputContainerRef} className="fortune-fx-input-container">
          <ContentEditable
            onMouseUp={() => {
              handleHideShowHint();
              const currentCommaCount = countCommasBeforeCursor(
                refs.fxInput?.current!
              );
              setCommaCount(currentCommaCount);
            }}
            innerRef={(e) => {
              refs.fxInput.current = e;
            }}
            className="fortune-fx-input"
            id="luckysheet-functionbox-cell"
            aria-autocomplete="list"
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            onChange={onChange}
            // onBlur={() => setFocused(false)}
            tabIndex={0}
            allowEdit={allowEdit && !context.isFlvReadOnly}
          />
          {showSearchHint && (
            <FormulaSearch
              // @ts-ignore
              from="fx"
              onMouseMove={(e) => {
                if (document.getElementById("luckysheet-formula-search-c")) {
                  // apply hovered state on the function item
                  const hoveredItem = (e.target as HTMLElement).closest(
                    ".luckysheet-formula-search-item"
                  ) as HTMLElement | null;
                  if (!hoveredItem) return;

                  clearSearchItemActiveClass();
                  hoveredItem.classList.add(
                    "luckysheet-formula-search-item-active"
                  );
                }
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                selectActiveFormulaOnClick(e);
              }}
            />
          )}

          <div className="fx-hint">
            {showFormulaHint && fn && (
              <FormulaHint
                handleShowFormulaHint={handleShowFormulaHint}
                showFormulaHint={showFormulaHint}
                commaCount={commaCount}
                functionName={functionName}
              />
            )}
            {!showFormulaHint && fn && (
              <div
                className="luckysheet-hin absolute show-more-btn"
                onClick={() => {
                  handleShowFormulaHint();
                }}
              >
                <LucideIcon
                  name="DSheetTextDisabled"
                  fill="black"
                  style={{
                    width: "14px",
                    height: "14px",
                    margin: "auto",
                    marginTop: "1px",
                  }}
                />
              </div>
            )}
          </div>

          {/* {focused && (
          <>
            <FormulaSearch
              style={{
                top: inputContainerRef.current!.clientHeight,
              }}
            />
            <FormulaHint
              style={{
                top: inputContainerRef.current!.clientHeight,
              }}
            />
          </>
        )} */}
        </div>
      </div>
      <div
        className="resize-handle"
        onMouseDown={startResize}
        style={{
          cursor: isResizing ? "grabbing" : "ns-resize",
          height: "1px",
        }}
      />
    </div>
  );
};

export default FxEditor;
