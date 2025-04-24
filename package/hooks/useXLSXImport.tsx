import { useEffect, useState } from "react";
// import { Workbook } from "@fortune-sheet/react";
import ExcelJS from "exceljs";
// import "@fortune-sheet/react/dist/index.css"
// @ts-ignore
import LuckyExcel from "luckyexcel";

export const useXLSXImport = ({
    sheetEditorRef,
    ydocRef,
    setForceSheetRender,
    dsheetId,
    currentDataRef
}: {
    sheetEditorRef: React.RefObject<any>,
    ydocRef: React.RefObject<any>,
    setForceSheetRender: React.Dispatch<React.SetStateAction<number>>,
    dsheetId: string,
    currentDataRef: React.MutableRefObject<any>
}) => {
    const [sheetData, setSheetData] = useState<{ config: { merge: any } }[]>([]);
    const [mergeInfo, setMergeInfo] = useState<Record<string, { r: number; c: number; rs: number; cs: number }> | null>(null);

    useEffect(() => {
        if (sheetEditorRef && sheetEditorRef.current) {
            console.log(sheetEditorRef.current.getAllSheets());
            if (sheetData.length > 0) {
                setMergeInfo(sheetData[0].config.merge);
            }
        }
    }, [sheetData]);

    useEffect(() => {
        if (mergeInfo) {
            Object.keys(mergeInfo).forEach(key => {
                const merge = mergeInfo[key] as { r: number; c: number; rs: number; cs: number };
                const startCellAddressR = merge.r
                const startCellAddressC = merge.c
                const endCellAddressR = merge.r + merge.rs - 1
                const endCellAddressC = merge.c + merge.cs - 1
                if (sheetEditorRef && sheetEditorRef.current) {
                    console.log("MERGING CELL")
                    sheetEditorRef.current.mergeCells([
                        { row: [startCellAddressR, endCellAddressR], column: [startCellAddressC, endCellAddressC] }
                    ], 'merge-horizontal')
                }
            })
        }
    }, [mergeInfo])

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log("handleFileUpload")
        const input = event.target;
        if (!input.files?.length) {
            return;
        }
        const file = input.files[0];
        let dropdownInfo: any = null

        const reader = new FileReader();
        reader.onload = async (e) => {
            if (!e.target) {
                console.error("FileReader event target is null");
                return;
            }
            const arrayBuffer = e.target.result;
            const workbook = new ExcelJS.Workbook();
            try {
                // @ts-ignore
                await workbook.xlsx.load(arrayBuffer);
                const worksheet = workbook.getWorksheet(1);
                dropdownInfo = worksheet?.getSheetValues()?.reduce<Record<string, any>>((acc = {}, row, rowIndex) => {
                    if (row) {
                        Array.isArray(row) && row.forEach((cell, colIndex) => {
                            if (cell && typeof cell === 'object' && 'dataValidation' in cell) {
                                const cellAddress = `${String.fromCharCode(65 + colIndex)}${rowIndex}`;
                                acc[cellAddress] = (cell as any).dataValidation;
                            }
                        });
                    }
                    return acc;
                }, {});
                LuckyExcel.transformExcelToLucky(
                    file,
                    // @ts-ignore
                    function (exportJson: { sheets: any[] }, luckysheetfile: any) {
                        const sheets = exportJson.sheets
                        for (let sheet of sheets) {
                            if (dropdownInfo && Object.keys(dropdownInfo).length > 0) {
                                const dataVerification: Record<string, any> = {}
                                for (let key of Object.keys(dropdownInfo)) {
                                    const value = dropdownInfo[key]
                                    if (value.type === 'list') {
                                        const splited = key.split('')
                                        const col_ = splited[0].charCodeAt(0) - 65
                                        const row_ = Number(splited[1]) - 1
                                        const f_key = `${row_}_${col_}`
                                        dataVerification[f_key] = {
                                            type: "dropdown",
                                            type2: "",
                                            rangeTxt: key,
                                            value1: value.formulae[0].replace(/["']/g, ""),
                                            value2: "",
                                            validity: "",
                                            remote: false,
                                            prohibitInput: true,
                                            hintShow: false,
                                            hintValue: "",
                                            checked: false
                                        }
                                    }
                                }
                                sheet.dataVerification = dataVerification
                            }
                        }
                        setSheetData(sheets);

                        if (!ydocRef.current) {
                            console.error("ydocRef.current is null");
                            return;
                        }
                        const sheetArray = ydocRef.current.getArray(dsheetId);
                        ydocRef.current.transact(() => {
                            sheetArray.delete(0, sheetArray.length);
                            sheetArray.insert(0, sheets);
                            currentDataRef.current = sheets;
                        });
                        setForceSheetRender((prev: number) => prev + 1);
                    }
                );
            } catch (error) {
                console.error('Error loading the workbook', error);
                alert('Error loading the workbook. Please ensure it is a valid .xlsx file.');
            }
        };

        reader.readAsArrayBuffer(file);
    };

    return { handleXLSXUpload: handleFileUpload }

};

