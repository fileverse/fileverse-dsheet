import { Sheet } from '@fileverse-dev/fortune-core';
import { useCallback } from 'react';
import { Workbook } from 'exceljs';
// @ts-expect-error, type is not available from package
import { transformExcelToLucky } from 'luckyexcel';

/**
 * A simplified adapter for XLSX import functionality
 */
export const useXLSXImportAdapter = ({
  onDataImported,
}: {
  onDataImported: (data: Sheet[]) => void;
}) => {
  const handleXLSXUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';

    input.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      if (!target.files?.length) {
        return;
      }
      const file = target.files[0];
      let dropdownInfo: Record<
        string,
        {
          type?: string;
          formulae?: { replace: (a: RegExp, b: string) => string }[];
        }
      > | null = null;

      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target) {
          console.error('FileReader event target is null');
          return;
        }
        const arrayBuffer = e.target.result;
        const workbook = new Workbook();
        try {
          //@ts-expect-error, later
          await workbook.xlsx.load(arrayBuffer);
          const worksheet = workbook.getWorksheet(1);
          dropdownInfo =
            worksheet
              ?.getSheetValues()
              ?.reduce<Record<string, object>>((acc = {}, row, rowIndex) => {
                if (row) {
                  Array.isArray(row) &&
                    row.forEach((cell, colIndex) => {
                      if (
                        cell &&
                        typeof cell === 'object' &&
                        'dataValidation' in cell
                      ) {
                        const cellAddress = `${String.fromCharCode(65 + colIndex)}${rowIndex}`;
                        acc[cellAddress] =
                          (cell as { dataValidation?: object | undefined })
                            .dataValidation ?? {};
                      }
                    });
                }
                return acc;
              }, {}) || null;

          transformExcelToLucky(
            file,
            function (exportJson: { sheets: Sheet[] }) {
              const sheets = exportJson.sheets;
              for (const sheet of sheets) {
                if (dropdownInfo && Object.keys(dropdownInfo).length > 0) {
                  const dataVerification: Record<string, object> = {};
                  for (const key of Object.keys(dropdownInfo)) {
                    const value = dropdownInfo[key];
                    if (value.type === 'list') {
                      const splited = key.split('');
                      const col_ = splited[0].charCodeAt(0) - 65;
                      const row_ = Number(splited[1]) - 1;
                      const f_key = `${row_}_${col_}`;
                      dataVerification[f_key] = {
                        type: 'dropdown',
                        type2: '',
                        rangeTxt: key,
                        value1: value.formulae?.[0]?.replace(/["']/g, '') || '',
                        value2: '',
                        validity: '',
                        remote: false,
                        prohibitInput: true,
                        hintShow: false,
                        hintValue: '',
                        checked: false,
                      };
                    }
                  }
                  sheet.dataVerification = dataVerification;
                }
              }
              // Send the processed data to the caller
              onDataImported(sheets);
            },
          );
        } catch (error) {
          console.error('Error loading the workbook', error);
          alert(
            'Error loading the workbook. Please ensure it is a valid .xlsx file.',
          );
        }
      };

      reader.readAsArrayBuffer(file);
    };

    input.click();
  }, [onDataImported]);

  return { handleXLSXUpload };
};
