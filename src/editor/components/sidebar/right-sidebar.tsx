import { type ReactNode } from 'react';
import { cn } from '@fileverse/ui';

export function RightSidebar({
  width = '380px',
  className,
  children,
  isOpen = false,
  top = '44px',
  height = 'calc(100vh - 44px)',
}: Readonly<{
  width?: string;
  className?: string;
  children: ReactNode;
  isOpen?: boolean;
  top?: string;
  height?: string;
}>) {
  return (
    <aside
      className={cn(
        'fixed right-0 z-30 bg-[#F8F9FA] border-l transition-all duration-300 ease-in-out overflow-hidden dark:bg-[#1E1E1E] !select-text',
        className,
      )}
      data-state={isOpen ? 'open' : 'closed'}
      aria-hidden={!isOpen}
      style={{
        top,
        height,
        width,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px', height: '100%', boxSizing: 'border-box' }}>
        <div
          style={{
            border: '1px solid #E8EBEC',
            borderRadius: '12px',
            backgroundColor: '#fff',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </aside>
  );
}

export function RightSidebarHeader({
  className,
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <header
      className={cn(
        'relative z-50 px-4 py-2 border-b border-gray-200 shrink-0',
        className,
      )}
    >
      {children}
    </header>
  );
}
