import { useMemo, useRef, useId, useState } from 'react';
import { Workbook, WorkbookInstance } from '@fileverse-dev/fortune-react';
import { Cell } from '@fileverse-dev/fortune-core';
import cn from 'classnames';

import { useDSheetData } from './hooks/use-dsheet-data';
import { useFortuneDocumentStyle } from './hooks/use-document-style';
import { useTemplateManager } from './hooks/use-template-manager';
import { DsheetProps, EditorValues } from './types';
import { handleCSVImport } from './utils/csv-import-adapter';
import { useXLSXImportAdapter } from './hooks/use-xlsx-import-adapter';
import {
  exportToXLSX,
  exportToCSV,
  exportToJSON,
} from './utils/export-adapters';
import { afterUpdateCell } from './utils/after-update-cell';
import { getCustomToolbarItems } from './utils/custom-toolbar-item';

import '@fileverse-dev/fortune-react/dist/index.css';
import './styles/index.css';

/**
 * SpreadsheetEditor component that provides a collaborative spreadsheet interface
 * with various import/export capabilities and template support.
 *
 * @param props - Component properties
 * @returns The SpreadsheetEditor component
 */
const SpreadsheetEditor = ({
  isCollaborative = false,
  isReadOnly = false,
  renderNavbar,
  enableIndexeddbSync = false,
  dsheetId = '',
  portalContent,
  onChange,
  username = 'Anonymous',
  selectedTemplate,
  toggleTemplateSidebar,
  isTemplateOpen = false,
  enableWebrtc = false,
  onboardingComplete,
  onboardingHandler,
  dataBlockApiKeyHandler,
  sheetEditorRef: externalSheetEditorRef,
}: DsheetProps): JSX.Element => {
  const workbookId = useId();
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);
  const [dataVersion, setDataVersion] = useState(0);

  const internalEditorRef = useRef<WorkbookInstance>(null);
  const editorRef = externalSheetEditorRef || internalEditorRef;

  const {
    data: sheetData,
    isLoading,
    updateData,
  } = useDSheetData({
    sheetId: dsheetId,
    enablePersistence: enableIndexeddbSync,
    isReadOnly,
    portalContent,
    username,
    enableWebrtc: enableWebrtc && isCollaborative,
    webrtcServerUrl: 'wss://demos.yjs.dev/ws',
    onChange,
  });

  useTemplateManager({
    selectedTemplate:
      typeof selectedTemplate === 'object' ? selectedTemplate : null,
    updateData,
    sheetEditorRef: editorRef,
  });

  useFortuneDocumentStyle(exportDropdownOpen, isTemplateOpen);

  const { handleXLSXUpload: actualXLSXUploadHandler } = useXLSXImportAdapter({
    onDataImported: updateData,
  });

  const actualCSVUploadHandler = (file: File) => {
    console.log(
      '[SpreadsheetEditor] actualCSVUploadHandler called with file:',
      file,
    );
    handleCSVImport(file, (newData) => {
      console.log(
        '[SpreadsheetEditor] Data received from handleCSVImport:',
        newData,
      );
      updateData(newData);
      setDataVersion((prev) => prev + 1);
    });
  };

  const customToolbarItems = useMemo(() => {
    return getCustomToolbarItems({
      handleActualCSVUpload: actualCSVUploadHandler,
      handleActualXLSXUpload: actualXLSXUploadHandler,
      handleExportToXLSX: () => exportToXLSX(sheetData),
      handleExportToCSV: () => exportToCSV(sheetData),
      handleExportToJSON: () => exportToJSON(sheetData),
      setExportDropdownOpen,
      toggleTemplateSidebar,
    });
  }, [
    sheetData,
    toggleTemplateSidebar,
    updateData,
    actualXLSXUploadHandler,
    exportDropdownOpen,
  ]);

  const editorValues: EditorValues = {
    sheetEditorRef: editorRef,
    currentDataRef: { current: sheetData },
    ydocRef: { current: null },
  };

  if (isLoading) {
    return <div className="loading-indicator">Loading spreadsheet...</div>;
  }

  return (
    <div
      style={{ height: 'calc(100vh)' }}
      className={isReadOnly ? 'fortune-read-only' : ''}
    >
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
          {renderNavbar(editorValues)}
        </nav>
      )}

      <div style={{ height: '96.4%', marginTop: '56px' }}>
        <Workbook
          key={`${workbookId}-${dataVersion}`}
          ref={editorRef}
          data={sheetData}
          onChange={updateData}
          showFormulaBar={!isReadOnly}
          showToolbar={!isReadOnly}
          allowEdit={!isReadOnly}
          lang={'en'}
          rowHeaderWidth={60}
          columnHeaderHeight={24}
          defaultColWidth={100}
          defaultRowHeight={21}
          customToolbarItems={customToolbarItems}
          hooks={{
            /**
             * Hook called after a cell value is updated
             *
             * @param row - Row index of the updated cell
             * @param column - Column index of the updated cell
             * @param oldValue - Previous cell value
             * @param newValue - New cell value
             */
            afterUpdateCell: (
              row: number,
              column: number,
              oldValue: Cell,
              newValue: Cell,
            ): void => {
              afterUpdateCell({
                row,
                column,
                newValue,
                sheetEditorRef: { current: editorRef.current },
                onboardingComplete,
                onboardingHandler,
                dataBlockApiKeyHandler,
              });
            },
          }}
        />
      </div>
    </div>
  );
};

export default SpreadsheetEditor;
