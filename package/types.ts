import { Sheet } from '@fileverse-dev/fortune-core';
import { RefObject } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

export interface SheetUpdateData {
  data: Sheet[];
  title?: string;
}

export interface DsheetProps {
  renderNavbar?: (props?: {
    title: string;
    onTitleChange: (title: string) => void;
  }) => JSX.Element;
  initialSheetData?: Sheet[];
  enableIndexeddbSync?: boolean;
  dsheetId: string;
  onChange?: (updateData: SheetUpdateData, encodedUpdate?: string) => void;
  username?: string;
  enableWebrtc?: boolean;
  portalContent?: string;
  isReadOnly?: boolean;
  isTemplateOpen?: boolean;
  isCollaborative?: boolean;
  selectedTemplate?: string;
  setForceSheetRender?: React.Dispatch<React.SetStateAction<number>>;
  toggleTemplateSidebar?: () => void;
  initialTitle?: string;
  onTitleChange?: (title: string) => void;
  sheetEditorRef?: RefObject<WorkbookInstance>;
}
