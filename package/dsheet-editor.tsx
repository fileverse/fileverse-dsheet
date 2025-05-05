import { forwardRef, useMemo, useState } from 'react';
import { useDsheetEditor } from './use-dsheet-editor';
import { Workbook } from '@mritunjaygoutam12/react';
import { Sheet } from '@mritunjaygoutam12/core-mod';
import cn from 'classnames';
import { useFortuneToolbarImportBtn } from './hooks/use-fortune-toolbar-import';
import { useToggleTemplateBtn } from './hooks/use-toggle-template';
import { useApplyTemplatesBtn } from './hooks/use-apply-templates';

import { DEFAULT_SHEET_DATA } from './constants/shared-constants';
import { DsheetProp } from './types';
import { handleCSVUpload } from './utils/csv-import';
import { useXLSXImport } from './hooks/use-xlsx-import';
import { handleExportToXLSX } from './utils/xlsx-export';
import { handleExportToCSV } from './utils/csv-export';
import { handleExportToJSON } from './utils/json-export';
import '@mritunjaygoutam12/react/dist/index.css';

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
      selectedTemplate,
      toggleTemplateSidebar,
    }: DsheetProp,
    //ref: parentSheetEditorRef,
  ) => {
    const [forceSheetRender, setForceSheetRender] = useState(1);
    const { sheetEditorRef, handleChange, currentDataRef, ydocRef, loading } =
      useDsheetEditor({
        initialSheetData,
        enableIndexeddbSync,
        dsheetId,
        username,
        onChange,
        portalContent,
        isCollaborative,
        setForceSheetRender,
      });

    useApplyTemplatesBtn({
      selectedTemplate,
      ydocRef,
      dsheetId,
      currentDataRef,
      setForceSheetRender,
      sheetEditorRef,
    });

    const { handleXLSXUpload } = useXLSXImport({
      sheetEditorRef,
      ydocRef,
      setForceSheetRender,
      dsheetId,
      currentDataRef,
    });

    useFortuneToolbarImportBtn({
      handleCSVUpload: (event) =>
        handleCSVUpload(
          event,
          ydocRef.current,
          setForceSheetRender,
          dsheetId,
          currentDataRef,
        ),
      handleXLSXUpload: handleXLSXUpload,
      handleExportToXLSX: () =>
        handleExportToXLSX(sheetEditorRef, ydocRef, dsheetId),
      handleExportToCSV: () =>
        handleExportToCSV(sheetEditorRef, ydocRef, dsheetId),
      handleExportToJSON: () => handleExportToJSON(sheetEditorRef),
    });

    useToggleTemplateBtn({
      toggleTemplateSidebar,
    });

    const MemoizedSheetEditor = useMemo(() => {
      console.log(
        'MemoizedSheetEditor hh',
        forceSheetRender,
        currentDataRef.current,
      );
      return (
        <Workbook
          key={Date.now()}
          ref={sheetEditorRef}
          data={currentDataRef.current || DEFAULT_SHEET_DATA}
          onChange={handleChange}
          showFormulaBar={!isReadOnly}
          showToolbar={!isReadOnly}
          allowEdit={!isReadOnly}
          lang={'en'}
          rowHeaderWidth={60}
          columnHeaderHeight={24}
          defaultColWidth={100}
          defaultRowHeight={21}
          hooks={{
            afterActivateSheet: (sheetId: string) => {
              console.log('activate sheet', sheetId);
            },
            afterUpdateCell: (
              row: number,
              column: number,
              oldValue: object,
              newValue: object,
            ) => {
              sheetEditorRef.current?.setCellValue(row, column, {
                ...newValue,
                tb: '1',
              });
              console.log('update cell', oldValue);
            },
            afterAddSheet: (sheet: Sheet) => {
              console.log('add sheet', sheet);
            },
          }}
        />
      );
    }, [forceSheetRender, loading]);

    return (
      <div style={{ height: 'calc(100vh)' }}>
        {renderNavbar && (
          <nav
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
          </nav>
        )}
        <div style={{ height: '96.4%', marginTop: '56px' }}>
          {MemoizedSheetEditor}
        </div>
      </div>
    );
  },
);

export default SpreadsheetEditor;
