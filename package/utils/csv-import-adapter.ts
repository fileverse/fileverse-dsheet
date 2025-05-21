import Papa from 'papaparse';
import { Sheet } from '@fileverse-dev/fortune-core';

/**
 * Handles CSV file import and converts to Fortune sheet format
 */
export const handleCSVImport = (
  file: File,
  onDataImported: (data: Sheet[]) => void,
) => {
  console.log('[csv-import-adapter] handleCSVImport called with file:', file);
  if (!file) {
    console.error('[csv-import-adapter] No file provided.');
    return;
  }
  if (!(file instanceof File)) {
    console.error(
      '[csv-import-adapter] Provided file is not a File object:',
      file,
    );
    return;
  }

  const reader = new FileReader();

  reader.onloadstart = () => {
    console.log('[csv-import-adapter] FileReader onloadstart');
  };

  reader.onprogress = (event) => {
    if (event.lengthComputable) {
      const percentLoaded = Math.round((event.loaded / event.total) * 100);
      console.log(
        `[csv-import-adapter] FileReader onprogress: ${percentLoaded}%`,
      );
    }
  };

  reader.onload = (e) => {
    console.log('[csv-import-adapter] FileReader onload triggered.');
    if (!e.target) {
      console.error('[csv-import-adapter] FileReader event target is null');
      return;
    }
    const csvContent = e.target.result;
    console.log(
      '[csv-import-adapter] CSV content length:',
      (csvContent as string)?.length,
    );

    if (typeof csvContent === 'string') {
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log(
            '[csv-import-adapter] Papa.parse complete. Results:',
            results,
          );
          if (results.errors.length > 0) {
            console.error(
              '[csv-import-adapter] CSV Parsing errors:',
              results.errors,
            );
            alert('Error parsing CSV file. Check console for details.');
            return;
          }
          if (!results.data || results.data.length === 0) {
            console.warn(
              '[csv-import-adapter] CSV data is empty or undefined after parsing.',
            );
            alert(
              'CSV file appears to be empty or could not be parsed correctly.',
            );
            return;
          }

          // Convert CSV data to fortune-sheet format
          const cellData: {
            r: number;
            c: number;
            v: {
              m: string | number | null;
              ct: { fa: string; t: string };
              v: string | number | null;
            };
          }[] = [];
          const headers = results.meta.fields || [];

          if (headers.length === 0) {
            console.warn('[csv-import-adapter] No headers found in CSV.');
            alert('Could not detect headers in the CSV file.');
            return;
          }

          const headerRow = headers.map((header, index) => ({
            r: 0,
            c: index,
            v: {
              m: header !== null ? String(header) : null,
              ct: { fa: 'General', t: 'g' },
              v: header !== null ? String(header) : null,
            },
          }));
          cellData.push(...headerRow);

          let maxRow = 0;
          let maxCol = headers.length - 1;

          results.data.forEach((row, rowIndex) => {
            const typedRow = row as Record<string, string | number | null>;
            headers.forEach((header, colIndex) => {
              cellData.push({
                r: rowIndex + 1,
                c: colIndex,
                v: {
                  m:
                    typedRow[header] !== null && typedRow[header] !== undefined
                      ? String(typedRow[header])
                      : null,
                  ct: { fa: 'General', t: 'g' },
                  v:
                    typedRow[header] !== null && typedRow[header] !== undefined
                      ? String(typedRow[header])
                      : null,
                },
              });
            });
            maxRow = Math.max(maxRow, rowIndex + 1);
          });

          console.log('[csv-import-adapter] Constructed cellData:', cellData);

          const sheetObject: Sheet = {
            name: file.name.split('.')[0] || 'Sheet1',
            celldata: cellData,
            row: maxRow + 1,
            column: maxCol + 1,
            status: 1,
            order: 0,
            config: {
              merge: {},
            },
            isPivotTable: false,
            pivotTable: undefined,
          };
          console.log(
            '[csv-import-adapter] Sheet object created:',
            sheetObject,
          );
          onDataImported([sheetObject]);
        },
        error: (error: any) => {
          console.error(
            '[csv-import-adapter] Papa.parse error callback:',
            error,
          );
          alert(`Error parsing CSV: ${error.message}`);
        },
      });
    } else {
      console.error('[csv-import-adapter] CSV content is not a string.');
    }
  };

  reader.onerror = (error) => {
    console.error('[csv-import-adapter] FileReader onerror:', error);
    alert('Error reading the CSV file.');
  };

  console.log('[csv-import-adapter] Calling reader.readAsText(file)');
  reader.readAsText(file);
};
