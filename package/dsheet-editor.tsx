import { forwardRef, useMemo } from 'react';
import { useDsheetEditor } from './use-dsheet-editor';
import { Workbook } from '@fortune-sheet/react';
import cn from 'classnames';

import { DEFAULT_SHEET_DATA } from './constant/shared-constant';
import { DsheetProp } from './types';
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
            dsheetId,
            portalContent,
            onChange,
            username,
        }: DsheetProp,
        // @ts-ignore
        ref: parentSheetEditorRef,
    ) => {
        const { sheetEditorRef, handleChange, loading, currentDataRef } =
            useDsheetEditor({ initialSheetData, enableIndexeddbSync, dsheetId, username, onChange, portalContent, isCollaborative });

        const MemoizedSheetEditor = useMemo(() => {
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
        }, [loading]);

        if (loading) {
            return <div></div>;
        }


        return (
            <div style={{ height: 'calc(100vh)' }}>
                <nav
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
                </nav>
                <div style={{ height: '96.4%', marginTop: '56px' }}>
                    {MemoizedSheetEditor}
                </div>
            </div>
        );
    },
);

export default SpreadsheetEditor;
