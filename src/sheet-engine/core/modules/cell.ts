/* eslint-disable no-plusplus */
import _ from "lodash";
import { Context, getFlowdata } from "../context";
import { Cell, CellMatrix, Range, Selection, SingleRange } from "../types";
import {
  getSheetIndex,
  indexToColumnChar,
  rgbToHex,
  processArray,
  getContentInParentheses,
  getNumberFormat,
} from "../utils";
import { checkCF, getComputeMap } from "./ConditionFormat";
import { getFailureText, validateCellData } from "./dataVerification";
import { genarate, update } from "./format";
import { clearCellError } from "../api";
import {
  delFunctionGroup,
  execfunction,
  execFunctionGroup,
  functionHTMLGenerate,
  getcellrange,
  iscelldata,
  suppressFormulaRangeSelectionForInitialEdit,
} from "./formula";
import {
  convertSpanToShareString,
  getHyperlinksFromInlineSegments,
  isInlineStringCell,
  isInlineStringCT,
} from "./inline-string";
import { isRealNull, isRealNum, valueIsError } from "./validation";
import { getCellTextInfo } from "./text";
import { locale } from "../locale";
import { spillSortResult } from "./sort";

// TODO put these in context ref
// let rangestart = false;
// let rangedrag_column_start = false;
// let rangedrag_row_start = false;

/** Extra px below measured text for auto row height (wrap + multiline edits). */
const AUTO_ROW_HEIGHT_VERTICAL_PADDING = 8;

/**
 * Recompute auto row height for one row from wrap/inline cells; updates cfg.rowlen and ctx.config.
 * Used from updateCell and deleteSelectedCellText (bulk clear).
 */
export function recalcAutoRowHeightForRow(
  ctx: Context,
  r: number,
  d: CellMatrix,
  canvas: CanvasRenderingContext2D | null | undefined,
): void {
  if (!canvas) return;

  const sheetIdx = getSheetIndex(ctx, ctx.currentSheetId as string) as number;
  const cfg = ctx.luckysheetfile[sheetIdx]?.config || {};
  if (cfg.customHeight?.[r]) return;

  const { defaultrowlen } = ctx;
  let nextRowLen = defaultrowlen;
  const rowData = d[r] || [];

  for (let col = 0; col < rowData.length; col += 1) {
    const rowCell = rowData[col];
    if (!rowCell) continue;
    if (!(rowCell?.tb === "2" || isInlineStringCell(rowCell))) continue;

    const cellWidth = cfg.columnlen?.[col] || ctx.defaultcollen;
    const textInfo = getCellTextInfo(rowCell as Cell, canvas, ctx, {
      r,
      c: col,
      cellWidth,
    });
    if (textInfo) {
      nextRowLen = Math.max(
        nextRowLen,
        textInfo.textHeightAll + AUTO_ROW_HEIGHT_VERTICAL_PADDING,
      );
    }
  }

  if (_.isNil(cfg.rowlen)) cfg.rowlen = {};
  if (nextRowLen > defaultrowlen) {
    cfg.rowlen[r] = nextRowLen;
  } else if (!_.isNil(cfg.rowlen?.[r])) {
    delete cfg.rowlen[r];
  }

  ctx.config = cfg;
}

export function normalizedCellAttr(
  cell: Cell,
  attr: keyof Cell,
  defaultFontSize = 10
): any {
  const tf = { bl: 1, it: 1, ff: 1, cl: 1, un: 1 };
  let value: any = cell?.[attr];

  if (attr in tf || (attr === "fs" && isInlineStringCell(cell))) {
    value ||= "0";
  } else if (["fc", "bg", "bc"].includes(attr)) {
    if (["fc", "bc"].includes(attr)) {
      value ||= "#000000";
    }
    if (value?.indexOf("rgba") > -1) {
      value = rgbToHex(value);
    }
  } else if (attr.substring(0, 2) === "bs") {
    value ||= "none";
  } else if (attr === "ht" || attr === "vt") {
    // Spreadsheet-style default alignment:
    // - text: left
    // - number/date-time-like numeric cells: right
    const isNumericCell =
      !!cell &&
      ((cell as Cell).ct?.t === "n" ||
        typeof (cell as Cell).v === "number" ||
        isRealNum((cell as Cell).v) ||
        isRealNum((cell as Cell).m));
    const defaultValue = attr === "ht" ? (isNumericCell ? "2" : "1") : "0";
    value = !_.isNil(value) ? value.toString() : defaultValue;
    if (["0", "1", "2"].indexOf(value.toString()) === -1) {
      value = defaultValue;
    }
  } else if (attr === "fs") {
    value ||= defaultFontSize.toString();
  } else if (attr === "tb" || attr === "tr") {
    value ||= "0";
  }

  return value;
}

export function normalizedAttr(
  data: CellMatrix,
  r: number,
  c: number,
  attr: keyof Cell
): any {
  if (!data || !data[r]) {
    return null;
  }
  const cell = data[r][c];
  if (!cell) return undefined;
  return normalizedCellAttr(cell, attr);
}

function newlinesToBr(text: string) {
  if (!text) return "";
  return text.replace(/\r\n|\r|\n/g, "<br />");
}

/** Append `)` for each unmatched `(` when committing a formula (ignores parens inside "..." string literals, `""` escape). */
function closeUnclosedParenthesesInFormula(formula: string): string {
  if (!formula.startsWith("=") || formula.length <= 1) return formula;
  const body = formula.slice(1);
  let depth = 0;
  let inString = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inString) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
  }
  if (depth <= 0) return formula;
  return `${formula}${")".repeat(depth)}`;
}

export function getCellValue(
  r: number,
  c: number,
  data: CellMatrix,
  attr?: keyof Cell
) {
  if (!attr) {
    attr = "v";
  }

  let d_value;

  if (!_.isNil(r) && !_.isNil(c)) {
    d_value = data[r][c];
  } else if (!_.isNil(r)) {
    d_value = data[r];
  } else if (!_.isNil(c)) {
    const newData = data[0].map((col, i) => {
      return data.map((row) => {
        return row[i];
      });
    });
    d_value = newData[c];
  } else {
    return data;
  }

  let retv: any = d_value;

  if (_.isPlainObject(d_value)) {
    const d = d_value as Cell;
    retv = d[attr];

    if (attr === "f" && !_.isNil(retv)) {
      retv = functionHTMLGenerate(retv);
    } else if (attr === "f") {
      retv = (d as Cell).v;
    } else if (d && d.ct && d.ct.t === "d") {
      retv = d.m;
    }

    if (d?.ct && isInlineStringCT(d.ct) && (attr === "v" || attr === "m")) {
      retv = newlinesToBr(d.ct.s[0]?.v);
    }
  }

  if (retv === undefined) {
    retv = null;
  }

  return retv;
}

export function setCellValue(
  ctx: Context,
  r: number,
  c: number,
  d: CellMatrix | null | undefined,
  v: any
) {
  if (ctx.allowEdit === false || ctx.isFlvReadOnly) return;
  if (_.isNil(d)) {
    d = getFlowdata(ctx);
  }
  if (!d) return;

  // 若采用深拷贝，初始化时的单元格属性丢失
  // let cell = $.extend(true, {}, d[r][c]);
  // const oldValue = _.cloneDeep(d[r][c]);
  let cell = d[r][c];

  let vupdate;

  if (_.isPlainObject(v)) {
    if (_.isNil(cell)) {
      cell = v;
    } else {
      if (!_.isNil(v.f)) {
        cell.f = v.f;
      } else if ("f" in cell) {
        delete cell.f;
      }

      // if (!_.isNil(v.spl)) {
      //   cell.spl = v.spl;
      // }
      if (!_.isNil(v.baseCurrency)) {
        // @ts-ignore
        cell.baseValue = v.baseValue;
        // @ts-ignore
        cell.baseCurrency = v.baseCurrency;
        // @ts-ignore
        cell.baseCurrencyPrice = v.baseCurrencyPrice;
      }

      if (!_.isNil(v.ct)) {
        cell.ct = v.ct;
      }
      // Preserve horizontal alignment from value object (e.g. when editing, keep number/currency right-aligned)
      if (!_.isNil(v.ht)) {
        cell.ht = v.ht;
      }
    }

    if (_.isPlainObject(v.v)) {
      vupdate = v.v.v;
    } else {
      vupdate = v.v;
    }
  } else {
    vupdate = v;
  }
  let commaPresent = false;
  if (vupdate && typeof vupdate === "string" && vupdate.includes(",")) {
    commaPresent = vupdate.includes(",");
    const removeCommasValidated = (str: string) =>
      /^[\d,.]+$/.test(str) ? str?.replace(/,/g, "") : str;
    vupdate = removeCommasValidated(vupdate);
  }

  if (isRealNull(vupdate)) {
    if (_.isPlainObject(cell)) {
      delete cell!.m;
      // @ts-ignore
      delete cell.v;
    } else {
      cell = null;
    }

    d[r][c] = cell;
    // if (ctx?.hooks?.afterUpdateCell) {
    //   ctx.hooks.afterUpdateCell(r, c, oldValue, d[r][c] ?? null);
    // }

    return;
  }

  // 1.为null
  // 2.数据透视表的数据，flowdata的每个数据可能为字符串，结果就是cell === v === 一个字符串或者数字数据
  if (
    isRealNull(cell) ||
    ((_.isString(cell) || _.isNumber(cell)) && cell === v)
  ) {
    cell = {};
  }

  if (!cell) return;

  const vupdateStr = vupdate.toString();

  if (vupdateStr.substr(0, 1) === "'") {
    cell.m = vupdateStr.substr(1);
    cell.ct = { fa: "@", t: "s" };
    cell.v = vupdateStr.substr(1);
    cell.qp = 1;
  } else if (cell.qp === 1) {
    cell.m = vupdateStr;
    cell.ct = { fa: "@", t: "s" };
    cell.v = vupdateStr;
  } else if (
    vupdateStr.toUpperCase() === "TRUE" &&
    (_.isNil(cell.ct?.fa) || cell.ct?.fa !== "@")
  ) {
    cell.m = "TRUE";
    cell.ct = { fa: "General", t: "b" };
    cell.v = true;
  } else if (
    vupdateStr.toUpperCase() === "FALSE" &&
    (_.isNil(cell.ct?.fa) || cell.ct?.fa !== "@")
  ) {
    cell.m = "FALSE";
    cell.ct = { fa: "General", t: "b" };
    cell.v = false;
  } else if (
    vupdateStr.substr(-1) === "%" &&
    isRealNum(vupdateStr.substring(0, vupdateStr.length - 1)) &&
    (_.isNil(cell.ct?.fa) || cell.ct?.fa !== "@")
  ) {
    cell.ct = { fa: "0%", t: "n" };
    cell.v = vupdateStr.substring(0, vupdateStr.length - 1) / 100;
    cell.m = vupdate;
  } else if (valueIsError(vupdate)) {
    cell.m = vupdateStr;
    // cell.ct = { "fa": "General", "t": "e" };
    if (!_.isNil(cell.ct)) {
      cell.ct.t = "e";
    } else {
      cell.ct = { fa: "General", t: "e" };
    }
    cell.v = vupdate;
  } else {
    if (
      !_.isNil(cell.f) &&
      isRealNum(vupdate) &&
      !/^\d{6}(18|19|20)?\d{2}(0[1-9]|1[12])(0[1-9]|[12]\d|3[01])\d{3}(\d|X)$/i.test(
        vupdate
      )
    ) {
      cell.v = parseFloat(vupdate);
      if (_.isNil(cell.ct)) {
        cell.ct = { fa: "General", t: "g" };
      }

      // if output is number fetch fa from referenced cells
      const isDigit = /^\d+$/.test(vupdate);
      if (isDigit) {
        const flowdata = getFlowdata(ctx);
        const args = getContentInParentheses(cell?.f)?.split(",");
        const cellRefs = args?.map((arg) => arg.trim().toUpperCase());
        const formatted = processArray(cellRefs, d, flowdata);
        if (formatted) {
          cell.ct.fa = formatted;
        }
      }

      if (cell.v === Infinity || cell.v === -Infinity) {
        cell.m = cell.v.toString();
      } else {
        if (cell.v.toString().indexOf("e") > -1) {
          let len;
          if (cell.v.toString().split(".").length === 1) {
            len = 0;
          } else {
            len = cell.v.toString().split(".")[1].split("e")[0].length;
          }
          if (len > 5) {
            len = 5;
          }
          cell.m = cell.v.toExponential(len).toString();
        } else {
          const v_p = Math.round(cell.v * 1000000000) / 1000000000;
          if (_.isNil(cell.ct)) {
            const mask = genarate(v_p);
            if (mask != null) {
              cell.m = mask[0].toString();
            }
          } else {
            const mask = update(cell.ct.fa!, v_p);
            cell.m = mask.toString();
          }

          // cell.m = mask[0].toString();
        }
      }
    } else if (!_.isNil(cell.ct) && cell.ct.fa === "@") {
      cell.m = vupdateStr;
      cell.v = vupdate;
    } else if (cell.ct != null && cell.ct.t === "d" && _.isString(vupdate)) {
      const mask = genarate(vupdate) as any;
      if (mask[1].t !== "d" || mask[1].fa === cell.ct.fa) {
        [cell.m, cell.ct, cell.v] = mask;
      } else {
        [, , cell.v] = mask;
        cell.m = update(cell.ct.fa!, cell.v);
      }
    } else if (
      !_.isNil(cell.ct) &&
      !_.isNil(cell.ct.fa) &&
      cell.ct.fa !== "General"
    ) {
      let { fa } = cell.ct;
      if (isRealNum(vupdate)) {
        // Only override fa when the user explicitly typed commas that the format doesn't support.
        // Conditions that compared format commas/decimals against input were removed because they
        // incorrectly changed an explicit format (e.g. "#,##0.00") when a plain value like "42" was typed,
        // causing the decimal places to be lost.
        if (commaPresent && !fa.includes(",")) {
          fa = getNumberFormat(String(vupdate), commaPresent);
        }
        vupdate = parseFloat(vupdate);
        if (cell?.ct) {
          cell.ct = { ...cell.ct, fa, t: "n" };
        }
      }

      let mask = update(fa, vupdate);

      if (mask === vupdate) {
        // 若原来单元格格式 应用不了 要更新的值，则获取更新值的 格式
        const gen = genarate(vupdate as any);
        if (gen) {
          const [m, ct, v] = gen;
          cell.m = m == null ? "" : String(m);
          cell.ct = ct as Cell["ct"];
          cell.v = v as Cell["v"];
        }
      } else {
        if (v.m) {
          cell.m = v.m;
        } else {
          cell.m = mask.toString();
        }
        cell.v = vupdate;
      }
    } else {
      if (
        isRealNum(vupdate) &&
        !/^\d{6}(18|19|20)?\d{2}(0[1-9]|1[12])(0[1-9]|[12]\d|3[01])\d{3}(\d|X)$/i.test(
          vupdate
        )
      ) {
        if (typeof vupdate === "string") {
          const flag = vupdate
            .split("")
            .every((ele) => ele === "0" || ele === ".");
          // Convert to number if: all zeros/dots, or has leading zeros that should be stripped
          if (flag || /^0+\d/.test(vupdate)) {
            vupdate = parseFloat(vupdate);
          }
        }
        cell.v =
          vupdate; /* 备注：如果使用parseFloat，1.1111111111111111会转换为1.1111111111111112 ? */
        cell.m = v.m ? v.m : String(cell.v);
        cell.ct = { fa: "General", t: "g" };
        if (cell.v === Infinity || cell.v === -Infinity) {
          cell.m = cell.v.toString();
        } else if (cell.v != null && !cell.m) {
          const mask = genarate(cell.v as string);
          if (mask) {
            if (v.m) {
              cell.m = v.m;
            } else {
              cell.m = mask[0].toString();
            }
          }
        }
      } else {
        const mask = genarate(vupdate);
        if (mask) {
          cell.m = mask[0].toString();
          [, cell.ct, cell.v] = mask;
        }
      }
    }
  }

  // if (!server.allowUpdate && !luckysheetConfigsetting.pointEdit) {
  //   if (
  //     !_.isNil(cell.ct) &&
  //     /^(w|W)((0?)|(0\.0+))$/.test(cell.ct.fa) === false &&
  //     cell.ct.t === "n" &&
  //     !_.isNil(cell.v) &&
  //     parseInt(cell.v, 10).toString().length > 4
  //   ) {
  //     const autoFormatw = luckysheetConfigsetting.autoFormatw
  //       .toString()
  //       .toUpperCase();
  //     const { accuracy } = luckysheetConfigsetting;

  //     const sfmt = setAccuracy(autoFormatw, accuracy);

  //     if (sfmt !== "General") {
  //       cell.ct.fa = sfmt;
  //       cell.m = update(sfmt, cell.v);
  //     }
  //   }
  // }

  d[r][c] = cell;
  // if (ctx?.hooks?.afterUpdateCell) {
  //   ctx.hooks.afterUpdateCell(r, c, oldValue, d[r][c] ?? null);
  // }
  // after cell data update
  if (ctx.luckysheet_selection_range) {
    ctx.luckysheet_selection_range = [];
  }

  // Note: afterUpdateCell is invoked above (with old/new values).
}

export function getRealCellValue(
  r: number,
  c: number,
  data: CellMatrix,
  attr?: keyof Cell
) {
  let value = getCellValue(r, c, data, "m");
  if (_.isNil(value)) {
    value = getCellValue(r, c, data, attr);
    if (_.isNil(value)) {
      const ct = getCellValue(r, c, data, "ct");
      if (isInlineStringCT(ct)) {
        value = ct.s;
      }
    }
  }

  return value;
}

export function mergeBorder(
  ctx: Context,
  d: CellMatrix,
  row_index: number,
  col_index: number
) {
  if (!d || !d[row_index]) {
    console.warn("Merge info is null", row_index, col_index);
    return null;
  }
  const value = d[row_index][col_index];
  if (!value) return null;

  if (value?.mc) {
    const margeMaindata = value.mc;
    if (!margeMaindata) {
      console.warn("Merge info is null", row_index, col_index);
      return null;
    }
    col_index = margeMaindata.c;
    row_index = margeMaindata.r;

    if (_.isNil(d?.[row_index]?.[col_index])) {
      console.warn("Main merge Cell info is null", row_index, col_index);
      return null;
    }
    const col_rs = d[row_index]?.[col_index]?.mc?.cs;
    const row_rs = d[row_index]?.[col_index]?.mc?.rs;
    const mergeMain = d[row_index]?.[col_index]?.mc;

    if (
      !mergeMain ||
      _.isNil(mergeMain?.rs) ||
      _.isNil(mergeMain?.cs) ||
      _.isNil(col_rs) ||
      _.isNil(row_rs)
    ) {
      console.warn("Main merge info is null", mergeMain);
      return null;
    }

    let start_r: number;
    let end_r: number;
    let row: number | undefined;
    let row_pre: number | undefined;
    for (let r = row_index; r < mergeMain.rs + row_index; r += 1) {
      if (r === 0) {
        start_r = -1;
      } else {
        start_r = ctx.visibledatarow[r - 1] - 1;
      }

      end_r = ctx.visibledatarow[r];

      if (row_pre === undefined) {
        row_pre = start_r;
        row = end_r;
      } else if (row !== undefined) {
        row += end_r - start_r - 1;
      }
    }

    let start_c: number;
    let end_c: number;
    let col: number | undefined;
    let col_pre: number | undefined;

    for (let c = col_index; c < mergeMain.cs + col_index; c += 1) {
      if (c === 0) {
        start_c = 0;
      } else {
        start_c = ctx.visibledatacolumn[c - 1];
      }

      end_c = ctx.visibledatacolumn[c];

      if (col_pre === undefined) {
        col_pre = start_c;
        col = end_c;
      } else if (col !== undefined) {
        col += end_c - start_c;
      }
    }

    if (_.isNil(row_pre) || _.isNil(col_pre) || _.isNil(row) || _.isNil(col)) {
      console.warn(
        "Main merge info row_pre or col_pre or row or col is null",
        mergeMain
      );
      return null;
    }

    return {
      row: [row_pre, row, row_index, row_index + row_rs - 1],
      column: [col_pre, col, col_index, col_index + col_rs - 1],
    };
  }
  return null;
}

function mergeMove(
  ctx: Context,
  mc: any,
  columnseleted: number[],
  rowseleted: number[],
  s: Partial<Selection>,
  top: number,
  height: number,
  left: number,
  width: number
) {
  const row_st = mc.r;
  const row_ed = mc.r + mc.rs - 1;
  const col_st = mc.c;
  const col_ed = mc.c + mc.cs - 1;
  let ismatch = false;

  columnseleted[0] = Math.min(columnseleted[0], columnseleted[1]);
  rowseleted[0] = Math.min(rowseleted[0], rowseleted[1]);

  if (
    (columnseleted[0] <= col_st &&
      columnseleted[1] >= col_ed &&
      rowseleted[0] <= row_st &&
      rowseleted[1] >= row_ed) ||
    (!(columnseleted[1] < col_st || columnseleted[0] > col_ed) &&
      !(rowseleted[1] < row_st || rowseleted[0] > row_ed))
  ) {
    const flowdata = getFlowdata(ctx);
    if (!flowdata) return null;

    const margeset = mergeBorder(ctx, flowdata, mc.r, mc.c);
    if (margeset) {
      const row = margeset.row[1];
      const row_pre = margeset.row[0];
      const col = margeset.column[1];
      const col_pre = margeset.column[0];

      if (!(columnseleted[1] < col_st || columnseleted[0] > col_ed)) {
        // 向上滑动
        if (rowseleted[0] <= row_ed && rowseleted[0] >= row_st) {
          height += top - row_pre;
          top = row_pre;
          rowseleted[0] = row_st;
        }

        // 向下滑动或者居中时往上滑动的向下补齐
        if (rowseleted[1] >= row_st && rowseleted[1] <= row_ed) {
          if (s.row_focus! >= row_st && s.row_focus! <= row_ed) {
            height = row - top;
          } else {
            height = row - top;
          }

          rowseleted[1] = row_ed;
        }
      }

      if (!(rowseleted[1] < row_st || rowseleted[0] > row_ed)) {
        if (columnseleted[0] <= col_ed && columnseleted[0] >= col_st) {
          width += left - col_pre;
          left = col_pre;
          columnseleted[0] = col_st;
        }

        // 向右滑动或者居中时往左滑动的向下补齐
        if (columnseleted[1] >= col_st && columnseleted[1] <= col_ed) {
          if (s.column_focus! >= col_st && s.column_focus! <= col_ed) {
            width = col - left;
          } else {
            width = col - left;
          }

          columnseleted[1] = col_ed;
        }
      }

      ismatch = true;
    }
  }

  if (ismatch) {
    return [columnseleted, rowseleted, top, height, left, width];
  }
  return null;
}

export function mergeMoveMain(
  ctx: Context,
  columnseleted: number[],
  rowseleted: number[],
  s: Partial<Selection>,
  top: number,
  height: number,
  left: number,
  width: number
) {
  const mergesetting = ctx.config.merge;

  if (!mergesetting) {
    return null;
  }

  const mcset = Object.keys(mergesetting);

  rowseleted[1] = Math.max(rowseleted[0], rowseleted[1]);
  columnseleted[1] = Math.max(columnseleted[0], columnseleted[1]);

  let offloop = true;
  const mergeMoveData: any = {};

  while (offloop) {
    offloop = false;

    for (let i = 0; i < mcset.length; i += 1) {
      const key = mcset[i];
      const mc = mergesetting[key];

      if (key in mergeMoveData) {
        continue;
      }

      const changeparam = mergeMove(
        ctx,
        mc,
        columnseleted,
        rowseleted,
        s,
        top,
        height,
        left,
        width
      );

      if (changeparam != null) {
        mergeMoveData[key] = mc;

        // @ts-ignore
        [columnseleted, rowseleted, top, height, left, width] = changeparam;

        offloop = true;
      } else {
        delete mergeMoveData[key];
      }
    }
  }

  return [columnseleted, rowseleted, top, height, left, width];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function cancelFunctionrangeSelected(ctx: Context) {
  if (ctx.formulaCache.selectingRangeIndex === -1) {
    ctx.formulaRangeSelect = undefined;
  }
  // $("#luckysheet-row-count-show, #luckysheet-column-count-show").hide();
  // // $("#luckysheet-cols-h-selected, #luckysheet-rows-h-selected").hide();
  // $("#luckysheet-formula-search-c, #luckysheet-formula-help-c").hide();
}

export function cancelNormalSelected(ctx: Context) {
  cancelFunctionrangeSelected(ctx);

  ctx.luckysheetCellUpdate = [];
  ctx.formulaRangeHighlight = [];
  ctx.functionHint = null;
  // $("#fortune-formula-functionrange .fortune-formula-functionrange-highlight").remove();
  // $("#luckysheet-input-box").removeAttr("style");
  // $("#luckysheet-input-box-index").hide();
  // $("#luckysheet-wa-functionbox-cancel, #luckysheet-wa-functionbox-confirm").removeClass("luckysheet-wa-calculate-active");

  ctx.formulaCache.rangestart = false;
  ctx.formulaCache.rangedrag_column_start = false;
  ctx.formulaCache.rangedrag_row_start = false;
  ctx.formulaCache.rangeSelectionActive = null;
  ctx.formulaCache.keyboardRangeSelectionLock = false;
  ctx.formulaCache.formulaEditorOwner = null;
}

// formula.updatecell
export function updateCell(
  ctx: Context,
  r: number,
  c: number,
  $input?: HTMLDivElement | null,
  value?: any,
  canvas?: CanvasRenderingContext2D
) {
  try {
    if (ctx.allowEdit === false || ctx.isFlvReadOnly) return;

    let inputText = $input?.innerText;
    if (inputText?.startsWith("=")) {
      inputText = inputText?.replace(/[\r\n]/g, "");
    }
    const inputHtml = $input?.innerHTML;

    const flowdata = getFlowdata(ctx);
    if (!flowdata) return;

    // if (!_.isNil(rangetosheet) && rangetosheet !== ctx.currentSheetId) {
    //   sheetmanage.changeSheetExec(rangetosheet);
    // }

    // if (!checkProtectionLocked(r, c, ctx.currentSheetId)) {
    //   return;
    // }

    // 数据验证 输入数据无效时禁止输入
    const index = getSheetIndex(ctx, ctx.currentSheetId) as number;
    const { dataVerification } = ctx.luckysheetfile[index];

    // --- hyperlink sync support ---
    const sheetFile = ctx.luckysheetfile[index] as any;
    // --- end ---

    if (!_.isNil(dataVerification)) {
      const dvItem = dataVerification[`${r}_${c}`];
      if (
        !_.isNil(dvItem) &&
        dvItem.prohibitInput &&
        !validateCellData(ctx, dvItem, inputText)
      ) {
        const failureText = getFailureText(ctx, dvItem);

        cancelNormalSelected(ctx);
        ctx.warnDialog = failureText;

        return;
      }
    }

    let curv = flowdata[r][c];

    // ctx.old value for hook function
    const oldValue = _.cloneDeep(curv);

    const isPrevInline = isInlineStringCell(curv);
    let isCurInline =
      inputText?.slice(0, 1) !== "=" && inputHtml?.substring(0, 5) === "<span";

    let isCopyVal = false;
    if (!isCurInline && inputText && inputText.length > 0) {
      const splitArr = inputText
        .replace(/\r\n/g, "_x000D_")
        .replace(/&#13;&#10;/g, "_x000D_")
        .replace(/\r/g, "_x000D_")
        .replace(/\n/g, "_x000D_")
        .split("_x000D_");
      if (splitArr.length > 1 && inputHtml !== "<br>") {
        isCopyVal = true;
        isCurInline = true;
        inputText = splitArr.join("\r\n");
      }
    }

    if (curv?.ct && !value && !isCurInline && isPrevInline) {
      delete curv.ct.s;
      curv.ct.t = "g";
      curv.ct.fa = "General";
      curv.tb = "1";
      value = "";
    } else if (isCurInline) {
      if (!_.isPlainObject(curv)) {
        curv = {};
      }
      curv ||= {};
      const fontSize = curv.fs || 10;

      if (!curv.ct) {
        curv.ct = {};
        curv.ct.fa = "General";
        curv.tb = "1";
      }

      curv.ct.t = "inlineStr";

      curv.ct.s = convertSpanToShareString(
        $input!.querySelectorAll("span"),
        curv
      );

      delete curv.fs;
      delete curv.f;
      delete curv.v;
      delete curv.m;
      curv.fs = fontSize;
      if (isCopyVal) {
        curv.ct.s = [
          {
            v: inputText,
            fs: fontSize,
          },
        ];
      }
    }

    // API, we get value from user
    value = value || inputText;
    if (_.isString(value) && value.startsWith("=") && value.length > 1) {
      value = closeUnclosedParenthesesInFormula(value);
    } else if (
      _.isPlainObject(value) &&
      _.isString((value as Cell).f) &&
      (value as Cell).f!.startsWith("=") &&
      (value as Cell).f!.length > 1
    ) {
      (value as Cell).f = closeUnclosedParenthesesInFormula((value as Cell).f!);
    }
    const shouldClearError = oldValue?.f
      ? oldValue.f !== value
      : oldValue?.v !== value;

    if (shouldClearError) {
      clearCellError(ctx, r, c);
    }

    // Hook function
    if (ctx.hooks.beforeUpdateCell?.(r, c, value) === false) {
      cancelNormalSelected(ctx);
      return;
    }

    if (!isCurInline) {
      if (isRealNull(value) && !isPrevInline) {
        if (!curv || (isRealNull(curv.v) && !curv.spl && !curv.f)) {
          cancelNormalSelected(ctx);
          return;
        }
      } else if (curv && curv.qp !== 1) {
        if (
          _.isPlainObject(curv) &&
          (value === curv.f || value === curv.v || value === curv.m)
        ) {
          cancelNormalSelected(ctx);
          return;
        }
        if (value === curv) {
          cancelNormalSelected(ctx);
          return;
        }
      }

      if (_.isString(value) && value.slice(0, 1) === "=" && value.length > 1) {
      } else if (
        _.isPlainObject(curv) &&
        curv &&
        curv.ct &&
        curv.ct.fa &&
        curv.ct.fa !== "@" &&
        !isRealNull(value)
      ) {
        delete curv.m; // 更新时间m处理 ， 会实际删除单元格数据的参数（flowdata时已删除）
        if (curv.f) {
          // 如果原来是公式，而更新的数据不是公式，则把公式删除
          delete curv.f;
          delete curv.spl; // 删除单元格的sparklines的配置串
        }
      }
    }

    // TODO window.luckysheet_getcelldata_cache = null;

    let isRunExecFunction = true;

    const d = flowdata; // TODO const d = editor.deepCopyFlowData(flowdata);
    let dynamicArrayItem = null; // 动态数组

    if (_.isPlainObject(curv)) {
      if (!isCurInline) {
        if (
          _.isString(value) &&
          value.slice(0, 1) === "=" &&
          value.length > 1
        ) {
          const v = execfunction(ctx, value, r, c, undefined, undefined, true);
          isRunExecFunction = false;
          curv = _.cloneDeep(d?.[r]?.[c] || {});
          [, curv.v, curv.f] = v;

          // 打进单元格的sparklines的配置串， 报错需要单独处理。
          if (v.length === 4 && v[3].type === "sparklines") {
            delete curv.m;
            delete curv.v;

            const curCalv = v[3].data;

            if (_.isArray(curCalv) && !_.isPlainObject(curCalv[0])) {
              [curv.v] = curCalv;
            } else {
              curv.spl = v[3].data;
            }
          } else if (v.length === 4 && v[3].type === "dynamicArrayItem") {
            dynamicArrayItem = v[3].data;
          }
        }
        // from API setCellValue,luckysheet.setCellValue(0, 0, {f: "=sum(D1)", bg:"#0188fb"}),value is an object, so get attribute f as value
        else if (_.isPlainObject(value)) {
          const valueFunction = value.f;

          if (
            _.isString(valueFunction) &&
            valueFunction.slice(0, 1) === "=" &&
            valueFunction.length > 1
          ) {
            const v = execfunction(
              ctx,
              valueFunction,
              r,
              c,
              undefined,
              undefined,
              true
            );
            isRunExecFunction = false;
            // get v/m/ct

            curv = _.cloneDeep(d?.[r]?.[c] || {});
            [, curv.v, curv.f] = v;

            // 打进单元格的sparklines的配置串， 报错需要单独处理。
            if (v.length === 4 && v[3].type === "sparklines") {
              delete curv.m;
              delete curv.v;

              const curCalv = v[3].data;

              if (_.isArray(curCalv) && !_.isPlainObject(curCalv[0])) {
                [curv.v] = curCalv;
              } else {
                curv.spl = v[3].data;
              }
            } else if (v.length === 4 && v[3].type === "dynamicArrayItem") {
              dynamicArrayItem = v[3].data;
            }
          }
          // from API setCellValue,luckysheet.setCellValue(0, 0, {f: "=sum(D1)", bg:"#0188fb"}),value is an object, so get attribute f as value
          else {
            Object.keys(value).forEach((attr) => {
              (curv as Record<string, any>)[attr] = value[attr];
            });
            clearCellError(ctx, r, c);
          }
        } else {
          clearCellError(ctx, r, c);
          delFunctionGroup(ctx, r, c);

          curv = _.cloneDeep(d?.[r]?.[c] || {});
          curv.v = value;

          delete curv.f;
          delete curv.spl;

          // FLV crypto denomination --START--
          const decemialCount = oldValue?.m?.toString().includes(".")
            ? oldValue?.m?.toString().split(" ")[0].split(".")[1]?.length
            : 0;
          const coin = oldValue?.m?.toString().split(" ")[1];
          if (
            typeof curv === "object" &&
            curv?.baseValue &&
            oldValue?.baseCurrencyPrice
          ) {
            curv.m = `${
              // eslint-disable-next-line no-unsafe-optional-chaining
              (
                parseFloat(value as string) /
                (oldValue.baseCurrencyPrice as number)
              ).toFixed(decemialCount || 2)
              } ${coin}`;
            curv.baseValue = value;
          }
          // FLV crypto denomination --END--
          execFunctionGroup(ctx, r, c, curv);
          isRunExecFunction = false;
          if (curv.qp === 1 && `${value}`.substring(0, 1) !== "'") {
            // if quotePrefix is 1, cell is force string, cell clear quotePrefix when it is updated
            curv.qp = 0;
            if (curv.ct) {
              curv.ct.fa = "General";
              curv.ct.t = "n";
            }
          }
        }
      }
      value = curv;
    } else {
      if (_.isString(value) && value.slice(0, 1) === "=" && value.length > 1) {
        const v = execfunction(ctx, value, r, c, undefined, undefined, true);
        isRunExecFunction = false;
        value = {
          v: v[1],
          f: v[2],
        };

        if (/^[\d.,]+$/.test(value.v)) {
          const args = getContentInParentheses(value?.f)?.split(",");
          const cellRefs = args?.map((arg) => arg.trim().toUpperCase());
          const formatted = processArray(cellRefs, d, flowdata);
          if (formatted) {
            value.m = update(formatted, value.v);
            value.ct = {
              fa: formatted,
              t: "n",
            };
          }
        }

        // 打进单元格的sparklines的配置串， 报错需要单独处理。
        if (v.length === 4 && v[3].type === "sparklines") {
          const curCalv = v[3].data;

          if (_.isArray(curCalv) && !_.isPlainObject(curCalv[0])) {
            [value.v] = curCalv;
          } else {
            value.spl = v[3].data;
          }
        } else if (v.length === 4 && v[3].type === "dynamicArrayItem") {
          dynamicArrayItem = v[3].data;
        }
      }
      // from API setCellValue,luckysheet.setCellValue(0, 0, {f: "=sum(D1)", bg:"#0188fb"}),value is an object, so get attribute f as value
      else if (_.isPlainObject(value)) {
        const valueFunction = value.f;

        if (
          _.isString(valueFunction) &&
          valueFunction.slice(0, 1) === "=" &&
          valueFunction.length > 1
        ) {
          const v = execfunction(
            ctx,
            valueFunction,
            r,
            c,
            undefined,
            undefined,
            true
          );
          isRunExecFunction = false;
          // value = {
          //     "v": v[1],
          //     "f": v[2]
          // };

          // update attribute v
          [, value.v, value.f] = v;

          // 打进单元格的sparklines的配置串， 报错需要单独处理。
          if (v.length === 4 && v[3].type === "sparklines") {
            const curCalv = v[3].data;

            if (_.isArray(curCalv) && !_.isPlainObject(curCalv[0])) {
              [value.v] = curCalv;
            } else {
              value.spl = v[3].data;
            }
          } else if (v.length === 4 && v[3].type === "dynamicArrayItem") {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            dynamicArrayItem = v[3].data;
          }
        } else {
          clearCellError(ctx, r, c);
          const v = curv;
          if (_.isNil(value.v)) {
            value.v = v;
          }
        }
      } else {
        clearCellError(ctx, r, c);
        delFunctionGroup(ctx, r, c);
        execFunctionGroup(ctx, r, c, value);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        isRunExecFunction = false;
      }
    }

    // value maybe an object
    // FLV crypto denomination --START--
    const decemialCount = oldValue?.m?.toString().includes(".")
      ? oldValue?.m?.toString().split(" ")[0].split(".")[1]?.length
      : 0;
    const coin = oldValue?.m?.toString().split(" ")[1];
    if (typeof value === "object" && value.baseValue && !value?.m) {
      value.m = `${
        // @ts-expect-error later
        // eslint-disable-next-line no-unsafe-optional-chaining
        (parseFloat(value?.v as string) / oldValue?.baseCurrencyPrice).toFixed(
          decemialCount || 2
        )
        } ${coin}`;
    }

    // FLV crypto denomination --END--
    if (typeof value === "string") {
      value = {
        ct: {
          fa: "General",
          t: "g",
        },
        v: value,
        tb: "1",
      };
    } else if (typeof value === "object" && !value.tb) {
      value.tb = "1";
    }

    const isValueArray = Array.isArray((value as any)?.v?.[0]);

    try {
      if (isValueArray) {
        if (spillSortResult(ctx, r, c, value, d)) {
          cancelNormalSelected(ctx);
          if (ctx.hooks.afterUpdateCell) {
            const newValue = _.cloneDeep(d[r][c]);
            setTimeout(() =>
              ctx.hooks.afterUpdateCell?.(r, c, oldValue, newValue)
            );
          }
          ctx.formulaCache.execFunctionGlobalData = null;
          return;
        }
      }
    } catch (e) {
      console.log("[updateCell] spill failed; falling back", e);
    }

    // --- hyperlink support ---
    const hyperlinkKey = `${r}_${c}`;
    const prevHyperlink = sheetFile.hyperlink?.[hyperlinkKey];
    if (
      typeof value === "object" &&
      value &&
      (value as Cell).ct?.t === "inlineStr"
    ) {
      const links = getHyperlinksFromInlineSegments(value as Cell);
      if (!sheetFile.hyperlink) sheetFile.hyperlink = {};
      if (links.length === 0) {
        delete sheetFile.hyperlink[hyperlinkKey];
      } else {
        sheetFile.hyperlink[hyperlinkKey] =
          links.length === 1 ? links[0] : links;
      }
      if (typeof value === "object" && value && "hl" in (value as any)) {
        delete (value as any).hl;
      }
    } else {
      if (prevHyperlink && sheetFile.hyperlink) {
        delete sheetFile.hyperlink[hyperlinkKey];
      }
      if (typeof value === "object" && value && "hl" in (value as any)) {
        delete (value as any).hl;
      }
    }

    // --- end ---

    setCellValue(ctx, r, c, d, value);

    cancelNormalSelected(ctx);

    /*
    let RowlChange = false;
    const cfg =
      ctx.luckysheetfile?.[getSheetIndex(ctx, ctx.currentSheetId)]?.config ||
      {};
    if (!cfg.rowlen) {
      cfg.rowlen = {};
    }
    */

    const cfg =
      ctx.luckysheetfile[
        getSheetIndex(ctx, ctx.currentSheetId as string) as number
      ].config || {};

    // oldValue = cell before this edit. When content is deleted, new cell may be empty;
    // still recompute row height if the previous cell had wrap (tb "2") or inlineStr.
    const prevHadWrapOrInline =
      (oldValue?.tb === "2" &&
        !_.isNil(oldValue?.v) &&
        oldValue?.v !== "") ||
      isInlineStringCell(oldValue);

    const newCell = d[r][c];
    const newHasWrapOrInline =
      (newCell?.tb === "2" &&
        !_.isNil(newCell?.v) &&
        newCell?.v !== "") ||
      isInlineStringCell(newCell);

    if ((prevHadWrapOrInline || newHasWrapOrInline) && !cfg.customHeight?.[r] && canvas) {
      // 自动换行 — recompute row height (grow/shrink) from wrap + inline cells
      recalcAutoRowHeightForRow(ctx, r, d, canvas);
    }

    // 动态数组
    /*
    let dynamicArray = null;
    if (dynamicArrayItem) {
      // let file = ctx.luckysheetfile[getSheetIndex(ctx.currentSheetId)];
      dynamicArray = $.extend(
        true,
        [],
        this.insertUpdateDynamicArray(dynamicArrayItem)
      );
      // dynamicArray.push(dynamicArrayItem);
    }
  
    let allParam = {
      dynamicArray,
    };
  
    if (RowlChange) {
      allParam = {
        cfg,
        dynamicArray,
        RowlChange,
      };
    }
    */
    if (ctx.hooks.afterUpdateCell) {
      const newValue = _.cloneDeep(flowdata[r][c]);
      const { afterUpdateCell } = ctx.hooks;
      setTimeout(() => {
        afterUpdateCell?.(r, c, oldValue, newValue);
      });
    }

    ctx.formulaCache.execFunctionGlobalData = null;
  } catch (e) {
    console.error(e);
    cancelNormalSelected(ctx);
  }
}

export function getOrigincell(ctx: Context, r: number, c: number, i: string) {
  const data = getFlowdata(ctx, i);
  if (_.isNil(r) || _.isNil(c)) {
    return null;
  }

  if (!data || !data[r] || !data[r][c]) {
    return null;
  }
  return data[r][c];
}

export function getcellFormula(
  ctx: Context,
  r: number,
  c: number,
  i: string,
  data?: any
) {
  let cell;
  if (_.isNil(data)) {
    cell = getOrigincell(ctx, r, c, i);
  } else {
    cell = data[r][c];
  }

  if (_.isNil(cell)) {
    return null;
  }

  return cell.f;
}

export function getRange(ctx: Context) {
  const rangeArr = _.cloneDeep(ctx.luckysheet_select_save);
  const result: Range = [];
  if (!rangeArr) return result;

  for (let i = 0; i < rangeArr.length; i += 1) {
    const rangeItem = rangeArr[i];
    const temp = {
      row: rangeItem.row,
      column: rangeItem.column,
    };
    result.push(temp);
  }
  return result;
}

export function getFlattenedRange(ctx: Context, range?: Range) {
  range = range || getRange(ctx);

  const result: { r: number; c: number }[] = [];

  range.forEach((ele) => {
    // 这个data可能是个范围或者是单个cell
    const rs = ele.row;
    const cs = ele.column;
    for (let r = rs[0]; r <= rs[1]; r += 1) {
      for (let c = cs[0]; c <= cs[1]; c += 1) {
        // r c 当前的r和当前的c
        result.push({ r, c });
      }
    }
  });
  return result;
}

// 把选区范围数组转为string A1:A2
export function getRangetxt(
  ctx: Context,
  sheetId: string,
  range: SingleRange,
  currentId?: string
) {
  let sheettxt = "";

  if (currentId == null) {
    currentId = ctx.currentSheetId;
  }

  if (sheetId !== currentId) {
    // sheet名字包含'的，引用时应该替换为''
    const index = getSheetIndex(ctx, sheetId);
    if (index == null) return "";
    sheettxt = ctx.luckysheetfile[index].name.replace(/'/g, "''");
    // 如果包含除a-z、A-Z、0-9、下划线等以外的字符那么就用单引号包起来
    if (
      // eslint-disable-next-line no-misleading-character-class
      /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/.test(
        sheettxt
      )
    ) {
      sheettxt += "!";
    } else {
      sheettxt = `'${sheettxt}'!`;
    }
  }

  const row0 = range.row[0];
  const row1 = range.row[1];
  const column0 = range.column[0];
  const column1 = range.column[1];

  if (row0 == null && row1 == null) {
    return `${sheettxt + indexToColumnChar(column0)}:${indexToColumnChar(
      column1
    )}`;
  }
  if (column0 == null && column1 == null) {
    return `${sheettxt + (row0 + 1)}:${row1 + 1}`;
  }

  if (column0 === column1 && row0 === row1) {
    return sheettxt + indexToColumnChar(column0) + (row0 + 1);
  }

  return `${sheettxt + indexToColumnChar(column0) + (row0 + 1)
    }:${indexToColumnChar(column1)}${row1 + 1}`;
}

// 把string A1:A2转为选区数组
export function getRangeByTxt(ctx: Context, txt: string) {
  let range = [];
  if (txt.indexOf(",") !== -1) {
    const arr = txt.split(",");
    for (let i = 0; i < arr.length; i += 1) {
      if (iscelldata(arr[i])) {
        range.push(getcellrange(ctx, arr[i]));
      } else {
        range = [];
        break;
      }
    }
  } else {
    if (iscelldata(txt)) {
      range.push(getcellrange(ctx, txt));
    }
  }
  return range;
}

export function isAllSelectedCellsInStatus(
  ctx: Context,
  attr: keyof Cell,
  status: any
) {
  // editing mode
  if (!_.isEmpty(ctx.luckysheetCellUpdate)) {
    const w = window.getSelection();
    if (!w) return false;
    if (w.rangeCount === 0) return false;
    const range = w.getRangeAt(0);
    if (range.collapsed === true) {
      return false;
    }
    const { endContainer } = range;
    const { startContainer } = range;
    const toElement = (n: Node | null): HTMLElement | null => {
      if (!n) return null;
      if (n.nodeType === Node.ELEMENT_NODE) return n as HTMLElement;
      return n.parentElement;
    };
    const startEl = toElement(startContainer);
    const endEl = toElement(endContainer);
    const editorRoot =
      startEl?.closest("#luckysheet-rich-text-editor") ??
      endEl?.closest("#luckysheet-rich-text-editor") ??
      (toElement(range.commonAncestorContainer) as HTMLElement | null);

    const isStyleActive = (element: HTMLElement) => {
      const computed = window.getComputedStyle(element);
      const fontWeight = (computed.fontWeight || "").toLowerCase();
      const fontStyle = (computed.fontStyle || "").toLowerCase();
      const textDecorationLine = // Safari support fallback
        // @ts-ignore
        (
          computed.textDecorationLine ||
          computed.textDecoration ||
          ""
        ).toLowerCase();
      const borderBottomWidth = (
        computed.borderBottomWidth || ""
      ).toLowerCase();

      if (status === 1) {
        if (attr === "bl") {
          if (fontWeight === "bold") return true;
          const n = Number(fontWeight);
          return !Number.isNaN(n) && n >= 600;
        }
        if (attr === "it") {
          return fontStyle === "italic" || fontStyle === "oblique";
        }
        if (attr === "cl") {
          return textDecorationLine.includes("line-through");
        }
        if (attr === "un") {
          return (
            textDecorationLine.includes("underline") ||
            (borderBottomWidth !== "" &&
              borderBottomWidth !== "0px" &&
              borderBottomWidth !== "0")
          );
        }
      }
      return false;
    };

    const selectedElements: HTMLElement[] = [];
    if (editorRoot) {
      const spans = editorRoot.querySelectorAll("span");
      spans.forEach((span) => {
        if (
          span.textContent &&
          span.textContent.length > 0 &&
          range.intersectsNode(span)
        ) {
          selectedElements.push(span);
        }
      });
    }

    if (selectedElements.length === 0) {
      if (startEl) selectedElements.push(startEl);
      if (endEl && endEl !== startEl) selectedElements.push(endEl);
    }

    if (selectedElements.length === 0) {
      return false;
    }

    return _.every(selectedElements, (el) => isStyleActive(el));
  }
  /* 获取选区内所有的单元格-扁平后的处理 */
  const cells = getFlattenedRange(ctx);
  const flowdata = getFlowdata(ctx);

  return cells.every(({ r, c }) => {
    const cell = flowdata?.[r]?.[c];
    if (_.isNil(cell)) {
      return false;
    }
    return cell[attr] === status;
  });
}

export function getFontStyleByCell(
  cell: Cell | null | undefined,
  checksAF?: any[],
  checksCF?: any,
  isCheck = true
) {
  const style: any = {};
  if (!cell) {
    return style;
  }
  // @ts-ignore
  _.forEach(cell, (v, key: keyof Cell) => {
    let value = cell[key];
    if (isCheck) {
      value = normalizedCellAttr(cell, key);
    }
    const valueNum = Number(value);
    if (key === "bl" && valueNum !== 0) {
      style.fontWeight = "bold";
    }

    if (key === "it" && valueNum !== 0) {
      style.fontStyle = "italic";
    }

    // if (key === "ff") {
    //   let f = value;
    //   if (!Number.isNaN(valueNum)) {
    //     f = locale_fontarray[parseInt(value)];
    //   } else {
    //     f = value;
    //   }
    //   style += "font-family: " + f + ";";
    // }

    if (key === "fs" && !_.isNil(value)) {
      style.fontSize = `${valueNum}pt`;
    }

    if (
      (key === "fc" && value !== "#000000") ||
      (checksAF?.length ?? 0) > 0 ||
      checksCF?.textColor
    ) {
      if (checksCF?.textColor) {
        style.color = checksCF.textColor;
      } else if ((checksAF?.length ?? 0) > 0) {
        [style.color] = checksAF!;
      } else {
        style.color = value;
      }
    }

    if (key === "cl" && valueNum !== 0) {
      style.textDecoration = "line-through";
    }

    if (key === "un" && (valueNum === 1 || valueNum === 3)) {
      // @ts-ignore
      const color = cell._color ?? cell.fc;
      // @ts-ignore
      const fs = cell._fontSize ?? cell.fs;
      style.borderBottom = `${Math.floor(fs / 9)}px solid ${color}`;
    }
  });
  return style;
}

export function getStyleByCell(
  ctx: Context,
  d: CellMatrix,
  r: number,
  c: number
) {
  let style: any = {};

  // 交替颜色
  //   const af_compute = alternateformat.getComputeMap();
  //   const checksAF = alternateformat.checksAF(r, c, af_compute);
  const checksAF: any = [];
  // 条件格式
  const cf_compute = getComputeMap(ctx);
  const checksCF = checkCF(r, c, cf_compute);

  const cell = d?.[r]?.[c];
  if (!cell) return {};

  if ("bg" in cell) {
    const value = normalizedCellAttr(cell, "bg");
    if (checksCF?.cellColor) {
      if (checksCF?.cellColor) {
        style.background = `${checksCF.cellColor}`;
      } else if (checksAF.length > 1) {
        style.background = `${checksAF[1]}`;
      } else {
        style.background = `${value}`;
      }
    } else {
      style.background = `${value}`;
    }
  }
  if ("ht" in cell) {
    const value = normalizedCellAttr(cell, "ht");
    if (Number(value) === 0) {
      style.textAlign = "center";
    } else if (Number(value) === 2) {
      style.textAlign = "right";
      style.overflowWrap = "anywhere";
    }
  }

  if ("tb" in cell) {
    if (Number(cell.tb) === 2) {
      style.overflowWrap = "anywhere";
    }
  }

  if ("ff" in cell) {
    const value = normalizedCellAttr(cell, "ff");
    const { fontarray } = locale(ctx);
    const ffIndex = parseInt(value, 10);
    style.fontFamily = Number.isNaN(ffIndex)
      ? value
      : fontarray[ffIndex] ?? value;
  }

  if ("vt" in cell) {
    const value = normalizedCellAttr(cell, "vt");
    if (Number(value) === 0) {
      style.alignItems = "center";
    } else if (Number(value) === 2) {
      style.alignItems = "flex-end";
    }
  }
  style = _.assign(style, getFontStyleByCell(cell, checksAF, checksCF));

  return style;
}

function normalizeInlineStringClipboardStyle(style: Record<string, any>) {
  const decorations = new Set<string>();
  const normalizedStyle: Record<string, any> = {
    color: style.color || "#000000",
    fontFamily: style.fontFamily || "Arial",
    fontSize: style.fontSize || "11pt",
    fontStyle: style.fontStyle || "normal",
    fontWeight: style.fontWeight || "400",
  };

  const backgroundColor = style.backgroundColor || style.background;
  if (
    backgroundColor &&
    backgroundColor !== "transparent" &&
    backgroundColor !== "rgba(0, 0, 0, 0)"
  ) {
    normalizedStyle.backgroundColor = backgroundColor;
  }

  if (typeof style.textDecoration === "string") {
    style.textDecoration
      .split(/\s+/)
      .filter(Boolean)
      .forEach((decoration: string) => decorations.add(decoration));
  }

  if (style.borderBottom) {
    decorations.add("underline");
    normalizedStyle.textDecorationSkipInk = "none";
  }

  if (decorations.size > 0) {
    normalizedStyle.textDecoration = Array.from(decorations).join(" ");
  }

  return normalizedStyle;
}

function buildClipboardCompatibleInlineRuns(text: string, styleAttr: string) {
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const segments = normalizedText.split("\n");

  return segments
    .map((segment, index) => {
      let html = "";

      if (segment.length > 0) {
        html += `<span style='${styleAttr}'>${segment}</span>`;
      }

      if (index < segments.length - 1) {
        html += `<span style='${styleAttr}'><br></span>`;
      }

      return html;
    })
    .join("");
}

export function getInlineStringHTML(
  r: number,
  c: number,
  data: CellMatrix,
  options?: {
    useSemanticMarkup?: boolean;
    isRichTextCopy?: boolean;
    inheritedStyle?: Record<string, string>;
  }
) {
  const ct = getCellValue(r, c, data, "ct");
  if (isInlineStringCT(ct)) {
    const strings = ct.s;
    let value = "";
    for (let i = 0; i < strings.length; i += 1) {
      const strObj = strings[i];
      if (strObj.v) {
        const baseStyle = {
          ...(options?.useSemanticMarkup ? options.inheritedStyle ?? {} : {}),
          ...getFontStyleByCell(strObj),
        };
        const style = options?.useSemanticMarkup
          ? normalizeInlineStringClipboardStyle(baseStyle)
          : baseStyle;
        // Explicitly set default text styles so Google Sheets preserves
        // mixed rich-text runs instead of inheriting formatting between spans.
        if (!style.fontWeight) {
          style.fontWeight = "400";
        }
        if (!style.fontStyle) {
          style.fontStyle = "normal";
        }
        if (!style.fontSize) {
          style.fontSize = "11pt";
        }
        if (!style.fontFamily) {
          style.fontFamily = "Arial";
        }
        const { link } = strObj as any;
        if (link?.linkType && link?.linkAddress) {
          style.color = style.color || "rgb(0, 0, 255)";
          if (options?.useSemanticMarkup) {
            style.textDecoration = style.textDecoration
              ? `${style.textDecoration} underline`
              : "underline";
            style.textDecorationSkipInk = "none";
          } else {
            style.borderBottom =
              style.borderBottom || "1px solid rgb(0, 0, 255)";
          }
        }
        const styleStr = _.toPairs(style)
          .filter(([, v]) => !_.isNil(v) && v !== "" && v !== "undefined")
          .map(([key, v]) => {
            return `${_.kebabCase(key)}:${_.isNumber(v) ? `${v}px` : v};`;
          })
          .join(" ");
        const dataAttrs =
          !options?.useSemanticMarkup && link?.linkType && link?.linkAddress
            ? ` data-link-type='${String(link.linkType).replace(
              /'/g,
              "&#39;"
            )}' data-link-address='${String(link.linkAddress).replace(
              /'/g,
              "&#39;"
            )}'`
            : "";
        if (options?.isRichTextCopy) {
          if (options?.useSemanticMarkup) {
            value += buildClipboardCompatibleInlineRuns(strObj.v, styleStr);
          } else {
            // Convert newlines to <br> so apps that don't honour white-space:pre-wrap
            // (e.g. Google Sheets clipboard parser) still see proper line breaks.
            const segmentText = strObj.v
              .replace(/\r\n/g, "<br>")
              .replace(/\n/g, "<br>");
            value += `<span class="luckysheet-input-span" index='${i}' style='${styleStr}'${dataAttrs}>${segmentText}</span>`;
          }
        } else {
          value += `<span class="luckysheet-input-span" index='${i}' style='${styleStr}'${dataAttrs}>${strObj.v}</span>`;
        }
      }
    }
    return value;
  }
  return "";
}

export function getQKBorder(width: string, type: string, color: string) {
  let bordertype = "";

  if (width.toString().indexOf("pt") > -1) {
    const nWidth = parseFloat(width);

    if (nWidth < 1) {
    } else if (nWidth < 1.5) {
      bordertype = "Medium";
    } else {
      bordertype = "Thick";
    }
  } else {
    const nWidth = parseFloat(width);

    if (nWidth < 2) {
    } else if (nWidth < 3) {
      bordertype = "Medium";
    } else {
      bordertype = "Thick";
    }
  }

  let style = 0;
  type = type.toLowerCase();

  if (type === "double") {
    style = 2;
  } else if (type === "dotted") {
    if (bordertype === "Medium" || bordertype === "Thick") {
      style = 3;
    } else {
      style = 10;
    }
  } else if (type === "dashed") {
    if (bordertype === "Medium" || bordertype === "Thick") {
      style = 4;
    } else {
      style = 9;
    }
  } else if (type === "solid") {
    if (bordertype === "Medium") {
      style = 8;
    } else if (bordertype === "Thick") {
      style = 13;
    } else {
      style = 1;
    }
  }

  return [style, color];
}

/**
 * 计算范围行高
 *
 * @param d 原始数据
 * @param r1 起始行
 * @param r2 截至行
 * @param cfg 配置
 * @returns 计算后的配置
 */
/*
export function rowlenByRange(
  ctx: Context,
  d: CellMatrix,
  r1: number,
  r2: number,
  cfg: any
) {
  const cfg_clone = _.cloneDeep(cfg);
  if (cfg_clone.rowlen == null) {
    cfg_clone.rowlen = {};
  }

  if (cfg_clone.customHeight == null) {
    cfg_clone.customHeight = {};
  }

  const canvas = $("#luckysheetTableContent").get(0).getContext("2d");
  canvas.textBaseline = "top"; // textBaseline以top计算

  for (let r = r1; r <= r2; r += 1) {
    if (cfg_clone.rowhidden != null && cfg_clone.rowhidden[r] != null) {
      continue;
    }

    let currentRowLen = ctx.defaultrowlen;

    if (cfg_clone.customHeight[r] === 1) {
      continue;
    }

    delete cfg_clone.rowlen[r];

    for (let c = 0; c < d[r].length; c += 1) {
      const cell = d[r][c];

      if (cell == null) {
        continue;
      }

      if (cell != null && (cell.v != null || isInlineStringCell(cell))) {
        let cellWidth;
        if (cell.mc) {
          if (c === cell.mc.c) {
            const st_cellWidth = colLocationByIndex(
              c,
              ctx.visibledatacolumn
            )[0];
            const ed_cellWidth = colLocationByIndex(
              cell.mc.c + cell.mc.cs - 1,
              ctx.visibledatacolumn
            )[1];
            cellWidth = ed_cellWidth - st_cellWidth - 2;
          } else {
            continue;
          }
        } else {
          cellWidth =
            colLocationByIndex(c, ctx.visibledatacolumn)[1] -
            colLocationByIndex(c, ctx.visibledatacolumn)[0] -
            2;
        }

       const textInfo = getCellTextInfo(cell, canvas, {
          r,
          c,
          cellWidth,
        });

        let computeRowlen = 0;

        if (textInfo != null) {
          computeRowlen = textInfo.textHeightAll + 2;
        }

        // 比较计算高度和当前高度取最大高度
        if (computeRowlen > currentRowLen) {
          currentRowLen = computeRowlen;
        }
      }
    }

    currentRowLen /= ctx.zoomRatio;

    if (currentRowLen !== ctx.defaultrowlen) {
      cfg_clone.rowlen[r] = currentRowLen;
    } else {
      if (cfg.rowlen?.[r]) {
        cfg_clone.rowlen[r] = cfg.rowlen[r];
      }
    }
  }

  return cfg_clone;
}
*/

export function getdatabyselection(
  ctx: Context,
  range: Selection | undefined,
  sheetId: string
) {
  if (range == null && ctx.luckysheet_select_save) {
    [range] = ctx.luckysheet_select_save;
  }

  if (!range) return [];

  if (range.row == null || range.row.length === 0) {
    return [];
  }

  // 取数据
  let d;
  let cfg;
  if (sheetId != null && sheetId !== ctx.currentSheetId) {
    d = ctx.luckysheetfile[getSheetIndex(ctx, sheetId)!].data;
    cfg = ctx.luckysheetfile[getSheetIndex(ctx, sheetId)!].config;
  } else {
    d = getFlowdata(ctx);
    cfg = ctx.config;
  }

  const data = [];
  for (let r = range.row[0]; r <= range.row[1]; r += 1) {
    if (d?.[r] == null) {
      continue;
    }
    if (cfg?.rowhidden != null && cfg.rowhidden[r] != null) {
      continue;
    }

    const row = [];

    for (let c = range.column[0]; c <= range.column[1]; c += 1) {
      if (cfg?.colhidden != null && cfg.colhidden[c] != null) {
        continue;
      }
      row.push(d[r][c]);
    }

    data.push(row);
  }
  return data;
}

export function luckysheetUpdateCell(
  ctx: Context,
  row_index: number,
  col_index: number
) {
  const flowdata = getFlowdata(ctx);
  const cell = flowdata?.[row_index]?.[col_index] as { f?: string } | null;
  if (cell?.f != null && String(cell.f).trim() !== "") {
    suppressFormulaRangeSelectionForInitialEdit(ctx);
  }
  ctx.luckysheetCellUpdate = [row_index, col_index];
}

export function getDataBySelectionNoCopy(ctx: Context, range: Selection) {
  if (!range || !range.row || range.row.length === 0) return [];
  const data = [];
  const flowData = getFlowdata(ctx);
  if (!flowData) return [];
  for (let r = range.row[0]; r <= range.row[1]; r += 1) {
    const row = [];
    if (ctx.config.rowhidden != null && ctx.config.rowhidden[r] != null) {
      continue;
    }
    for (let c = range.column[0]; c <= range.column[1]; c += 1) {
      let value = null;
      if (ctx.config.colhidden != null && ctx.config.colhidden[c] != null) {
        continue;
      }
      if (flowData[r] != null && flowData[r][c] != null) {
        value = flowData[r][c];
      }

      row.push(value);
    }

    data.push(row);
  }
  return data;
}

function keepOnlyValueParts(cell: Cell | null | undefined): Cell | null {
  if (!cell) return cell ?? null;
  const { v: rawValue, m: displayText, f: formula } = cell;
  return rawValue !== undefined ||
    displayText !== undefined ||
    formula !== undefined
    ? { v: rawValue, m: displayText, f: formula }
    : null;
}

export function clearSelectedCellFormat(ctx: Context) {
  const activeSheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (activeSheetIndex == null) return;

  const changeMap = new Map<string, any>();
  const activeSheetFile = ctx.luckysheetfile[activeSheetIndex];
  const selectedRanges = ctx.luckysheet_select_save;
  if (!activeSheetFile || !selectedRanges) return;

  const sheetData = activeSheetFile.data;

  selectedRanges.forEach(({ row: rowRange, column: columnRange }) => {
    const [startRow, endRow] = rowRange;
    const [startColumn, endColumn] = columnRange;

    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
      const rowCells = sheetData?.[rowIndex];
      if (!rowCells) continue;

      for (
        let columnIndex = startColumn;
        columnIndex <= endColumn;
        columnIndex++
      ) {
        if (rowCells[columnIndex] === undefined) continue;
        rowCells[columnIndex] = keepOnlyValueParts(
          rowCells[columnIndex]
        ) as Cell;
        const v = (rowCells[columnIndex] as any) ?? null;
        const key = `${rowIndex}_${columnIndex}`;
        changeMap.set(key, {
          sheetId: ctx.currentSheetId,
          path: ["celldata"],
          key,
          value: { r: rowIndex, c: columnIndex, v },
          type: v == null ? "delete" : "update",
        });
      }
    }
  });

  if (ctx?.hooks?.updateCellYdoc && changeMap.size > 0) {
    ctx.hooks.updateCellYdoc(Array.from(changeMap.values()));
  }
}

export function clearRowsCellsFormat(ctx: Context) {
  const activeSheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (activeSheetIndex == null) return;

  const changeMap = new Map<string, any>();
  const activeSheetFile = ctx.luckysheetfile[activeSheetIndex];
  const selectedRanges = ctx.luckysheet_select_save;
  if (!activeSheetFile || !selectedRanges) return;

  const sheetData = activeSheetFile.data;
  const columnCount = sheetData?.[0]?.length ?? 0;

  selectedRanges.forEach(({ row: rowRange }) => {
    const [startRow, endRow] = rowRange;

    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
      const rowCells = sheetData?.[rowIndex];
      if (!rowCells) continue;

      for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
        if (rowCells[columnIndex] === undefined) continue;
        rowCells[columnIndex] = keepOnlyValueParts(
          rowCells[columnIndex]
        ) as Cell;
        const v = (rowCells[columnIndex] as any) ?? null;
        const key = `${rowIndex}_${columnIndex}`;
        changeMap.set(key, {
          sheetId: ctx.currentSheetId,
          path: ["celldata"],
          key,
          value: { r: rowIndex, c: columnIndex, v },
          type: v == null ? "delete" : "update",
        });
      }
    }
  });

  if (ctx?.hooks?.updateCellYdoc && changeMap.size > 0) {
    ctx.hooks.updateCellYdoc(Array.from(changeMap.values()));
  }
}

export function clearColumnsCellsFormat(ctx: Context) {
  const activeSheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (activeSheetIndex == null) return;

  const changeMap = new Map<string, any>();
  const activeSheetFile = ctx.luckysheetfile[activeSheetIndex];
  const selectedRanges = ctx.luckysheet_select_save;
  if (!activeSheetFile || !selectedRanges) return;

  const sheetData = activeSheetFile.data as Cell[][];
  const rowCount = sheetData.length;

  selectedRanges.forEach(({ column: columnRange }) => {
    const [startColumn, endColumn] = columnRange;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const rowCells = sheetData[rowIndex];
      if (!rowCells) continue;

      for (
        let columnIndex = startColumn;
        columnIndex <= endColumn;
        columnIndex++
      ) {
        if (rowCells[columnIndex] === undefined) continue;
        rowCells[columnIndex] = keepOnlyValueParts(
          rowCells[columnIndex]
        ) as Cell;
        const v = (rowCells[columnIndex] as any) ?? null;
        const key = `${rowIndex}_${columnIndex}`;
        changeMap.set(key, {
          sheetId: ctx.currentSheetId,
          path: ["celldata"],
          key,
          value: { r: rowIndex, c: columnIndex, v },
          type: v == null ? "delete" : "update",
        });
      }
    }
  });

  if (ctx?.hooks?.updateCellYdoc && changeMap.size > 0) {
    ctx.hooks.updateCellYdoc(Array.from(changeMap.values()));
  }
}
