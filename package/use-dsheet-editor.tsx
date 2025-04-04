import { useState, useRef } from 'react';
import { Sheet } from "@fortune-sheet/core";
import { WorkbookInstance } from "@fortune-sheet/react";
import { handleFileUploadUtil } from "./utils/handleFileImport"

export const useDsheetEditor = ({ initialSheetData }: { initialSheetData: Sheet[] }) => {
    const ref = useRef<WorkbookInstance>(null);

    const [sheetData, setSheetData] = useState<Sheet[]>(initialSheetData ? [...initialSheetData] : [{ name: "Untitled" }]);
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileSheetdata = await handleFileUploadUtil(event);
        setSheetData(fileSheetdata)
    }

    return {
        ref,
        sheetData,
        setSheetData,
        handleFileUpload
    }
}