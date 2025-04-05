import { Sheet } from '@fortune-sheet/core';

export interface DsheetProp {
  renderNavbar: () => JSX.Element;
  initialSheetData?: Sheet[];
  enableIndexeddbSync?: boolean;
  dsheetId?: string;
}

export interface sheetEditorRef { }
