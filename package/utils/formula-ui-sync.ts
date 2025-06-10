import { WorkbookInstance } from '@fileverse-dev/fortune-react';

export type FormulaSyncType = {
  row: number;
  column: number;
  newValue: Record<string, string>;
  apiData: Array<Record<string, object>> | Array<Array<string>>;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
};
export const formulaResponseUiSync = ({
  row,
  column,
  newValue,
  apiData,
  sheetEditorRef,
}: FormulaSyncType): void => {
  const headers: string[] = Array.isArray(apiData[0]) ? apiData[0] : Object.keys(
    apiData[0],
  )
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

  let range;
  const data = [];
  // set header and handle data if data is array of object
  if (!Array.isArray(apiData[0])) {
    range = {
      row: [row, row + apiData.length],
      column: [column, column + (headers.length - 1)],
    }

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
      headers.forEach((header: string) => {
        // @ts-expect-error later
        const cellValue = apiData[i][header];
        tempData.push({
          ct: { fa: '@', t: 's' },
          v: cellValue,
        });
      });
      data.push(tempData);
    }
  } else if (Array.isArray(apiData[0])) {
    // set header and handle data if data is array of array
    range = {
      row: [row, row + apiData.length - 1],
      column: [column, column + (apiData[0].length - 1)],
    }
    const headerData: Array<Record<string, string> | string> = apiData[0];
    headerData[0] = { ...newValue, m: headerData[0] as string, v: headerData[0] as string };

    data.push(headerData);
    for (let i = 1; i < apiData.length; i++) {
      const tempData: { ct: { fa: string; t: string }; m?: object; v: string }[] =
        [];
      // @ts-expect-error later
      apiData[i].forEach((cellValue: string) => {
        tempData.push({
          ct: { fa: '@', t: 's' },
          v: cellValue,
        });
      });

      data.push(tempData);
    }
  }
  if (range) {
    sheetEditorRef.current?.setCellValuesByRange(data, range);
  }
};