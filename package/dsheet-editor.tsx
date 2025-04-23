import { forwardRef, useMemo, useState } from 'react';
import { useDsheetEditor } from './use-dsheet-editor';
import { Workbook } from '@fortune-sheet/react';
import cn from 'classnames';
import { useFortuneToolbarImportBtn } from './hooks/useFortuneToolbarImportBtn'
import Papa from "papaparse";

import { DEFAULT_SHEET_DATA } from './constant/shared-constant';
import { DsheetProp } from './types';
import '@fortune-sheet/react/dist/index.css';
import { Sheet } from '@fortune-sheet/core';
// @ts-ignore
import LuckyExcel from 'luckyexcel';

import './styles/editor.scss';
import './styles/index.css';

const SpreadsheetEditor = forwardRef(
    (
        {
            isCollaborative = false,
            isReadOnly = false,
            renderNavbar,
            initialSheetData,
            enableIndexeddbSync,
            dsheetId = 'randomwvghgeklwe',
            portalContent,
            onChange,
            username,
        }: DsheetProp,
        // @ts-ignore
        ref: parentSheetEditorRef,
    ) => {
        const [test, setTest] = useState(1);
        const { sheetEditorRef, handleChange, currentDataRef, ydocRef, loading } =
            useDsheetEditor({ initialSheetData, enableIndexeddbSync, dsheetId, username, onChange, portalContent, isCollaborative });

        const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
            console
            const input = event.target;
            if (!input.files?.length) {
                return;
            }
            const file = input.files[0];

            const reader = new FileReader();
            reader.onload = (e) => {
                if (!e.target) {
                    console.error("FileReader event target is null");
                    return;
                }
                const csvContent = e.target.result;

                if (typeof csvContent === "string") {
                    Papa.parse(csvContent, {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            if (results.errors.length > 0) {
                                console.error("CSV Parsing errors:", results.errors);
                                alert("Error parsing CSV file");
                                return;
                            }

                            // Convert CSV data to fortune-sheet format
                            const cellData: { r: number; c: number; v: string | number | null }[] = [];
                            const headers = results.meta.fields || [];

                            // Add header row
                            const headerRow = headers.map((header, index) => ({
                                r: 0,
                                c: index,
                                v: header
                            }));

                            headerRow.forEach(cell => {
                                cellData.push(cell);
                            });

                            // Add data rows
                            let maxRow = 0;
                            let maxCol = 0;
                            results.data.forEach((row, rowIndex) => {
                                headers.forEach((header, colIndex) => {
                                    //console.log(rowIndex, colIndex);
                                    cellData.push({
                                        r: rowIndex + 1, // +1 because header is row 0
                                        c: colIndex,
                                        v: (row as Record<string, any>)[header] !== undefined ? (row as Record<string, any>)[header] : ""
                                    });
                                    maxRow = Math.max(maxRow, rowIndex + 1);
                                    maxCol = Math.max(maxCol, colIndex + 1);
                                });
                            });

                            // Create sheet object in fortune-sheet format
                            const sheetObject = {
                                name: "Sheet1",
                                celldata: [...cellData],
                                row: maxRow + 1, // +1 for header
                                column: maxCol + 1,
                                status: 1,
                                order: 0,
                                config: {
                                    merge: {}, // No merge cells for CSV by default
                                }
                            };

                            //const sheetArray = ydocRef.current.getArray(dsheetId);

                            console.log("Parsed sheetObject:", cellData, [sheetObject]);



                            if (!ydocRef.current) {
                                console.error("ydocRef.current is null");
                                return;
                            }
                            const sheetArray = ydocRef.current.getArray(dsheetId);
                            // let localIndexeddbData;
                            // if (sheetArray && sheetArray.length > 0) {
                            //     localIndexeddbData = Array.from(sheetArray) as Sheet[];
                            // }
                            // const newSheetData = DEFAULT_SHEET_DATA;
                            //if (!collaborative) {
                            ydocRef.current.transact(() => {
                                sheetArray.delete(0, sheetArray.length);
                                sheetArray.insert(0, [sheetObject]);
                                currentDataRef.current = [sheetObject as Sheet];
                            });
                            setTest(test + 1);
                        }
                    });
                }
            };

            reader.readAsText(file);
        };

        useFortuneToolbarImportBtn({ handleCSVUpload, ydocRef });

        const MemoizedSheetEditor = useMemo(() => {
            console.log('MemoizedSheetEditor', test, currentDataRef.current);
            return (
                <Workbook
                    key={Date.now()}
                    ref={sheetEditorRef}
                    data={currentDataRef.current || DEFAULT_SHEET_DATA}
                    onChange={handleChange}
                    showFormulaBar={!isReadOnly}
                    showToolbar={!isReadOnly}
                    allowEdit={!isReadOnly}
                />
            );
        }, [test, loading]);


        return (
            <div style={{ height: 'calc(100vh)' }}>
                {renderNavbar && <nav
                    id="Navbar"
                    className={cn(
                        'h-14 color-bg-default py-2 px-4 flex gap-2 items-center justify-between w-screen fixed left-0 top-0 border-b color-border-default z-50 transition-transform duration-300',
                        {
                            'translate-y-0': true,
                            'translate-y-[-100%]': false,
                        },
                    )}
                >
                    {renderNavbar()}
                </nav>}
                <div style={{ height: '96.4%', marginTop: '56px' }}>
                    {MemoizedSheetEditor}
                </div>
            </div>
        );
    },
);

export default SpreadsheetEditor;
