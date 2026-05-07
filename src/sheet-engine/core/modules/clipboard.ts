function getNodePlainText(node: Node): string {
  if (node.nodeType === 3) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== 1) {
    return "";
  }

  const element = node as HTMLElement;

  if (element.tagName === "BR") {
    return "\n";
  }

  return Array.from(element.childNodes)
    .map((child) => getNodePlainText(child))
    .join("");
}

function normalizeClipboardCellText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/<br\s*\/?>/gi, "\n");
}

function formatTableCellForPlainText(value: string): string {
  const normalizedValue = normalizeClipboardCellText(value);

  if (/["\n\t]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

function tableToPlainText(table: HTMLTableElement): string {
  const grid: string[][] = [];

  Array.from(table.rows).forEach((row, rowIndex) => {
    grid[rowIndex] ??= [];
    let colIndex = 0;

    Array.from(row.cells).forEach((cell) => {
      while (grid[rowIndex][colIndex] !== undefined) {
        colIndex += 1;
      }

      const cellText = Array.from(cell.childNodes)
        .map((child) => getNodePlainText(child))
        .join("");
      const rowSpan = Math.max(Number(cell.getAttribute("rowspan")) || 1, 1);
      const colSpan = Math.max(Number(cell.getAttribute("colspan")) || 1, 1);

      for (let r = 0; r < rowSpan; r += 1) {
        const targetRow = rowIndex + r;
        grid[targetRow] ??= [];

        for (let c = 0; c < colSpan; c += 1) {
          grid[targetRow][colIndex + c] = r === 0 && c === 0 ? cellText : "";
        }
      }

      colIndex += colSpan;
    });
  });

  const columnCount = grid.reduce((max, row) => Math.max(max, row.length), 0);

  return grid
    .map((row) =>
      Array.from({ length: columnCount }, (_, index) => row[index] ?? "")
        .map((cell) => formatTableCellForPlainText(cell))
        .join("\t")
    )
    .join("\n");
}

function legacyHtmlToPlainText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
}

function htmlToPlainText(html: string): string {
  const legacyPlainText = legacyHtmlToPlainText(html);

  if (typeof document === "undefined" || !/<table[\s>]/i.test(html)) {
    return legacyPlainText;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  const table = container.querySelector("table");
  if (!table || table.rows.length === 0) {
    return legacyPlainText;
  }

  return tableToPlainText(table as HTMLTableElement);
}

function formatPlainTextForClipboard(
  plainText: string,
  isTableContent = false
): string {
  if (
    !isTableContent &&
    plainText.includes("\n") &&
    !plainText.includes("\t")
  ) {
    return `"${plainText.replace(/"/g, '""')}"`;
  }

  return plainText;
}

export default class clipboard {
  static writeText(text: string) {
    if (typeof navigator?.clipboard?.writeText === "function") {
      navigator.clipboard.writeText(text).catch((e) => console.error(e));
      return;
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-10000px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {
      console.error(e);
    }
  }

  static writeHtml(str: string) {
    // Use the modern Clipboard API to write the HTML as a raw Blob.
    // The legacy execCommand("copy") approach serializes computed DOM styles
    // (Tailwind --tw-* vars, box-sizing, scrollbar-*, etc.) onto every element.
    if (typeof navigator?.clipboard?.write === "function") {
      const htmlStr = str;
      const htmlBlob = new Blob([htmlStr], { type: "text/html" });
      const isTableContent = /<table[\s>]/i.test(str);
      const plainText = formatPlainTextForClipboard(
        htmlToPlainText(str),
        isTableContent
      );
      const textBlob = new Blob([plainText], { type: "text/plain" });
      navigator.clipboard
        .write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ])
        .catch((e) => console.error(e));
      return;
    }

    // Fallback for browsers without Clipboard API support
    try {
      let ele = document.getElementById("fortune-copy-content");
      if (!ele) {
        ele = document.createElement("div");
        ele.setAttribute("contentEditable", "true");
        ele.id = "fortune-copy-content";
        ele.style.position = "fixed";
        ele.style.height = "0";
        ele.style.width = "0";
        ele.style.left = "-10000px";
        document.querySelector(".fortune-container")?.append(ele);
      }
      const previouslyFocusedElement = document.activeElement as HTMLElement;
      ele.style.display = "block";
      ele.innerHTML = str;
      ele.focus({ preventScroll: true });
      document.execCommand("selectAll");
      document.execCommand("copy");
      setTimeout(() => {
        ele?.blur();
        previouslyFocusedElement?.focus?.();
      }, 10);
    } catch (e) {
      console.error(e);
    }
  }
}
