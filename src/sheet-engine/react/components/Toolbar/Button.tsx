import React from 'react';
import { LucideIcon, Tooltip } from '@fileverse/ui';
import { getLucideIcon } from '.';

type Props = {
  tooltip: string;
  iconId: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  disabled?: boolean;
  selected?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  id?: string;
};

const Button: React.FC<Props> = ({
  tooltip,
  onClick,
  onMouseDown,
  iconId,
  disabled,
  selected,
  children,
  style,
  id,
}) => {
  const iconIdClass = iconId.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
  return (
    <Tooltip text={tooltip} position="bottom">
      <div
        id={id}
        className={`fortune-toolbar-button fortune-toolbar-item fortune-toolbar-button__cta fortune-toolbar-button--${iconIdClass}`}
        data-icon-id={iconId}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
        }}
        onMouseDown={onMouseDown}
        tabIndex={0}
        role="button"
        style={
          selected
            ? { backgroundColor: '#FFDF0A' }
            : disabled
              ? { ...style, pointerEvents: 'none', opacity: 0.45 }
              : style
        }
        data-testid={`toolbar-cta-${id ?? iconId}`}
      >
        <span
          className={`fortune-toolbar-button__icon fortune-toolbar-button__icon--${iconIdClass}`}
          data-icon-id={iconId}
          data-testid={`toolbar-icon-${iconId}`}
        >
          <LucideIcon
            name={getLucideIcon(iconId)}
            width={16}
            height={16}
            style={disabled ? { opacity: 0.3 } : {}}
          />
        </span>
        {children}
      </div>
    </Tooltip>
  );
};

export default Button;
