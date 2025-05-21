import { utils as XLSXUtil, writeFile as XLSXWriteFile } from 'xlsx';
import { Sheet } from '@fileverse-dev/fortune-core';

// This interface describes the structure of objects within the celldata array
interface RichCellData {
  r: number;
  c: number;
  v: {
    v?: string | number | boolean | null; // The actual primitive value
    m?: string | number | boolean | null; // The displayed/formatted value
    ct?: { fa?: string; t?: string }; // Cell type / format information
    // Include other properties from the core Cell type if needed for export
  } | null; // The 'v' object itself can be null for an empty cell
}

/**
 * Export sheet data to XLSX format
 */
export const exportToXLSX = (sheets: Sheet[]): void => {
  try {
    const workbook = XLSXUtil.book_new();

    sheets.forEach((sheet) => {
      const rows: (string | number | null)[][] = [];
      let maxRow = 0;
      let maxCol = 0;

      // This loop is just for dimensions, so {r, c} is enough
      (sheet.celldata || []).forEach((cell: { r: number; c: number }) => {
        maxRow = Math.max(maxRow, cell.r);
        maxCol = Math.max(maxCol, cell.c);
      });

      for (let i = 0; i <= maxRow; i++) {
        rows[i] = [];
        for (let j = 0; j <= maxCol; j++) {
          rows[i][j] = null;
        }
      }

      (sheet.celldata || []).forEach((cell: RichCellData) => {
        if (
          cell.r < rows.length &&
          rows[cell.r] &&
          cell.c < rows[cell.r].length
        ) {
          const value = cell.v?.v;
          if (typeof value === 'boolean') {
            rows[cell.r][cell.c] = value.toString().toUpperCase(); // Convert boolean to "TRUE" or "FALSE"
          } else {
            rows[cell.r][cell.c] = value ?? null;
          }
        }
      });

      const worksheet = XLSXUtil.aoa_to_sheet(rows);
      XLSXUtil.book_append_sheet(workbook, worksheet, sheet.name);
    });

    XLSXWriteFile(workbook, 'spreadsheet.xlsx');
  } catch (error) {
    console.error('Export to XLSX failed:', error);
    alert('Failed to export to XLSX. Please try again.');
  }
};

/**
 * Export sheet data to CSV format
 */
export const exportToCSV = (sheets: Sheet[]): void => {
  try {
    console.log(
      '[exportToCSV] Starting CSV export. Sheets data:',
      JSON.parse(JSON.stringify(sheets)),
    );
    // We'll only export the first sheet for CSV
    const sheet = sheets[0];
    if (!sheet) {
      console.error('[exportToCSV] No sheet data available in sheets[0]');
      alert('No sheet data available to export to CSV.'); // User-friendly alert
      return;
    }
    console.log(
      '[exportToCSV] Processing sheet:',
      JSON.parse(JSON.stringify(sheet)),
    );

    // Convert celldata to CSV format
    let csvContent = '';

    let maxRow = 0;
    let maxCol = 0;

    console.log(
      '[exportToCSV] Value of sheet.celldata before stringify:',
      sheet.celldata,
    );
    if (sheet.celldata !== undefined) {
      console.log(
        '[exportToCSV] About to calculate dimensions. sheet.celldata (stringified): Verbreitung',
        JSON.parse(JSON.stringify(sheet.celldata)),
      );
    } else {
      console.log('[exportToCSV] sheet.celldata is undefined.');
    }

    // This loop is just for dimensions, {r, c} is enough.
    (sheet.celldata || []).forEach(
      (cell: { r: number; c: number }, index: number) => {
        console.log(
          `[exportToCSV] Dimension calc: Processing cell index ${index}, r=${cell.r}, c=${cell.c}`,
        );
        maxRow = Math.max(maxRow, cell.r);
        maxCol = Math.max(maxCol, cell.c);
      },
    );
    console.log(
      `[exportToCSV] Calculated dimensions: maxRow=${maxRow}, maxCol=${maxCol}`,
    );

    // Create a 2D array to hold the data
    const grid: string[][] = [];
    for (let i = 0; i <= maxRow; i++) {
      grid[i] = [];
      for (let j = 0; j <= maxCol; j++) {
        grid[i][j] = ''; // Initialize with empty strings for CSV
      }
    }

    // Fill in the data
    (sheet.celldata || []).forEach((cell: RichCellData) => {
      const value = cell.v?.v?.toString() || '';
      // Escape commas and quotes for CSV
      const escapedValue =
        value.includes(',') || value.includes('"')
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      if (grid[cell.r] !== undefined && grid[cell.r][cell.c] !== undefined) {
        // Check if row and cell exists
        grid[cell.r][cell.c] = escapedValue;
      } else {
        // This case should ideally not be hit if maxRow/maxCol are correct and grid is initialized properly
        console.warn(
          `[exportToCSV] Cell out of bounds: r=${cell.r}, c=${cell.c}, value=${value}`,
        );
      }
    });

    console.log(
      '[exportToCSV] Constructed grid:',
      JSON.parse(JSON.stringify(grid)) as unknown[][], // Cast for logging
    );

    // Convert to CSV string
    for (let i = 0; i <= maxRow; i++) {
      if (grid[i]) {
        // Ensure row exists before joining
        csvContent += grid[i].join(',') + '\n';
      }
    }
    console.log('[exportToCSV] Final CSV content:\n', csvContent);

    // Create a download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', (sheet.name || 'spreadsheet') + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export to CSV failed:', error);
    alert('Failed to export to CSV. Please try again.');
  }
};

/**
 * Export sheet data to JSON format
 */
export const exportToJSON = (sheets: Sheet[]): void => {
  try {
    const jsonString = JSON.stringify(sheets, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'spreadsheet.json');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export to JSON failed:', error);
    alert('Failed to export to JSON. Please try again.');
  }
};
