import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Subscribes to `selectionchange` while editing a formula so components that
 * derive UI from caret position (e.g. nested function hints) re-render when
 * the user only moves the caret without changing React state.
 *
 * `onAfterCaretMove` runs after the bump (e.g. refresh `formulaRangeHighlight`
 * — `input` does not fire on caret-only clicks).
 */
export function useRerenderOnFormulaCaret(
  editorRef: RefObject<HTMLDivElement | null>,
  editSessionActive: boolean,
  onAfterCaretMove?: () => void,
): void {
  const [, bump] = useState(0);
  const onAfterCaretMoveRef = useRef(onAfterCaretMove);
  onAfterCaretMoveRef.current = onAfterCaretMove;

  useEffect(() => {
    if (!editSessionActive) {
      return () => {};
    }

    const onSelectionChange = () => {
      const el = editorRef.current;
      if (!el) return;
      const text = el.innerText?.trim() ?? '';
      if (!text.startsWith('=')) return;

      const sel = window.getSelection();
      if (!sel?.rangeCount || !el.contains(sel.getRangeAt(0).startContainer)) {
        return;
      }

      bump((n) => n + 1);
      onAfterCaretMoveRef.current?.();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [editSessionActive, editorRef]);
}
