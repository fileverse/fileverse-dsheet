export function moveToEnd(obj: HTMLDivElement) {
  if (document.createRange) {
    // chrome, firefox, opera, safari, ie9+
    if (obj.innerHTML !== obj.innerText || obj.innerHTML === '') {
      obj.focus(); // 解决ff不获取焦点无法定位问题
      const range = window.getSelection(); // 创建range
      range?.selectAllChildren(obj); // range 选择obj下所有子内容
      range?.collapseToEnd(); // 光标移至最后
    } else {
      const len = obj.innerText.length;
      const range = document.createRange();
      range.selectNodeContents(obj);
      range.setStart(obj.childNodes[0], len);
      range.collapse(true);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    // @ts-ignore
  } else if (document.selection) {
    // ie8 and lower
    // @ts-ignore
    const range = document.body.createTextRange();
    range.moveToElementText(obj);
    range.collapse(false);
    range.select();
  }
}

function isInPage(node: Node) {
  return node === document.body ? false : document.body.contains(node);
}

export function selectTextContent(ele: HTMLElement) {
  if (window.getSelection) {
    const range = document.createRange();
    const content = ele.firstChild as Text;
    if (content) {
      range.setStart(content, 0);
      range.setEnd(content, content.length);
      if (range.startContainer && isInPage(range.startContainer)) {
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
    // @ts-ignore
  } else if (document.selection) {
    // @ts-ignore
    const range = document.body.createTextRange();
    range.moveToElementText(ele);
    range.select();
  }
}

export function selectTextContentCross(sEle: HTMLElement, eEle: HTMLElement) {
  if (window.getSelection) {
    const range = document.createRange();
    const sContent = sEle.firstChild;
    const eContent = eEle.firstChild as Text;
    if (sContent && eContent) {
      range.setStart(sContent, 0);
      range.setEnd(eContent, eContent.length);
      if (range.startContainer && isInPage(range.startContainer)) {
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  }
}

/** Returns character offsets of the current selection within the element, or null if collapsed/outside. */
export function getSelectionCharacterOffsets(
  element: Node,
): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return null;
  if (
    !element.contains(range.startContainer) ||
    !element.contains(range.endContainer)
  ) {
    return null;
  }
  const pre = document.createRange();
  pre.selectNodeContents(element);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { start, end: start + range.toString().length };
}

/** Sets the selection in the element to the character range [start, end] and focuses it. */
export function setSelectionByCharacterOffset(
  element: HTMLDivElement,
  start: number,
  end: number,
) {
  element.focus();
  const sel = window.getSelection();
  if (!sel) return;
  let charIndex = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (startNode == null && charIndex + len > start) {
        startNode = node;
        startOffset = start - charIndex;
      }
      if (endNode == null && charIndex + len >= end) {
        endNode = node;
        endOffset = end - charIndex;
        return true;
      }
      charIndex += len;
      return false;
    }
    for (let i = 0; i < node.childNodes.length; i += 1) {
      if (walk(node.childNodes[i])) return true;
    }
    return false;
  }
  walk(element);
  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/**
 * Returns the bounding client rects for a character range in the element.
 * Does not change the current selection. Used to draw a persistent highlight
 * (e.g. when the link modal is open and focus moved away from the input).
 */
export function getRangeRectsByCharacterOffset(
  element: HTMLDivElement,
  start: number,
  end: number,
): DOMRect[] {
  if (start >= end) return [];
  let charIndex = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (startNode == null && charIndex + len > start) {
        startNode = node;
        startOffset = start - charIndex;
      }
      if (endNode == null && charIndex + len >= end) {
        endNode = node;
        endOffset = end - charIndex;
        return true;
      }
      charIndex += len;
      return false;
    }
    for (let i = 0; i < node.childNodes.length; i += 1) {
      if (walk(node.childNodes[i])) return true;
    }
    return false;
  }
  walk(element);
  if (!startNode || !endNode) return [];
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const rects = range.getClientRects();
  return Array.from(rects);
}
