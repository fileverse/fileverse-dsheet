const INVALID_FILENAME_CHARS_REGEX = /[<>:"/\\|?*\u0000-\u001F]/g;
const TRAILING_DOTS_SPACES_REGEX = /[.\s]+$/g;

const MAX_FILENAME_BASE_LENGTH = 120;

export const sanitizeFilenameBase = (value: string): string => {
  const trimmed = (value ?? "").trim();
  const withoutInvalid = trimmed.replace(INVALID_FILENAME_CHARS_REGEX, "-");
  const collapsedWhitespace = withoutInvalid.replace(/\s+/g, " ");
  const withoutTrailing = collapsedWhitespace.replace(TRAILING_DOTS_SPACES_REGEX, "");

  return withoutTrailing.slice(0, MAX_FILENAME_BASE_LENGTH).trim();
};

export const getExportFilenameBase = ({
  getDocumentTitle,
  documentTitleFallback,
  sheetNameFallback,
  defaultBase = "Sheet",
}: {
  getDocumentTitle?: () => string;
  documentTitleFallback?: string;
  sheetNameFallback?: string;
  defaultBase?: string;
}): string => {
  const candidates = [
    getDocumentTitle?.(),
    documentTitleFallback?.split('-')[0]?.trim(),
    sheetNameFallback,
    defaultBase,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const sanitized = sanitizeFilenameBase(candidate);
    if (sanitized) return sanitized;
  }

  return defaultBase;
};

