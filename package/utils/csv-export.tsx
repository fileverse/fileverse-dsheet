import { Sheet } from '@fileverse-dev/fortune-core';

export const handleExportToCSV = (sheets: Sheet[]): void => {
  try {
    console.log(
      '[csv-export] Starting CSV export. Sheets data:',
      JSON.parse(JSON.stringify(sheets)),
    );
    const sheetData = sheets;

    if (!sheetData || sheetData.length === 0) {
      console.error('[csv-export] No sheets array provided or array is empty.');
      alert('No data available to export to CSV.');
      return;
    }

    const activeSheet =
      sheetData.find((sheet) => sheet.status === 1) || sheetData[0];
    console.log(
      '[csv-export] Active sheet for export:',
      JSON.parse(JSON.stringify(activeSheet)),
    );

    if (
      !activeSheet ||
      !activeSheet.celldata ||
      activeSheet.celldata.length === 0
    ) {
      console.error('[csv-export] No data to export in activeSheet.celldata');
      alert('Active sheet has no data to export.'); // More specific alert
      return;
    }

    // Find the maximum row and column indices
    let maxRow = 0;
    let maxCol = 0;

    activeSheet.celldata.forEach((cell) => {
      maxRow = Math.max(maxRow, cell.r);
      maxCol = Math.max(maxCol, cell.c);
    });
    console.log(
      `[csv-export] Calculated dimensions: maxRow=${maxRow}, maxCol=${maxCol}`,
    );

    const rows: string[][] = [];
    for (let i = 0; i <= maxRow; i++) {
      rows[i] = Array(maxCol + 1).fill('');
    }

    activeSheet.celldata.forEach((cell) => {
      const value =
        cell.v && cell.v.v !== undefined && cell.v.v !== null ? cell.v.v : '';
      rows[cell.r][cell.c] = String(value);
    });

    console.log(
      '[csv-export] Constructed rows grid:',
      JSON.parse(JSON.stringify(rows)),
    );

    // Convert rows to CSV format
    const csvContent = rows
      .map((row) => {
        return row
          .map((cell) => {
            // Handle values that need to be quoted (contain commas, quotes, or newlines)
            if (cell === null || cell === undefined) {
              return '';
            }

            const cellStr = String(cell);
            if (
              cellStr.includes(',') ||
              cellStr.includes('"') ||
              cellStr.includes('\n')
            ) {
              // Escape quotes by doubling them and wrap in quotes
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(',');
      })
      .join('\n');
    console.log('[csv-export] Final CSV content:\n', csvContent);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeSheet.name || 'flvSheet'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('CSV export failed:', error);
  }
};
