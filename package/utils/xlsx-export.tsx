import { utils as XLSXUtil, writeFile as XLSXWriteFile } from "xlsx-js-style";
import { Sheet } from "@fileverse-dev/fortune-react";
import * as Y from "yjs";
import { WorkbookInstance } from "@fileverse-dev/fortune-react";
import { MutableRefObject } from "react";


const parseColorToHex = (color: string): string | null => {
  if (!color || typeof color !== "string") return null;

  // Trim & lowercase for detection
  const c = color.trim().toLowerCase();

  // CASE 1: Already HEX (#fff or #ffffff)
  if (c.startsWith("#")) {
    const hex = c.replace("#", "").toUpperCase();

    if (hex.length === 3) {
      // Expand shortened hex (#f00 → #FF0000)
      return hex
        .split("")
        .map((x) => x + x)
        .join("")
        .toUpperCase();
    }

    if (hex.length === 6) return hex;
    return null; // invalid hex
  }

  // -------------------------------
  // CASE 2: RGB or RGBA
  // supports:
  // rgb(255,0,0)
  // rgba(255,0,0,1)
  // rgba(255 0 0 / 1)
  // rgb(  255 , 100 ,   0 )
  // -------------------------------
  const rgbRegex =
    /rgba?\s*\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+[\d.]+)?\s*\)/i;

  const match = c.match(rgbRegex);

  if (match) {
    const r = Math.min(255, Math.max(0, parseFloat(match[1])));
    const g = Math.min(255, Math.max(0, parseFloat(match[2])));
    const b = Math.min(255, Math.max(0, parseFloat(match[3])));

    return (
      ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1)
        .toUpperCase()
    );
  }

  // Unknown format → ignore styling
  return null;
};


export const handleExportToXLSX = async (
  workbookRef: MutableRefObject<WorkbookInstance | null>,
  ydocRef: MutableRefObject<Y.Doc | null>,
  dsheetId: string,
  getDocumentTitle?: () => string
) => {
  if (!workbookRef.current || !ydocRef.current) return;

  try {
    const ydoc = ydocRef.current;

    const sheetArray = ydoc.getArray(dsheetId);
    const sheetData = Array.from(sheetArray) as Sheet[];

    const sheetWithData = workbookRef.current.getAllSheets();
    const workbook = XLSXUtil.book_new();

    sheetData.forEach((sheet, index) => {
      const rows = sheetWithData[index]?.data || [];

      const worksheet: any = XLSXUtil.aoa_to_sheet(rows);

      // APPLY MERGED CELLS
      worksheet["!merges"] = [];
      if (sheet.config?.merge) {
        Object.values(sheet.config.merge).forEach((m: any) => {
          worksheet["!merges"].push({
            s: { r: m.r, c: m.c },
            e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 },
          });
        });
      }

      // APPLY COLUMN WIDTH
      if (sheet.config?.columnlen) {
        worksheet["!cols"] = [];
        Object.entries(sheet.config.columnlen).forEach(([col, w]) => {
          worksheet["!cols"][Number(col)] = { wpx: Number(w) };
        });
      }

      // ROW HEIGHT
      if (sheet.config?.rowlen) {
        worksheet["!rows"] = [];
        Object.entries(sheet.config.rowlen).forEach(([row, h]) => {
          worksheet["!rows"][Number(row)] = { hpx: Number(h) };
        });
      }

      // PROCESS CELL DATA
      (sheet.celldata ?? []).forEach((cell: any) => {
        const r = cell.r;
        const c = cell.c;
        const v = cell.v || {};

        const cellRef = XLSXUtil.encode_cell({ r, c });

        let newCell: any = worksheet[cellRef] || {};
        newCell = { ...newCell };

        // -----------------------------
        // VALUE + FORMULA
        // -----------------------------
        if (v.f) newCell.f = v.f.replace(/^=/, "");
        newCell.v = v.v || v?.ct?.s?.[0]?.v;
        ;
        if (v.m) newCell.w = v.m;

        // -----------------------------
        // NUMBER FORMAT
        // -----------------------------
        if (v.ct) {
          if (v.ct.fa) newCell.z = v.ct.fa;
          if (v.ct.t) newCell.t = v.ct.t;
        }

        // -----------------------------
        // STYLE OBJECT
        // -----------------------------
        newCell.s = newCell.s || {};

        // ============ FILL ============
        console.log(v.bg);
        if (v.bg) {
          const hex = parseColorToHex(v.bg);
          if (hex) {
            newCell.s.fill = {
              patternType: "solid",
              fgColor: { rgb: hex },
            };
          }
        }

        // ============ FONT ============
        newCell.s.font = {
          ...(newCell.s.font || {}),
          bold: v.bl === 1 || undefined,
          italic: v.it === 1 || undefined,
          strike: v.cl === 1 || undefined,
          underline: v.un === 1 || undefined,

          sz: v.fs ?? undefined,
          name: v.ff ?? undefined,

          color: v.fc ? { rgb: v.fc.replace("#", "") } : undefined,
        };

        // ============ ALIGNMENT ============
        const HT_MAP: any = { "0": "center", "1": "left", "2": "right" };
        const VT_MAP: any = { "0": "center", "1": "top", "2": "bottom" };

        newCell.s.alignment = {
          ...(newCell.s.alignment || {}),
          wrapText: v.tb === "1" || v.tb === "2" ? true : undefined,
          textRotation: v.tr !== undefined ? v.tr : undefined,
        };

        newCell.s.alignment.horizontal = HT_MAP[v.ht] || undefined;
        newCell.s.alignment.vertical = VT_MAP[v.vt] || undefined;

        if (v.tb !== undefined) {
          newCell.s.alignment = newCell.s.alignment || {};

          if (v.tb === "1") {
            newCell.s.alignment.wrapText = true;   // Wrap text
          } else if (v.tb === "2") {
            newCell.s.alignment.shrinkToFit = true; // Clip text
          }
          // "0" → overflow → do nothing
        }


        worksheet[cellRef] = newCell;
      });

      const subSheetName =
        sheet.name.length > 30 ? sheet.name.slice(0, 30) : sheet.name;

      XLSXUtil.book_append_sheet(workbook, worksheet, subSheetName);
    });

    let title = (await getDocumentTitle?.()) || "Sheet";
    title = title.length > 30 ? title.slice(0, 30) : title;

    XLSXWriteFile(workbook, `${title}.xlsx`, {
      bookType: "xlsx",
      compression: true,
    });
  } catch (error) {
    console.error("Export failed:", error);
  }
};
