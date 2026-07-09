import { useState, useCallback, useRef, MutableRefObject } from 'react';
import { useOnClickOutside } from 'usehooks-ts';

interface UseFetchUrlModalProps {
  onClose?: () => void;
  setInputAddress?: React.Dispatch<React.SetStateAction<string>>;
  shouldPreventClose?: MutableRefObject<boolean>;
}

export const useModalOutsideClick = ({
  onClose,
  setInputAddress,
  shouldPreventClose,
}: UseFetchUrlModalProps = {}) => {
  const [rowCount, setRowCount] = useState<number>(100);
  const [includeHeaders, setIncludeHeaders] = useState<boolean>(true);
  const [abortCall, setAbortCall] = useState<boolean>(false);

  const modalDivRef = useRef<HTMLDivElement>(null);

  const resetModalState = useCallback(() => {
    setInputAddress?.('');
    setRowCount(100);
    setIncludeHeaders(true);
    setAbortCall(false);
  }, []);

  const handleClose = useCallback(() => {
    resetModalState();
    onClose?.();
  }, [resetModalState, onClose]);

  useOnClickOutside(modalDivRef, (e) => {
    const target = e.target as HTMLElement;

    // Skip if clicked inside radix select content
    if (
      target.closest('[data-radix-popper-content-wrapper]') ||
      shouldPreventClose?.current
    ) {
      return;
    }
    handleClose();
  });

  return {
    rowCount,
    setRowCount,
    includeHeaders,
    setIncludeHeaders,
    abortCall,
    modalDivRef,
    resetModalState,
    handleClose,
  };
};
