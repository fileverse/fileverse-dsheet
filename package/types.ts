import { Sheet } from '@fileverse-dev/fortune-core';
import { RefObject } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';

export interface SheetUpdateData {
  data: Sheet[];
}

export interface EditorValues {
  sheetEditorRef: RefObject<WorkbookInstance>;
  currentDataRef: React.MutableRefObject<Sheet[] | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
}

export interface DsheetProps {
  renderNavbar?: (editorValues?: EditorValues) => JSX.Element;
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
  onboardingComplete?: boolean;
  onboardingHandler?: Function;
  setForceSheetRender?: React.Dispatch<React.SetStateAction<number>>;
  toggleTemplateSidebar?: () => void;
  sheetEditorRef?: RefObject<WorkbookInstance>;
}
