// components/CommentInput.tsx
import React, { useRef, useState } from 'react';
import { Button, TextAreaFieldV2 } from '@fileverse/ui';
import { CommentInputProps } from '../../types/comments';

export const CommentInput: React.FC<CommentInputProps> = ({
  id,
  placeholder = 'Reply',
  onSend,
  autoFocus = false,
  className = '',
  cancelComment,
  onBlur,
  isStaticButton,
  removeCancelButton,
  focusTrap = false,
  disabled = false,
}) => {
  const handleSend = () => {
    onSend(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') {
      e.stopPropagation();
    }
    if (e.code === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSend();
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  const [shouldShowButtons, setShouldShowButtons] = useState(false);
  const preventCloseButtonRef = useRef(false);

  const isOwnButton = (el: EventTarget | null): boolean => {
    return el === cancelButtonRef.current || el === sendButtonRef.current;
  };

  const hideButtons = (e?: React.FocusEvent<HTMLTextAreaElement>) => {
    if (focusTrap && e && isOwnButton(e.relatedTarget)) return;

    if (preventCloseButtonRef.current) {
      preventCloseButtonRef.current = false;
      return;
    }
    const inputElement = document.getElementById(id) as HTMLTextAreaElement;
    const inputValue = inputElement?.value?.trim();
    if (inputValue) return;
    setShouldShowButtons(false);
    onBlur && onBlur();
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (!focusTrap || e.key !== 'Tab') return;
    const buttonsVisible = shouldShowButtons || isStaticButton;
    if (!buttonsVisible) return;

    const focusables: HTMLElement[] = [textareaRef.current].filter(
      Boolean
    ) as HTMLElement[];
    if (!removeCancelButton && cancelButtonRef.current) {
      focusables.push(cancelButtonRef.current);
    }
    if (sendButtonRef.current) {
      focusables.push(sendButtonRef.current);
    }
    if (focusables.length < 2) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleButtonBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
    if (!focusTrap) return;
    if (isOwnButton(e.relatedTarget) || e.relatedTarget === textareaRef.current)
      return;
    const inputElement = document.getElementById(id) as HTMLTextAreaElement;
    const inputValue = inputElement?.value?.trim();
    if (inputValue) return;
    setShouldShowButtons(false);
    onBlur && onBlur();
  };

  return (
    <div
      className={`gap-xsm flex flex-col ${className}`}
      onKeyDown={handleContainerKeyDown}
    >
      <TextAreaFieldV2
        ref={textareaRef}
        id={id}
        placeholder={placeholder}
        autoFocus={autoFocus && !disabled}
        disabled={disabled}
        onFocus={() => {
          if (!disabled) setShouldShowButtons(true);
        }}
        onBlur={hideButtons}
        onKeyDown={handleKeyDown}
        className="bg-white max-h-[76px] !h-[76px]"
      />
      {!disabled && (shouldShowButtons || isStaticButton) && (
        <div className="flex items-center gap-2 justify-end">
          {!removeCancelButton && (
            <Button
              ref={cancelButtonRef}
              variant={'secondary'}
              onClick={cancelComment}
              className="px-4 py-2 w-20 min-w-20 h-9 font-medium text-sm"
              onMouseEnter={() => (preventCloseButtonRef.current = true)}
              onMouseLeave={() => (preventCloseButtonRef.current = false)}
              onBlur={handleButtonBlur}
            >
              Cancel
            </Button>
          )}

          <Button
            ref={sendButtonRef}
            onClick={handleSend}
            className="px-4 py-2 w-20 min-w-20 h-9 font-medium text-sm"
            onBlur={handleButtonBlur}
          >
            Send
          </Button>
        </div>
      )}
    </div>
  );
};
