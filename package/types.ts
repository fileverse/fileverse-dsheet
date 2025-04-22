import { Sheet } from '@fortune-sheet/core';

export interface DsheetProp {
  renderNavbar?: () => JSX.Element;
  initialSheetData?: Sheet[];
  enableIndexeddbSync?: boolean;
  dsheetId?: string;
  onChange?: (
    updatedSheetContent: string,
    updateChunk: string,
  ) => void;
  username?: string;
  enableWebrtc?: boolean;
  portalContent?: any;
  isReadOnly?: boolean;
  isCollaborative?: boolean;
}

export interface sheetEditorRef { }
