import _ from "lodash";
import { Context } from "../context";
import { Cell, CellMatrix, CellStyle, HyperlinkEntry } from "../types";
import { getCellValue, getFontStyleByCell } from "./cell";
import { selectTextContent, selectTextContentCross } from "./cursor";

export const attrToCssName = {
  bl: "font-weight",
  it: "font-style",
  ff: "font-family",
  fs: "font-size",
  fc: "color",
  cl: "text-decoration",
  un: "border-bottom",
};

export const inlineStyleAffectAttribute = {
  bl: 1,
  it: 1,
  ff: 1,
  cl: 1,
  un: 1,
  fs: 1,
  fc: 1,
};

export const inlineStyleAffectCssName = {
  "font-weight": 1,
  "font-style": 1,
  "font-family": 1,
  "text-decoration": 1,
  "border-bottom": 1,
  "font-size": 1,
  color: 1,
};

export function isInlineStringCell(cell: any): boolean {
  return cell?.ct?.t === "inlineStr" && (cell?.ct?.s?.length ?? 0) > 0;
}

export function isInlineStringCT(ct: any): boolean {
  return ct?.t === "inlineStr" && (ct?.s?.length ?? 0) > 0;
}

export function getInlineStringNoStyle(r: number, c: number, data: CellMatrix) {
  const ct = getCellValue(r, c, data, "ct");
  if (isInlineStringCT(ct)) {
    const strings = ct.s;
    let value = "";
    for (let i = 0; i < strings.length; i += 1) {
      const strObj = strings[i];
      if (strObj.v) {
        value += strObj.v;
      }
    }
    return value;
  }
  return "";
}

export function convertCssToStyleList(cssText: string, originCell: Cell) {
  if (_.isEmpty(cssText)) {
    return {};
  }
  const cssTextArray = cssText.split(";");

  const styleList: CellStyle = {
    // ff: locale_fontarray[0], // font family
    fc: originCell.fc || "#000000", // font color
    fs: originCell.fs || 10, // font size
    cl: originCell.cl || 0, // strike
    un: originCell.un || 0, // underline
    bl: originCell.bl || 0, // blod
    it: originCell.it || 0, // italic
    ff: originCell.ff || 0, // font family
  };
  cssTextArray.forEach((s) => {
    s = s.toLowerCase();
    const key = _.trim(s.substring(0, s.indexOf(":")));
    const value = _.trim(s.substring(s.indexOf(":") + 1));
    if (key === "font-weight") {
      if (value === "bold") {
        styleList.bl = 1;
      }
    }

    if (key === "font-style") {
      if (value === "italic") {
        styleList.it = 1;
      }
    }

    // if (key === "font-family") {
    //   const ff = locale_fontjson[value];
    //   if (ff === null) {
    //     styleList.ff = value;
    //   } else {
    //     styleList.ff = ff;
    //   }
    // }

    if (key === "font-size") {
      styleList.fs = parseInt(value, 10);
    }

    if (key === "color") {
      styleList.fc = value;
    }

    if (key === "text-decoration" || key === "text-decoration-line") {
      if (value.includes("underline")) {
        styleList.un = 1;
      }

      if (value.includes("line-through")) {
        styleList.cl = 1;
      }
    }

    if (key === "border-bottom") {
      styleList.un = 1;
    }

    if (key === "lucky-strike") {
      styleList.cl = Number(value);
    }

    if (key === "lucky-underline") {
      styleList.un = Number(value);
    }
  });

  return styleList;
}

export type InlineSegmentLink = { linkType: string; linkAddress: string };

export function getHyperlinksFromInlineSegments(
  cell: Cell | null | undefined
): InlineSegmentLink[] {
  const out: InlineSegmentLink[] = [];
  const seen = new Set<string>();
  if (cell?.ct?.t === "inlineStr" && Array.isArray(cell.ct.s)) {
    for (const seg of cell.ct.s as { link?: InlineSegmentLink; v?: string }[]) {
      const link = seg?.link;
      if (link?.linkType && link?.linkAddress) {
        const key = `${link.linkType}\u0001${link.linkAddress}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ linkType: link.linkType, linkAddress: link.linkAddress });
        }
      }
    }
  }
  return out;
}

function normalizeCssColorForCompare(fc: string): string {
  return fc.trim().toLowerCase().replace(/\s+/g, "");
}

/** Matches `getLinkStyleCssText` / apply-hyperlink blue foreground in the editor. */
export function isDefaultHyperlinkForeground(fc: string): boolean {
  const n = normalizeCssColorForCompare(fc);
  return (
    n === "rgb(0,0,255)" ||
    n === "#0000ff" ||
    n === "#00f" ||
    n === "blue"
  );
}

/**
 * Drop fc/un that hyperlink insertion adds to inline runs (link metadata is removed separately).
 * Preserves user bold/italic/etc. on the same segment.
 */
export function stripInlineSegmentHyperlinkDecoration(seg: CellStyle) {
  if (typeof seg.fc === "string" && isDefaultHyperlinkForeground(seg.fc)) {
    delete seg.fc;
  }
  if (seg.un === 1) {
    delete seg.un;
  }
}

export function convertSpanToShareString(
  // eslint-disable-next-line no-undef
  $dom: NodeListOf<HTMLSpanElement>,
  originCell: Cell
) {
  const styles: (CellStyle & { v?: string; link?: InlineSegmentLink })[] = [];
  let preStyleList:
    | (CellStyle & { v?: string; link?: InlineSegmentLink })
    | null = null;
  let preStyleListString = null;
  for (let i = 0; i < $dom.length; i += 1) {
    const span = $dom[i];
    const styleList = convertCssToStyleList(
      span.style.cssText,
      originCell
    ) as CellStyle & { v?: string; link?: InlineSegmentLink };

    if (span.dataset?.linkType && span.dataset?.linkAddress) {
      styleList.link = {
        linkType: span.dataset.linkType,
        linkAddress: span.dataset.linkAddress,
      };
    }

    const curStyleListString = JSON.stringify(_.omit(styleList, "link"));
    let v = span.innerText;
    if (span.dataset?.noLinkAnchor === "1") {
      // Anchor span inserted after link insertion to break hyperlink continuation.
      // If user types in this span it becomes "\u00A0text".
      // Preserve one real separator space so linked + non-linked words don't merge.
      if (v.startsWith("\u00A0")) {
        v = v.length === 1 ? "" : ` ${v.slice(1)}`;
      }
      if (v.length === 0) continue;
    }
    v = v.replace(/\n/g, "\r\n");
    if (i === $dom.length - 1) {
      if (v.endsWith("\r\n") && !v.endsWith("\r\n\r\n")) {
        v = v.slice(0, v.length - 2);
      }
    }

    if (
      curStyleListString === preStyleListString &&
      _.isEqual(preStyleList?.link, styleList.link)
    ) {
      preStyleList!.v! += v;
    } else {
      styleList.v = v;
      styles.push(styleList);
      preStyleListString = curStyleListString;
      preStyleList = styleList;
    }
  }
  return styles;
}

export function updateInlineStringFormatOutside(
  cell: Cell,
  key: string,
  value: any
) {
  if (_.isNil(cell.ct)) {
    return;
  }
  const { s } = cell.ct;
  if (_.isNil(s)) {
    return;
  }
  for (let i = 0; i < s.length; i += 1) {
    const item = s[i];
    item[key] = value;
  }
}

function getClassWithcss(cssText: string, ukey: string) {
  const cssTextArray = cssText.split(";");
  if (ukey == null || ukey.length === 0) {
    return cssText;
  }
  if (cssText.indexOf(ukey) > -1) {
    for (let i = 0; i < cssTextArray.length; i += 1) {
      let s = cssTextArray[i];
      s = s.toLowerCase();
      const key = _.trim(s.substring(0, s.indexOf(":")));
      const value = _.trim(s.substring(s.indexOf(":") + 1));
      if (key === ukey) {
        return value;
      }
    }
  }

  return "";
}

function upsetClassWithCss(cssText: string, ukey: string, uvalue: any) {
  const cssTextArray = cssText.split(";");
  let newCss = "";
  if (ukey == null || ukey.length === 0) {
    return cssText;
  }
  if (cssText.indexOf(ukey) > -1) {
    for (let i = 0; i < cssTextArray.length; i += 1) {
      let s = cssTextArray[i];
      s = s.toLowerCase();
      const key = _.trim(s.substring(0, s.indexOf(":")));
      const value = _.trim(s.substring(s.indexOf(":") + 1));
      if (key === ukey) {
        newCss += `${key}:${uvalue};`;
      } else if (key.length > 0) {
        newCss += `${key}:${value};`;
      }
    }
  } else if (ukey.length > 0) {
    cssText += `${ukey}:${uvalue};`;
    newCss = cssText;
  }

  return newCss;
}

function removeClassWidthCss(cssText: string, ukey: string) {
  const cssTextArray = cssText.split(";");
  let newCss = "";
  const oUkey = ukey;
  if (ukey == null || ukey.length === 0) {
    return cssText;
  }
  if (ukey in attrToCssName) {
    // @ts-ignore
    ukey = attrToCssName[ukey];
  }
  if (cssText.indexOf(ukey) > -1) {
    for (let i = 0; i < cssTextArray.length; i += 1) {
      let s = cssTextArray[i];
      s = s.toLowerCase();
      const key = _.trim(s.substring(0, s.indexOf(":")));
      const value = _.trim(s.substring(s.indexOf(":") + 1));
      if (
        key === ukey ||
        (oUkey === "cl" && key === "lucky-strike") ||
        (oUkey === "un" && key === "lucky-underline")
      ) {
        continue;
      } else if (key.length > 0) {
        newCss += `${key}:${value};`;
      }
    }
  } else {
    newCss = cssText;
  }

  return newCss;
}

function getCssText(cssText: string, attr: keyof Cell, value: any) {
  const styleObj: any = {};
  styleObj[attr] = value;
  if (attr === "un") {
    let fontColor = getClassWithcss(cssText, "color");
    if (fontColor === "") {
      fontColor = "#000000";
    }
    let fs = getClassWithcss(cssText, "font-size");
    if (fs === "") {
      fs = "11";
    }
    styleObj._fontSize = Number(fs);
    styleObj._color = fontColor;
  }
  const s = getFontStyleByCell(styleObj, undefined, undefined, false);
  // let cssText = span.style.cssText;
  cssText = removeClassWidthCss(cssText, attr);
  if (_.isEmpty(s)) {
    return cssText;
  }
  const ukey = _.kebabCase(Object.keys(s)[0]);
  const uvalue = Object.values(s)[0];

  cssText = upsetClassWithCss(cssText, ukey, uvalue);

  return cssText;
}

function extendCssText(origin: string, cover: string, isLimit = true) {
  const originArray = origin.split(";");
  const coverArray = cover.split(";");
  let newCss = "";

  const addKeyList: any = {};
  for (let i = 0; i < originArray.length; i += 1) {
    let so = originArray[i];
    let isAdd = true;
    so = so.toLowerCase();
    const okey = _.trim(so.substring(0, so.indexOf(":")));

    /* 不设置文字的大小，解决设置删除线等后字体变大的问题 */
    if (okey === "font-size") {
      continue;
    }

    const ovalue = _.trim(so.substring(so.indexOf(":") + 1));

    if (isLimit) {
      if (!(okey in inlineStyleAffectCssName)) {
        continue;
      }
    }

    for (let a = 0; a < coverArray.length; a += 1) {
      let sc = coverArray[a];
      sc = sc.toLowerCase();
      const ckey = _.trim(sc.substring(0, sc.indexOf(":")));
      const cvalue = _.trim(sc.substring(sc.indexOf(":") + 1));

      if (okey === ckey) {
        newCss += `${ckey}:${cvalue};`;
        isAdd = false;
        continue;
      }
    }

    if (isAdd) {
      newCss += `${okey}:${ovalue};`;
    }

    addKeyList[okey] = 1;
  }

  for (let a = 0; a < coverArray.length; a += 1) {
    let sc = coverArray[a];
    sc = sc.toLowerCase();
    const ckey = _.trim(sc.substring(0, sc.indexOf(":")));
    const cvalue = _.trim(sc.substring(sc.indexOf(":") + 1));

    if (isLimit) {
      if (!(ckey in inlineStyleAffectCssName)) {
        continue;
      }
    }

    if (!(ckey in addKeyList)) {
      newCss += `${ckey}:${cvalue};`;
    }
  }

  return newCss;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function updateInlineStringFormat(
  ctx: Context,
  attr: keyof Cell,
  value: any,
  cellInput: HTMLDivElement
) {
  // let s = ctx.inlineStringEditCache;
  const w = window.getSelection();
  if (!w) return;
  if (w.rangeCount === 0) return;

  const range = w.getRangeAt(0);

  const $textEditor = cellInput;
  const editorText = ($textEditor.innerText ?? $textEditor.textContent ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const selectedText = (range.toString() ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Some browsers/contenteditable states produce element-based ranges for select-all
  // in multiline empty-cell edits where none of the span/text branches below match.
  // If the whole editor text is selected, apply formatting directly to all content.
  if (
    range.collapsed === false &&
    editorText.length > 0 &&
    selectedText === editorText
  ) {
    $textEditor.innerHTML = "";
    const wrapper = document.createElement("span");
    wrapper.setAttribute("style", getCssText("", attr, value));
    wrapper.textContent = editorText;
    $textEditor.appendChild(wrapper);

    const newRange = document.createRange();
    newRange.selectNodeContents($textEditor);
    w.removeAllRanges();
    w.addRange(newRange);
    return;
  }

  // Firefox (and sometimes other browsers) can produce element-based ranges
  // (e.g. Ctrl+A selects node contents: startContainer/endContainer are the editor DIV
  // and offsets are child-node indexes, not character indexes). The legacy string-slicing
  // logic below treats offsets as character positions and can accidentally inject the
  // editor's own outerHTML into itself. Handle element-based ranges safely first.
  if (
    range.startContainer === $textEditor &&
    range.endContainer === $textEditor &&
    range.collapsed === false
  ) {
    const start = range.startOffset;
    const end = range.endOffset;

    const children = Array.from($textEditor.childNodes).slice(start, end);
    let hasUnsupportedElementSelection = false;
    children.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === "SPAN") {
          const cssText = getCssText(el.style.cssText, attr, value);
          el.setAttribute("style", cssText);
        } else {
          const nestedSpans = el.querySelectorAll("span");
          if (nestedSpans.length > 0) {
            nestedSpans.forEach((nestedSpan) => {
              const cssText = getCssText(nestedSpan.style.cssText, attr, value);
              nestedSpan.setAttribute("style", cssText);
            });
          } else {
            hasUnsupportedElementSelection = true;
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        if (text.length === 0) return;
        const wrapper = document.createElement("span");
        const cssText = getCssText("", attr, value);
        wrapper.setAttribute("style", cssText);
        wrapper.textContent = text;
        node.parentNode?.replaceChild(wrapper, node);
      }
    });

    // Multiline typing in empty cells may create block nodes (div/br). Normalize
    // those into a styled span so select-all formatting always applies.
    if (hasUnsupportedElementSelection) {
      const fullText = $textEditor.innerText ?? $textEditor.textContent ?? "";
      $textEditor.innerHTML = "";
      const wrapper = document.createElement("span");
      wrapper.setAttribute("style", getCssText("", attr, value));
      wrapper.textContent = fullText;
      $textEditor.appendChild(wrapper);
    }

    // Restore selection across the whole editor contents.
    const newRange = document.createRange();
    newRange.selectNodeContents($textEditor);
    w.removeAllRanges();
    w.addRange(newRange);
    return;
  }

  if (range.collapsed === true) {
    return;
  }

  const { endContainer } = range;
  const { startContainer } = range;
  const { endOffset } = range;
  const { startOffset } = range;

  if ($textEditor) {
    if (startContainer === endContainer) {
      const span = startContainer.parentNode as HTMLElement | null;
      let spanIndex: number;
      let inherit = false;

      const content = span?.innerHTML || "";

      const fullContent = $textEditor.innerHTML;
      if (fullContent.substring(0, 5) !== "<span") {
        inherit = true;
      }

      if (span) {
        let left = "";
        let mid = "";
        let right = "";
        const s1 = 0;
        // startOffset/endOffset are character positions within the specific
        // startContainer text node, but content is span.innerHTML which may
        // include <br> tags (and other elements) before that text node when
        // the cell has multiple lines. Compute the absolute HTML offset by
        // summing the innerHTML contributions of all preceding sibling nodes.
        let htmlPre = 0;
        if (
          startContainer.nodeType === Node.TEXT_NODE &&
          span.childNodes.length > 1
        ) {
          for (let i = 0; i < span.childNodes.length; i += 1) {
            const child = span.childNodes[i];
            if (child === startContainer) break;
            if (child.nodeType === Node.TEXT_NODE) {
              htmlPre += (child.textContent || "").length;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              htmlPre += (child as HTMLElement).outerHTML.length;
            }
          }
        }
        const s2 = htmlPre + startOffset;
        const s3 = htmlPre + endOffset;
        const s4 = content.length;
        left = content.substring(s1, s2);
        mid = content.substring(s2, s3);
        right = content.substring(s3, s4);

        let cont = "";
        if (left !== "") {
          let { cssText } = span.style;
          if (inherit) {
            const box = span.closest(
              "#luckysheet-input-box"
            ) as HTMLElement | null;
            if (box != null) {
              cssText = extendCssText(box.style.cssText, cssText);
            }
          }
          cont += `<span style="${escapeHtmlAttr(cssText)}">${left}</span>`;
        }

        if (mid !== "") {
          let cssText = getCssText(span.style.cssText, attr, value);

          if (inherit) {
            const box = span.closest(
              "#luckysheet-input-box"
            ) as HTMLElement | null;
            if (box != null) {
              cssText = extendCssText(box.style.cssText, cssText);
            }
          }

          cont += `<span style="${escapeHtmlAttr(cssText)}">${mid}</span>`;
        }

        if (right !== "") {
          let { cssText } = span.style;
          if (inherit) {
            const box = span.closest(
              "#luckysheet-input-box"
            ) as HTMLElement | null;
            if (box != null) {
              cssText = extendCssText(box.style.cssText, cssText);
            }
          }
          cont += `<span style="${escapeHtmlAttr(cssText)}">${right}</span>`;
        }

        if (startContainer.parentElement?.tagName === "SPAN") {
          spanIndex = _.indexOf($textEditor.querySelectorAll("span"), span);
          span.outerHTML = cont;
        } else {
          spanIndex = 0;
          span.innerHTML = cont;
        }

        let seletedNodeIndex = 0;
        if (s1 === s2) {
          seletedNodeIndex = spanIndex;
        } else {
          seletedNodeIndex = spanIndex + 1;
        }

        selectTextContent(
          $textEditor.querySelectorAll("span")[seletedNodeIndex]
        );
      }
    } else {
      if (
        startContainer.parentElement?.tagName === "SPAN" &&
        endContainer.parentElement?.tagName === "SPAN"
      ) {
        const startSpan = startContainer.parentNode as HTMLElement | null;
        const endSpan = endContainer.parentNode as HTMLElement | null;
        const allSpans = $textEditor.querySelectorAll("span");

        const startSpanIndex = _.indexOf(allSpans, startSpan);
        const endSpanIndex = _.indexOf(allSpans, endSpan);

        const startContent = startSpan?.innerHTML || "";
        const endContent = endSpan?.innerHTML || "";
        let sleft = "";
        let sright = "";
        let eleft = "";
        let eright = "";
        const s1 = 0;
        const s2 = startOffset;
        const s3 = endOffset;
        const s4 = endContent.length;

        sleft = startContent.substring(s1, s2);
        sright = startContent.substring(s2, startContent.length);

        eleft = endContent.substring(0, s3);
        eright = endContent.substring(s3, s4);
        let spans = $textEditor.querySelectorAll("span");
        // const replaceSpans = spans.slice(startSpanIndex, endSpanIndex + 1);
        let cont = "";
        for (let i = 0; i < startSpanIndex; i += 1) {
          const span = spans[i];
          const content = span.innerHTML;
          cont += `<span style="${escapeHtmlAttr(
            span.style.cssText
          )}">${content}</span>`;
        }
        if (sleft !== "") {
          cont += `<span style="${escapeHtmlAttr(
            startSpan!.style.cssText
          )}">${sleft}</span>`;
        }

        if (sright !== "") {
          const cssText = getCssText(startSpan!.style.cssText, attr, value);
          cont += `<span style="${escapeHtmlAttr(cssText)}">${sright}</span>`;
        }

        if (startSpanIndex < endSpanIndex) {
          for (let i = startSpanIndex + 1; i < endSpanIndex; i += 1) {
            const span = spans[i];
            const content = span.innerHTML;
            cont += `<span style="${escapeHtmlAttr(
              span.style.cssText
            )}">${content}</span>`;
          }
        }

        if (eleft !== "") {
          const cssText = getCssText(endSpan!.style.cssText, attr, value);
          cont += `<span style="${escapeHtmlAttr(cssText)}">${eleft}</span>`;
        }

        if (eright !== "") {
          cont += `<span style="${escapeHtmlAttr(
            endSpan!.style.cssText
          )}">${eright}</span>`;
        }

        for (let i = endSpanIndex + 1; i < spans.length; i += 1) {
          const span = spans[i];
          const content = span.innerHTML;
          cont += `<span style="${escapeHtmlAttr(
            span.style.cssText
          )}">${content}</span>`;
        }

        $textEditor.innerHTML = cont;

        // console.log(replaceSpans, cont);
        // replaceSpans.replaceWith(cont);

        let startSeletedNodeIndex;
        let endSeletedNodeIndex;
        if (s1 === s2) {
          startSeletedNodeIndex = startSpanIndex;
          endSeletedNodeIndex = endSpanIndex;
        } else {
          startSeletedNodeIndex = startSpanIndex + 1;
          endSeletedNodeIndex = endSpanIndex + 1;
        }

        spans = $textEditor.querySelectorAll("span");

        selectTextContentCross(
          spans[startSeletedNodeIndex],
          spans[endSeletedNodeIndex]
        );
      }
    }
  }
}

function getLinkDataAttrs(span: HTMLElement): string {
  if (span.dataset?.linkType && span.dataset?.linkAddress) {
    return ` data-link-type="${escapeHtmlAttr(
      span.dataset.linkType
    )}" data-link-address="${escapeHtmlAttr(span.dataset.linkAddress)}"`;
  }
  return "";
}

function getLinkStyleCssText(baseCssText: string): string {
  let css = getCssText(baseCssText, "fc", "rgb(0, 0, 255)");
  css = getCssText(css, "un", 1);
  return css;
}

function placeCaretInPlainSpanAfterLinkedSpan(linkSpan: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;

  let target = linkSpan.nextElementSibling as HTMLElement | null;
  const canReuse =
    target &&
    target.tagName === "SPAN" &&
    !target.dataset?.linkType &&
    !target.dataset?.linkAddress;

  if (!canReuse) {
    target = document.createElement("span");
    target.className = "luckysheet-input-span";
    target.setAttribute("data-no-link-anchor", "1");
    target.textContent = "\u00A0";
    linkSpan.insertAdjacentElement("afterend", target);
  } else if (!target!.textContent) {
    target!.setAttribute("data-no-link-anchor", "1");
    target!.textContent = "\u00A0";
  }

  const textNode = target!.firstChild;
  if (!textNode) return;
  const r = document.createRange();
  r.setStart(textNode, textNode.textContent?.length || 0);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

function ensureEditorEndsWithPlainAnchorIfLastIsLink(editor: HTMLDivElement) {
  const spans = editor.querySelectorAll("span");
  if (spans.length === 0) return;
  const last = spans[spans.length - 1] as HTMLElement;
  if (!last?.dataset?.linkType || !last?.dataset?.linkAddress) return;
  const anchor = document.createElement("span");
  anchor.className = "luckysheet-input-span";
  anchor.setAttribute("data-no-link-anchor", "1");
  anchor.textContent = "\u00A0";
  last.insertAdjacentElement("afterend", anchor);
}

function getHtmlOffsetWithinSpan(
  span: HTMLElement,
  container: Node,
  textOffset: number
): number {
  if (container.nodeType !== Node.TEXT_NODE || span.childNodes.length <= 1) {
    return textOffset;
  }
  let htmlPre = 0;
  for (let i = 0; i < span.childNodes.length; i += 1) {
    const child = span.childNodes[i];
    if (child === container) break;
    if (child.nodeType === Node.TEXT_NODE) {
      htmlPre += (child.textContent || "").length;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      htmlPre += (child as HTMLElement).outerHTML.length;
    }
  }
  return htmlPre + textOffset;
}

/** Applies link style (blue + underline) and data-link-* to the current selection in cellInput. Persisted on blur via convertSpanToShareString. */
export function applyLinkToSelection(
  cellInput: HTMLDivElement,
  linkType: string,
  linkAddress: string
) {
  const w = window.getSelection();
  if (!w || w.rangeCount === 0) return;
  const range = w.getRangeAt(0);
  if (range.collapsed) return;

  const $textEditor = cellInput;
  const { endContainer, startContainer, endOffset, startOffset } = range;

  if (startContainer === endContainer) {
    const span = startContainer.parentNode as HTMLElement | null;
    const content = span?.innerHTML || "";
    const fullContent = $textEditor.innerHTML;
    const inherit = fullContent.substring(0, 5) !== "<span";
    const s2 = span
      ? getHtmlOffsetWithinSpan(span, startContainer, startOffset)
      : startOffset;
    const s3 = span
      ? getHtmlOffsetWithinSpan(span, endContainer, endOffset)
      : endOffset;
    const left = content.substring(0, s2);
    const mid = content.substring(s2, s3);
    const right = content.substring(s3, content.length);

    let cont = "";
    const dataAttrs = getLinkDataAttrs(span!);
    if (left !== "") {
      let { cssText } = span!.style;
      if (inherit) {
        const box = span!.closest(
          "#luckysheet-input-box"
        ) as HTMLElement | null;
        if (box != null) cssText = extendCssText(box.style.cssText, cssText);
      }
      cont += `<span style="${escapeHtmlAttr(
        cssText
      )}"${dataAttrs}>${left}</span>`;
    }
    if (mid !== "") {
      let cssText = getLinkStyleCssText(span!.style.cssText);
      if (inherit) {
        const box = span!.closest(
          "#luckysheet-input-box"
        ) as HTMLElement | null;
        if (box != null) cssText = extendCssText(box.style.cssText, cssText);
      }
      cont += `<span style="${escapeHtmlAttr(
        cssText
      )}" data-link-type="${escapeHtmlAttr(
        linkType
      )}" data-link-address="${escapeHtmlAttr(linkAddress)}">${mid}</span>`;
    }
    if (right !== "") {
      let { cssText } = span!.style;
      if (inherit) {
        const box = span!.closest(
          "#luckysheet-input-box"
        ) as HTMLElement | null;
        if (box != null) cssText = extendCssText(box.style.cssText, cssText);
      }
      cont += `<span style="${escapeHtmlAttr(
        cssText
      )}"${dataAttrs}>${right}</span>`;
    }
    if (startContainer.parentElement?.tagName === "SPAN") {
      (span as HTMLElement).outerHTML = cont;
    } else {
      span!.innerHTML = cont;
    }
    const newSpans = $textEditor.querySelectorAll("span");
    const linkSpanIndex = left === "" ? 0 : 1;
    if (newSpans[linkSpanIndex]) {
      placeCaretInPlainSpanAfterLinkedSpan(newSpans[linkSpanIndex] as HTMLElement);
    }
    ensureEditorEndsWithPlainAnchorIfLastIsLink($textEditor);
  } else if (
    startContainer.parentElement?.tagName === "SPAN" &&
    endContainer.parentElement?.tagName === "SPAN"
  ) {
    const startSpan = startContainer.parentNode as HTMLElement | null;
    const endSpan = endContainer.parentNode as HTMLElement | null;
    const allSpans = $textEditor.querySelectorAll("span");
    const startSpanIndex = _.indexOf(allSpans, startSpan);
    const endSpanIndex = _.indexOf(allSpans, endSpan);
    const startContent = startSpan?.innerHTML || "";
    const endContent = endSpan?.innerHTML || "";
    const s2 = startSpan
      ? getHtmlOffsetWithinSpan(startSpan, startContainer, startOffset)
      : startOffset;
    const s3 = endSpan
      ? getHtmlOffsetWithinSpan(endSpan, endContainer, endOffset)
      : endOffset;
    const sleft = startContent.substring(0, s2);
    const sright = startContent.substring(s2, startContent.length);
    const eleft = endContent.substring(0, s3);
    const eright = endContent.substring(s3, endContent.length);
    let spans = $textEditor.querySelectorAll("span");
    let cont = "";
    for (let i = 0; i < startSpanIndex; i += 1) {
      const sp = spans[i] as HTMLElement;
      cont += `<span style="${escapeHtmlAttr(
        sp.style.cssText
      )}"${getLinkDataAttrs(sp)}>${sp.innerHTML}</span>`;
    }
    if (sleft !== "") {
      cont += `<span style="${escapeHtmlAttr(
        startSpan!.style.cssText
      )}"${getLinkDataAttrs(startSpan!)}>${sleft}</span>`;
    }
    if (sright !== "") {
      const cssText = getLinkStyleCssText(startSpan!.style.cssText);
      cont += `<span style="${escapeHtmlAttr(
        cssText
      )}" data-link-type="${escapeHtmlAttr(
        linkType
      )}" data-link-address="${escapeHtmlAttr(linkAddress)}">${sright}</span>`;
    }
    if (startSpanIndex < endSpanIndex) {
      for (let i = startSpanIndex + 1; i < endSpanIndex; i += 1) {
        const sp = spans[i];
        const cssText = getLinkStyleCssText(sp.style.cssText);
        cont += `<span style="${escapeHtmlAttr(
          cssText
        )}" data-link-type="${escapeHtmlAttr(
          linkType
        )}" data-link-address="${escapeHtmlAttr(linkAddress)}">${sp.innerHTML
          }</span>`;
      }
    }
    if (eleft !== "") {
      const cssText = getLinkStyleCssText(endSpan!.style.cssText);
      cont += `<span style="${escapeHtmlAttr(
        cssText
      )}" data-link-type="${escapeHtmlAttr(
        linkType
      )}" data-link-address="${escapeHtmlAttr(linkAddress)}">${eleft}</span>`;
    }
    if (eright !== "") {
      cont += `<span style="${escapeHtmlAttr(
        endSpan!.style.cssText
      )}"${getLinkDataAttrs(endSpan!)}>${eright}</span>`;
    }
    for (let i = endSpanIndex + 1; i < spans.length; i += 1) {
      const sp = spans[i] as HTMLElement;
      cont += `<span style="${escapeHtmlAttr(
        sp.style.cssText
      )}"${getLinkDataAttrs(sp)}>${sp.innerHTML}</span>`;
    }
    $textEditor.innerHTML = cont;
    spans = $textEditor.querySelectorAll("span");
    const startSel = sleft === "" ? startSpanIndex : startSpanIndex + 1;
    const endSel = eright === "" ? endSpanIndex : endSpanIndex + 1;
    if (spans[endSel]) {
      placeCaretInPlainSpanAfterLinkedSpan(spans[endSel] as HTMLElement);
    } else {
      selectTextContentCross(spans[startSel], spans[endSel]);
    }
    ensureEditorEndsWithPlainAnchorIfLastIsLink($textEditor);
  }
}

function closestLinkFromNode(
  node: Node | null,
  root: HTMLElement
): HyperlinkEntry | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n instanceof HTMLElement) {
      const lt = n.dataset?.linkType;
      const la = n.dataset?.linkAddress;
      if (lt && la) return { linkType: lt, linkAddress: la };
    }
    n = n.parentNode;
  }
  return null;
}

/**
 * When the window selection is still inside the cell editor, read hyperlink from the
 * linked span(s) at both range endpoints (same link required).
 */
export function getUniformLinkFromWindowSelectionInEditor(
  root: HTMLElement
): HyperlinkEntry | undefined {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.anchorNode || !root.contains(sel.anchorNode))
    return undefined;
  const range = sel.getRangeAt(0);
  const startLink = closestLinkFromNode(range.startContainer, root);
  const endLink = closestLinkFromNode(range.endContainer, root);
  if (!startLink || !endLink) return undefined;
  if (
    startLink.linkType !== endLink.linkType ||
    startLink.linkAddress !== endLink.linkAddress
  ) {
    return undefined;
  }
  return startLink;
}

/**
 * Caret or range inside `root`: returns the hyperlink on the collapsed caret, or the
 * uniform link when a non-collapsed selection stays within one link (same as
 * {@link getUniformLinkFromWindowSelectionInEditor}).
 */
export function getHyperlinkAtCaretInContentEditable(
  root: HTMLElement
): HyperlinkEntry | undefined {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.anchorNode || !root.contains(sel.anchorNode))
    return undefined;
  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    const at = closestLinkFromNode(range.startContainer, root);
    return at ?? undefined;
  }
  return getUniformLinkFromWindowSelectionInEditor(root);
}
