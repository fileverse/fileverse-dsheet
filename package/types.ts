import { Sheet } from '@fileverse-dev/fortune-core';

export interface DsheetProps {
  renderNavbar?: () => JSX.Element;
  initialSheetData?: Sheet[];
  enableIndexeddbSync?: boolean;
  dsheetId: string;
  onChange?: (updatedSheetContent: string, updateChunk: string) => void;
  username?: string;
  enableWebrtc?: boolean;
  portalContent?: string;
  isReadOnly?: boolean;
  isTemplateOpen?: boolean;
  isCollaborative?: boolean;
  selectedTemplate?: string;
  setForceSheetRender?: React.Dispatch<React.SetStateAction<number>>;
  toggleTemplateSidebar?: () => void;
}
