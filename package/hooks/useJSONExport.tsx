export const handleExportToJSON = (sheetEditorRef: any) => {
    if (!sheetEditorRef.current) return;

    try {
        const workbook = sheetEditorRef.current;
        const allSheets = workbook.getAllSheets();
        const blob = new Blob([JSON.stringify(allSheets, null, 2)], { type: 'application/json' });
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
}