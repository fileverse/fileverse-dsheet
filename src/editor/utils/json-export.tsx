import { WorkbookInstance } from '@sheet-engine/react';
import * as Y from 'yjs';
import { Sheet } from '@sheet-engine/react';
import { toast } from '@fileverse/ui';

export const handleExportToJSON = (
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>,
  ydocRef: React.RefObject<Y.Doc | null>,
  _dsheetId: string,
) => {
  if (!sheetEditorRef.current || !ydocRef.current) return;

  try {
    const sheetArray = sheetEditorRef.current.getAllSheets();
    const allSheetsData = sheetArray ? (Array.from(sheetArray) as Sheet[]) : [];
    const allSheets = [...allSheetsData].map((sheet) => {
      const newSheet = { ...sheet };
      newSheet.celldata = sheetEditorRef?.current?.dataToCelldata(sheet?.data);
      delete newSheet.data;
      return newSheet;
    });
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
    toast({
      title: 'Export failed',
      description:
        error instanceof Error && error.message
          ? error.message
          : 'Something went wrong while exporting to .json. Please try again.',
      variant: 'error',
      showCloseButton: true,
      duration: 10 * 1000,
    });
  }
};
