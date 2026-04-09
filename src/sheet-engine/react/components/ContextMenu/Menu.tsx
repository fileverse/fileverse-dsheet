import { cn } from '@fileverse/ui';
import React, { useRef } from 'react';

type Props = React.PropsWithChildren<{
  onClick?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    container: HTMLDivElement,
  ) => void;
  onMouseLeave?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    container: HTMLDivElement,
  ) => void;
  onMouseEnter?: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    container: HTMLDivElement,
  ) => void;
  isActive?: boolean;
}>;

const Menu: React.FC<Props> = ({
  onClick,
  onMouseLeave,
  onMouseEnter,
  children,
  isActive = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={containerRef}
      className={cn(
        'luckysheet-cols-menuitem luckysheet-mousedown-cancel',
        isActive && 'color-bg-default-hover',
      )}
      onClick={(e) => onClick?.(e, containerRef.current!)}
      onMouseLeave={(e) => onMouseLeave?.(e, containerRef.current!)}
      onMouseEnter={(e) => onMouseEnter?.(e, containerRef.current!)}
      tabIndex={0}
    >
      <div className="luckysheet-cols-menuitem-content luckysheet-mousedown-cancel">
        {children}
      </div>
    </div>
  );
};

export default Menu;
