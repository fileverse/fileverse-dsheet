import { IconButton } from '@fileverse/ui';
import { ReactNode } from 'react';
import { RightSidebar, RightSidebarHeader } from './right-sidebar';

export interface ActivePanelConfig {
  id: string;
  width: string;
  header: { title: string; subtitle?: string };
  content: ReactNode;
}

interface EditorRightSidebarProps {
  isOpen: boolean;
  activePanelConfig: ActivePanelConfig | null;
  onClose: () => void;
}

export const EditorRightSidebar = ({
  isOpen,
  activePanelConfig,
  onClose,
}: EditorRightSidebarProps) => {
  return (
    <RightSidebar width={activePanelConfig?.width} isOpen={isOpen}>
      <RightSidebarHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-heading-sm leading-[22px]">
            {activePanelConfig?.header.title}
          </h2>
          <IconButton
            variant="ghost"
            icon="X"
            size="sm"
            onClick={onClose}
            aria-label={`Close ${activePanelConfig?.header.title ?? ''} panel`}
          />
        </div>
      </RightSidebarHeader>
      {activePanelConfig?.content}
    </RightSidebar>
  );
};
