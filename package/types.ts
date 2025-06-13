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

// Define the onboarding handler type
export type OnboardingHandlerType = (params: {
  row: number;
  column: number;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
}) => { row: number; column: number };

export interface DsheetProps {
  setShowFetchURLModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setFetchingURLData?: (fetching: boolean) => void;
  setInputFetchURLDataBlock?: React.Dispatch<React.SetStateAction<string>>;
  renderNavbar?: (editorValues?: EditorValues) => JSX.Element;
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
  onboardingHandler?: OnboardingHandlerType;
  setForceSheetRender?: React.Dispatch<React.SetStateAction<number>>;
  getCommentCellUI?: (row: number, column: number) => void;
  // eslint-disable-next-line @typescript-eslint/ban-types
  commentData?: Object;
  toggleTemplateSidebar?: () => void;
  sheetEditorRef?: RefObject<WorkbookInstance>;
  storeApiKey?: (apiKeyName: string) => void;
  allowComments?: boolean;
}
