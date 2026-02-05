import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';

export const handleExportToJSON = (
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>,
  ydocRef: React.RefObject<Y.Doc | null>,
  dsheetId: string,
) => {
  if (!sheetEditorRef.current || !ydocRef.current) return;

  try {
    const sheetArray = sheetEditorRef.current.getAllSheets();
    console.log('sheetArray export json', dsheetId);
    //ydocRef.current?.getArray(dsheetId);
    const allSheetsData = sheetArray ? (Array.from(sheetArray) as Sheet[]) : [];
    console.log('allSheets', allSheetsData);
    const allSheets = [...allSheetsData].map((sheet) => {
      const newSheet = { ...sheet };
      newSheet.celldata = sheetEditorRef?.current?.dataToCelldata(sheet?.data);
      console.log('sheet', sheet);
      delete newSheet.data;
      return newSheet;
    })
    console.log('allSheets', allSheets);
    const blob = new Blob([JSON.stringify(allSheets, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spreadsheet.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to JSON:', error);
  }
};
