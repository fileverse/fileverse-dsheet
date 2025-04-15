import { Sheet } from '@fortune-sheet/core';

export interface DsheetProp {
  renderNavbar: () => JSX.Element;
  initialSheetData?: Sheet[];
  enableIndexeddbSync?: boolean;
  dsheetId?: string;
  onChange?: (
    updatedDocContent: string,
    updateChunk: string,
  ) => void;
  username?: string;
  enableWebrtc?: boolean;
  portalContent?: any;
  portalContentYjs?: any;
}

export interface sheetEditorRef { }
