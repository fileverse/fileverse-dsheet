import { WorkbookInstance } from '@fileverse-dev/fortune-react';

export type FormulaSyncType = {
  row: number;
  column: number;
  newValue: Record<string, string>;
  apiData: Array<Record<string, object>>;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
};
export const formulaResponseUiSync = ({
  row,
  column,
  newValue,
  apiData,
  sheetEditorRef,
}: FormulaSyncType): void => {
  const headers: string[] = Object.keys(apiData[0]);
  // handle row and col ofbound and add new row and col
  const sheet = sheetEditorRef.current?.getSheet();
  const currentTotalRow = sheet?.data?.length || 0;
  const currentTotalColumn = sheet?.data?.[0]?.length || 0;
  const extraRow = apiData.length - (currentTotalRow - row) + 1;
  const extraCol = headers.length - (currentTotalColumn - column) + 1;

  if (extraRow > 0) {
    sheetEditorRef.current?.insertRowOrColumn(
      'row',
      currentTotalRow - 1,
      extraRow,
    );
  }
  if (extraCol > 0) {
    sheetEditorRef.current?.insertRowOrColumn(
      'column',
      currentTotalColumn - 1,
      extraCol,
    );
  }

  const range = {
    row: [row, row + apiData.length],
    column: [column, column + (headers.length - 1)],
  };

  const data = [];

  // set header
  const headerData: Array<Record<string, string> | string> = [];
  headers.forEach((header, index) => {
    if (index === 0) {
      headerData.push({ ...newValue, m: header, v: header });
    } else {
      headerData.push(header);
    }
  });
  data.push(headerData);

  // set data
  for (let i = 0; i < apiData.length; i++) {
    const tempData: { ct: { fa: string; t: string }; m?: object; v: object }[] =
      [];
    headers.forEach((header) => {
      const cellValue = apiData[i][header];
      tempData.push({
        ct: { fa: '@', t: 's' },
        v: cellValue,
      });
    });
    data.push(tempData);
  }
  sheetEditorRef.current?.setCellValuesByRange(data, range);
};