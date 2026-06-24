/**
 * Google Sheets–style keyboard matchers.
 * - Letters / digits / F-keys: physical `code`
 * - Punctuation (docs show characters): `code` + `key` + modifiers
 */

export function hasMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

function isImeOrDeadKey(e: KeyboardEvent): boolean {
  if (e.key === 'Process' || e.key === 'Dead' || e.key === 'Unidentified') {
    return true;
  }
  return e.keyCode === 229;
}

/** Physical US-reference codes commonly used to type `;` across layouts. */
const SEMICOLON_TYPING_CODES = new Set(['Semicolon', 'Comma', 'Period']);

/** Physical codes for `"` — US Quote; AZERTY Shift+2/3/4 (Digit3 on French AZERTY). */
const QUOTE_TYPING_CODES = new Set([
  'Quote',
  'Digit2',
  'Digit3',
  'Digit4',
  'Numpad2',
  'Numpad3',
]);

function isQuoteTypingCode(code: string): boolean {
  return QUOTE_TYPING_CODES.has(code);
}

/**
 * True when the event produces (or targets) the semicolon character `;`.
 * AZERTY Mac bottom-row ; key → code Period, key ";".
 */
function producesSemicolon(e: KeyboardEvent): boolean {
  return e.key === ';';
}

/** US Shift+; produces ":" — Google "insert time" on QWERTY. */
function producesColon(e: KeyboardEvent): boolean {
  return e.key === ':';
}

function isSemicolonTypingCode(code: string): boolean {
  return SEMICOLON_TYPING_CODES.has(code);
}

/**
 * On AZERTY the US-semicolon slot types "m"; Cmd+Option there is for host shortcuts.
 */
function isAzertyCmdOptionPhysicalSemicolonKey(e: KeyboardEvent): boolean {
  return e.altKey && !e.shiftKey && e.code === 'Semicolon';
}

/** Google Mac: Ctrl+; — insert date on non-US keyboards. */
function isMacCtrlInsertDateShortcut(e: KeyboardEvent): boolean {
  return (
    e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey &&
    !e.altKey &&
    (e.key === ';' ||
      e.code === 'Semicolon' ||
      e.code === 'Comma' ||
      e.code === 'Period')
  );
}

/**
 * Insert date — Cmd/Ctrl+; (Google Sheets).
 * Match on typed `;` character (AZERTY often uses Shift+, → code Comma).
 * US QWERTY: physical Semicolon key without shift.
 */
export function isInsertDateShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;
  if (isAzertyCmdOptionPhysicalSemicolonKey(e)) return false;
  if (isMacCtrlInsertDateShortcut(e)) return true;

  // Cmd+; as semicolon character — includes AZERTY comma key (no shift).
  // Shift+; on AZERTY also yields ";" but is insert-time, not date.
  if (producesSemicolon(e) && !e.shiftKey) return true;

  if (!e.shiftKey && e.code === 'Semicolon') return true;

  return false;
}

/**
 * Insert time — Cmd/Ctrl+Shift+; (Google Sheets).
 * US QWERTY: Shift+; → key ":" code Semicolon.
 * AZERTY (runtime): Cmd+Shift+; → code Comma with key "." or ","; Cmd+Shift+. → code Period with key "/" or ".".
 */
export function isInsertTimeShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || !e.shiftKey || e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;

  if (producesColon(e)) return true;
  if (producesSemicolon(e)) return true;
  // AZERTY punctuation slots for ; / : — `key` varies with Cmd held (., ,, /, etc.)
  if (e.code === 'Comma' || e.code === 'Period') return true;
  return e.code === 'Semicolon' && producesColon(e);
}

/** Google Mac: ⌘+Option+Shift+; — insert date and time (AZERTY-safe). */
export function isInsertDateTimeShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || !e.shiftKey || !e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;

  if (producesColon(e) || producesSemicolon(e) || e.key === '"') return true;
  // AZERTY ⌘+Option+Shift+; or ⌘+Option+Shift+3 — `key` varies with Cmd held
  if (e.code === 'Comma' || e.code === 'Period') return true;
  return isSemicolonTypingCode(e.code) || isQuoteTypingCode(e.code);
}

/**
 * US / EU: Cmd/Ctrl+Shift+" — insert date and time.
 * Mac AZERTY: `"` is Shift+3, but ⌘+Shift+3 is macOS screenshot (never reaches the page).
 * Use ⌘+Option+Shift+3/; or Ctrl+Shift+3 instead (Google Mac alternates).
 */
export function isUsInsertDateTimeQuoteShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || !e.shiftKey || e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;

  if (e.key === '"') return true;
  if (!isQuoteTypingCode(e.code)) return false;

  // ⌘+Shift+3 is macOS full-screen screenshot — browser never receives Digit3.
  if (
    e.metaKey &&
    !e.ctrlKey &&
    (e.code === 'Digit3' || e.code === 'Numpad3')
  ) {
    return false;
  }

  return true;
}

export function isPlainTextFormatShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || !e.shiftKey || e.altKey) return false;

  if (e.code === 'Backquote') return true;
  if (e.key === '@' || e.key === '²' || e.key === '`') return true;

  // Google Mac alternate: Ctrl+Shift+` (plain text)
  if (e.ctrlKey && !e.metaKey && e.code === 'Backquote') return true;

  return false;
}

/**
 * Strikethrough — Google Sheets:
 * Mac: Cmd+Shift+X, Ctrl+Option+Shift+5
 * Win: Alt+Shift+5, Ctrl+Shift+X
 */
export function isStrikethroughShortcut(e: KeyboardEvent): boolean {
  if (isImeOrDeadKey(e)) return false;

  if (e.shiftKey && !e.altKey && e.code === 'KeyX' && (e.metaKey || e.ctrlKey)) {
    return true;
  }

  const isDigit5 = e.code === 'Digit5' || e.code === 'Numpad5';
  if (!e.shiftKey || !isDigit5) return false;

  if (e.altKey && !e.ctrlKey && !e.metaKey) return true;
  if ((e.ctrlKey || e.metaKey) && e.altKey) return true;

  return false;
}

/** Google / dSheets: Cmd+Option+M (Mac), Ctrl+Alt+M (Win). AZERTY M-key slot. */
export function isInsertCommentShortcut(e: KeyboardEvent): boolean {
  if (e.getModifierState?.('AltGraph')) return false;
  if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.shiftKey) return false;
  return e.code === 'KeyM' || e.code === 'Semicolon';
}

/** Google Sheets: Cmd/Ctrl+A — select all. AZERTY types "a" on physical KeyQ. */
export function isSelectAllShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || e.shiftKey || e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;
  return e.key.toLowerCase() === 'a' || e.code === 'KeyA';
}

/**
 * Number formats — Google Mac: Ctrl+Shift+1–6; also Cmd/Ctrl+Shift+1–6.
 */
export function isNumberFormatModifier(e: KeyboardEvent): boolean {
  if (e.altKey || !e.shiftKey) return false;
  if (e.ctrlKey && !e.metaKey) return true;
  return e.metaKey || e.ctrlKey;
}

export function isDigitFormatKey(e: KeyboardEvent, digit: string): boolean {
  return e.code === `Digit${digit}` || e.code === `Numpad${digit}`;
}

/** Physical codes commonly used to type `)` (formula list). */
const CLOSE_PAREN_TYPING_CODES = new Set([
  'BracketRight',
  'Digit0',
  'Digit5',
  'Numpad0',
]);

/**
 * Formula list — Ctrl/Cmd+) (Google Sheets).
 * US: Shift+0 → ")"; AZERTY: Shift+5 → ")" (code Digit5, often Equal-adjacent noise).
 */
export function isFormulaListShortcut(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;

  if (e.key === ')') return true;

  if (!e.shiftKey) {
    return (
      e.code === 'BracketRight' ||
      e.code === 'Digit0' ||
      e.code === 'Numpad0'
    );
  }

  return CLOSE_PAREN_TYPING_CODES.has(e.code);
}

export function isFindShortcut(e: KeyboardEvent): boolean {
  return (
    hasMod(e) &&
    !e.shiftKey &&
    !e.altKey &&
    e.code === 'KeyF'
  );
}

export function isFindReplaceShortcut(e: KeyboardEvent): boolean {
  if (isImeOrDeadKey(e)) return false;
  return (
    (e.ctrlKey && !e.metaKey && e.code === 'KeyH' && !e.shiftKey) ||
    (e.metaKey && e.shiftKey && e.code === 'KeyH' && !e.ctrlKey)
  );
}

export function isZoomInShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;
  if (isFormulaListShortcut(e)) return false;

  if (e.key === '+' || e.code === 'NumpadAdd') return true;
  if (e.code === 'Equal' && (e.key === '+' || e.key === '=')) return true;
  return false;
}

export function isZoomOutShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;

  if (e.key === '-' || e.key === '_') return true;
  if (e.code === 'NumpadSubtract') return true;
  if (e.code === 'Minus' && e.key === '-') return true;
  // AZERTY French: `-` on Digit6 (US zoom `-` uses Minus key).
  if (e.code === 'Digit6' && e.key === '-') return true;
  return false;
}

/** AZERTY Mac: `/` is Shift+7 (Digit7). Do not use Digit5 — that is Shift+5 → `)` (formula list). */
const SLASH_SHIFT_TYPING_CODES = new Set([
  'Slash',
  'NumpadDivide',
  'Digit7',
  'Numpad7',
]);

/**
 * Open shortcuts modal — Ctrl/Cmd+/ (Google Sheets).
 * AZERTY Mac: `/` is Shift+7; must not overlap zoom (+/=) or formula list `)`.
 */
export function isOpenShortcutsModalShortcut(e: KeyboardEvent): boolean {
  if (!hasMod(e) || e.altKey) return false;
  if (isImeOrDeadKey(e)) return false;
  if (isZoomInShortcut(e) || isZoomOutShortcut(e)) return false;

  if (e.key === '/') return true;

  if (!e.shiftKey) {
    return e.code === 'Slash' || e.code === 'NumpadDivide';
  }

  return SLASH_SHIFT_TYPING_CODES.has(e.code);
}
