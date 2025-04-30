import { forwardRef, useMemo, useState } from 'react';
import { useDsheetEditor } from './use-dsheet-editor';
import { Workbook } from '@fortune-sheet/react';
import cn from 'classnames';
import { useFortuneToolbarImportBtn } from './hooks/useFortuneToolbarImportBtn'

import { DEFAULT_SHEET_DATA } from './constant/shared-constant';
import { DsheetProp } from './types';
import { handleCSVUpload } from './hooks/useCSVImport'
import { useXLSXImport } from './hooks/useXLSXImport'
import { handleExportToXLSX } from './hooks/useXLSXExport'
import { handleExportToCSV } from './hooks/useCSVExport'
import { handleExportToJSON } from './hooks/useJSONExport'
import '@fortune-sheet/react/dist/index.css';
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
            dsheetId = 'randomwvtestmkfrhniirklprod--',
            portalContent,
            onChange,
            username,
        }: DsheetProp,
        // @ts-ignore
        ref: parentSheetEditorRef,
    ) => {
        const [forceSheetRender, setForceSheetRender] = useState(1);
        const { sheetEditorRef,
            handleChange,
            currentDataRef,
            ydocRef } = useDsheetEditor({
                initialSheetData,
                enableIndexeddbSync,
                dsheetId,
                username,
                onChange,
                portalContent,
                isCollaborative,
                setForceSheetRender
            });

        const { handleXLSXUpload } = useXLSXImport({ sheetEditorRef, ydocRef, setForceSheetRender, dsheetId, currentDataRef });

        useFortuneToolbarImportBtn({
            handleCSVUpload: (event) => handleCSVUpload(event, ydocRef.current, setForceSheetRender, dsheetId, currentDataRef),
            handleXLSXUpload: handleXLSXUpload,
            handleExportToXLSX: () => handleExportToXLSX(sheetEditorRef, ydocRef, dsheetId),
            handleExportToCSV: () => handleExportToCSV(sheetEditorRef, ydocRef, dsheetId),
            handleExportToJSON: () => handleExportToJSON(sheetEditorRef),
        });

        const MemoizedSheetEditor = useMemo(() => {
            console.log('MemoizedSheetEditor hh', forceSheetRender, currentDataRef.current);
            return (
                <Workbook
                    key={Date.now()}
                    ref={sheetEditorRef}
                    data={currentDataRef.current || DEFAULT_SHEET_DATA}
                    onChange={handleChange}
                    showFormulaBar={!isReadOnly}
                    showToolbar={!isReadOnly}
                    allowEdit={!isReadOnly}
                    hooks={{
                        afterActivateSheet: (sheet: any) => {
                            console.log('activate sheet', sheet);
                        },
                        afterUpdateCell: (sheet: any, cell: any) => {
                            console.log('cell updated', sheet, cell);
                        },
                        afterAddSheet: (sheet: any) => {
                            console.log('add sheet', sheet);
                        },
                    }}
                />
            );
        }, [forceSheetRender]);


        return (
            <div style={{ height: 'calc(100vh)' }}>
                {renderNavbar && <nav
                    id="Navbar"
                    className={cn(
                        `h-14 color-bg-default py-2 px-4 flex gap-2 items-center
                        justify-between w-screen fixed left-0 top-0 border-b
                        color-border-default z-50 transition-transform duration-300`,
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
