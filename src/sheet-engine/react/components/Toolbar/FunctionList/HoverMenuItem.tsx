import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cn from 'classnames';

type OpenChangeHandler = (open: boolean) => void;

type CommonProps = {
  className?: string;
  label: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
};

type SubmenuProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: OpenChangeHandler;
  onTriggerMouseEnter?: () => void;
  renderSubmenu: () => React.ReactNode;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  contentAlign?: 'start' | 'center' | 'end';
  contentSideOffset?: number;
  contentAlignOffset?: number;
  closeDelayMs?: number;
};

export type HoverMenuItemProps = CommonProps &
  (
    | {
        renderSubmenu?: undefined;
      }
    | SubmenuProps
  );

function isSubmenuItem(
  props: HoverMenuItemProps,
): props is CommonProps & SubmenuProps {
  return typeof (props as SubmenuProps).renderSubmenu === 'function';
}

export function HoverMenuItem(props: HoverMenuItemProps) {
  const submenu = isSubmenuItem(props);
  const submenuProps = submenu ? (props as CommonProps & SubmenuProps) : null;

  const closeDelayMs = submenu ? (props.closeDelayMs ?? 80) : 0;

  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(
    submenu ? (props.defaultOpen ?? false) : false,
  );

  const open = submenu ? (props.open ?? uncontrolledOpen) : false;

  const setOpen = useCallback<OpenChangeHandler>(
    (next) => {
      if (!submenu || !submenuProps) return;
      if (submenuProps.open === undefined) {
        setUncontrolledOpen(next);
      }
      submenuProps.onOpenChange?.(next);
    },
    [submenu, submenuProps],
  );

  const closeTimerRef = useRef<number | null>(null);
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current == null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    if (!submenu) return;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, closeDelayMs);
  }, [submenu, clearCloseTimer, closeDelayMs, setOpen]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const handleTriggerMouseEnter = useCallback(() => {
    if (!submenu || !submenuProps) return;
    clearCloseTimer();
    submenuProps.onTriggerMouseEnter?.();
    if (!submenuProps.disabled) setOpen(true);
  }, [submenu, submenuProps, clearCloseTimer, setOpen]);

  const handleTriggerMouseLeave = useCallback(() => {
    if (!submenu) return;
    scheduleClose();
  }, [submenu, scheduleClose]);

  const handleContentMouseEnter = useCallback(() => {
    if (!submenu) return;
    clearCloseTimer();
    if (!props.disabled) setOpen(true);
  }, [submenu, clearCloseTimer, props.disabled, setOpen]);

  const handleContentMouseLeave = useCallback(() => {
    if (!submenu) return;
    scheduleClose();
  }, [submenu, scheduleClose]);

  const buttonClassName = useMemo(() => {
    return cn(
      'hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-between space-x-2 transition',
      props.disabled ? 'opacity-50 cursor-not-allowed' : undefined,
      props.className,
    );
  }, [submenu, props.className, props.disabled]);

  const inner = (
    <button
      type="button"
      className={buttonClassName}
      disabled={props.disabled}
      onClick={() => {
        if (props.disabled) return;
        props.onClick?.();
      }}
      onMouseEnter={submenu ? handleTriggerMouseEnter : undefined}
      onMouseLeave={submenu ? handleTriggerMouseLeave : undefined}
    >
      <div className="flex gap-2 items-center min-w-0">
        {props.leftSlot}
        <span className="text-body-sm truncate">{props.label}</span>
      </div>
      {props.rightSlot}
    </button>
  );

  if (!submenu) return inner;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{inner}</PopoverTrigger>
      <PopoverContent
        data-hovermenu-submenu="true"
        align={props.contentAlign ?? 'start'}
        alignOffset={props.contentAlignOffset ?? 0}
        side="right"
        sideOffset={props.contentSideOffset ?? 4}
        onMouseEnter={handleContentMouseEnter}
        onMouseLeave={handleContentMouseLeave}
        className={cn(
          'p-2 border-[1px] border-solid border-[var(--color-border-default,#E8EBEC)]',
          props.contentClassName,
        )}
        style={props.contentStyle}
        elevation={2}
      >
        <div className="color-text-default">{props.renderSubmenu()}</div>
      </PopoverContent>
    </Popover>
  );
}
