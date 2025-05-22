import { useMemo, useState, useRef, useId } from 'react';
import { useDsheetEditor } from './use-dsheet-editor';
import { Workbook, WorkbookInstance } from '@fileverse-dev/fortune-react';
import { Cell } from '@fileverse-dev/fortune-core';
import cn from 'classnames';

import { useApplyTemplatesBtn } from './hooks/use-apply-templates';
import { useFortuneDocumentStyle } from './hooks/use-document-style';
import { DEFAULT_SHEET_DATA } from './constants/shared-constants';
import { DsheetProps, EditorValues } from './types';
import { handleCSVUpload } from './utils/csv-import';
import { useXLSXImport } from './hooks/use-xlsx-import';
import { handleExportToXLSX } from './utils/xlsx-export';
import { handleExportToCSV } from './utils/csv-export';
import { handleExportToJSON } from './utils/json-export';
import { afterUpdateCell } from './utils/after-update-cell';
import { getCustomToolbarItems } from './utils/custom-toolbar-item';
import SkeletonLoader from './components/skeleton-loader';

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
  enableIndexeddbSync,
  dsheetId,
  portalContent,
  onChange,
  username,
  selectedTemplate,
  toggleTemplateSidebar,
  isTemplateOpen,
  enableWebrtc,
  onboardingComplete,
  onboardingHandler,
  dataBlockApiKeyHandler,
  sheetEditorRef: externalSheetEditorRef,
}: DsheetProps): JSX.Element => {
  const [forceSheetRender, setForceSheetRender] = useState<number>(1);
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);
  const workbookId = useId(); // Stable ID for the workbook

  // Create an internal ref if none is provided
  const internalEditorRef = useRef<WorkbookInstance>(null);
  const editorRef = externalSheetEditorRef || internalEditorRef;

  const { handleChange, currentDataRef, ydocRef, loading } = useDsheetEditor({
    enableIndexeddbSync,
    dsheetId,
    username,
    onChange,
    portalContent,
    enableWebrtc,
    isCollaborative,
    sheetEditorRef: editorRef,
    setForceSheetRender,
    isReadOnly,
  });

  // Initialize template button functionality
  useApplyTemplatesBtn({
    selectedTemplate,
    ydocRef,
    dsheetId,
    currentDataRef,
    setForceSheetRender,
    sheetEditorRef: editorRef,
  });

  // Initialize XLSX import functionality
  const { handleXLSXUpload } = useXLSXImport({
    sheetEditorRef: editorRef,
    ydocRef,
    setForceSheetRender,
    dsheetId,
    currentDataRef,
  });

  // Apply custom styling based on dropdown and template states
  useFortuneDocumentStyle(exportDropdownOpen, isTemplateOpen);

  // Memoized spreadsheet editor component to avoid unnecessary re-renders
  const MemoizedSheetEditor = useMemo(() => {
    return (
      <Workbook
        key={`${workbookId}-${forceSheetRender}`}
        ref={editorRef}
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
        customToolbarItems={getCustomToolbarItems({
          setExportDropdownOpen,
          handleCSVUpload,
          handleXLSXUpload,
          handleExportToXLSX,
          handleExportToCSV,
          handleExportToJSON,
          sheetEditorRef: editorRef,
          ydocRef,
          dsheetId,
          currentDataRef,
          setForceSheetRender,
          toggleTemplateSidebar,
        })}
        hooks={{
          afterUpdateCell: (
            row: number,
            column: number,
            oldValue: Cell,
            newValue: Cell,
          ): void => {
            console.log('Update', oldValue, newValue);
            const refObj = { current: editorRef.current };
            afterUpdateCell({
              row,
              column,
              newValue,
              sheetEditorRef: refObj,
              onboardingComplete,
              onboardingHandler,
              dataBlockApiKeyHandler,
            });
          },
        }}
      />
    );
  }, [forceSheetRender, loading, dsheetId, workbookId]);

  // Create editor values to pass to the navbar
  const editorValues: EditorValues = {
    sheetEditorRef: editorRef,
    currentDataRef,
    ydocRef,
  };

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
        {loading ? <SkeletonLoader /> : MemoizedSheetEditor}
      </div>
    </div>
  );
};

export default SpreadsheetEditor;
