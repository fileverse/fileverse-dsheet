import { forwardRef } from "react";
import { useDsheetEditor } from './use-dsheet-editor'
import { Workbook } from "@fortune-sheet/react";
import cn from 'classnames';

import { DsheetProp } from './types'
import "@fortune-sheet/react/dist/index.css"
// @ts-ignore
import LuckyExcel from "luckyexcel";

import './styles/editor.scss';
import './styles/index.css';

const SpreadsheetEditor = forwardRef((
    { renderNavbar, initialSheetData }: DsheetProp,
    // @ts-ignore
    refEditor
) => {
    const { ref, sheetData } = useDsheetEditor({ initialSheetData });
    return (
        <div style={{ height: "calc(100vh)" }}>
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
            <div style={{ height: "96.4%", marginTop: "56px" }} >
                <Workbook ref={ref} data={sheetData} onChange={(data) => {
                    console.log(data)
                }} />
            </div>

            {/* <button >Export</button> */}
            {/* <input type="file" onChange={handleFileUpload} /> */}
        </div>
    );
})


export default SpreadsheetEditor;
