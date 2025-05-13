import { useMemo, useState, useCallback, useRef, useId } from 'react';
import { useDsheetEditor } from './use-dsheet-editor';
import { Workbook, WorkbookInstance } from '@fileverse-dev/fortune-react';
import { Cell } from '@fileverse-dev/fortune-core';
import cn from 'classnames';

import { useApplyTemplatesBtn } from './hooks/use-apply-templates';
import { useFortuneDocumentStyle } from './hooks/use-document-style';
import { DEFAULT_SHEET_DATA } from './constants/shared-constants';
import { DsheetProps } from './types';
import { handleCSVUpload } from './utils/csv-import';
import { useXLSXImport } from './hooks/use-xlsx-import';
import { handleExportToXLSX } from './utils/xlsx-export';
import { handleExportToCSV } from './utils/csv-export';
import { handleExportToJSON } from './utils/json-export';
import { afterUpdateCell } from './utils/after-update-cell';
import { getCustomToolbarItems } from './utils/custom-toolbar-item';
import { OnboardingUI } from './components/onboarding';

import '@fileverse-dev/fortune-react/dist/index.css';
import './styles/editor.scss';
import './styles/index.css';

const SpreadsheetEditor = ({
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
  isTemplateOpen,
  initialTitle = 'Untitled',
  onTitleChange,
  enableWebrtc,
  sheetEditorRef: externalSheetEditorRef,
}: DsheetProps) => {
  const [forceSheetRender, setForceSheetRender] = useState(1);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const workbookId = useId(); // Stable ID for the workbook

  // Create an internal ref if none is provided
  const internalEditorRef = useRef<WorkbookInstance>(null);
  const editorRef = externalSheetEditorRef || internalEditorRef;

  const {
    handleChange,
    currentDataRef,
    ydocRef,
    loading,
    title,
    handleTitleChange,
  } = useDsheetEditor({
    initialSheetData,
    enableIndexeddbSync,
    dsheetId,
    username,
    onChange,
    portalContent,
    enableWebrtc,
    initialTitle,
    isCollaborative,
    sheetEditorRef: editorRef,
  });

  // When title changes, notify parent component if handler exists
  const onInternalTitleChange = useCallback(
    (newTitle: string) => {
      handleTitleChange(newTitle);
      if (onTitleChange) {
        onTitleChange(newTitle);
      }
    },
    [handleTitleChange, onTitleChange],
  );

  useApplyTemplatesBtn({
    selectedTemplate,
    ydocRef,
    dsheetId,
    currentDataRef,
    setForceSheetRender,
    sheetEditorRef: editorRef,
  });

  const { handleXLSXUpload } = useXLSXImport({
    sheetEditorRef: editorRef,
    ydocRef,
    setForceSheetRender,
    dsheetId,
    currentDataRef,
  });

  useFortuneDocumentStyle(exportDropdownOpen, isTemplateOpen);

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
          ) => {
            // Create a React.RefObject<WorkbookInstance | null> object
            const refObj = { current: editorRef.current };
            afterUpdateCell(row, column, oldValue, newValue, refObj);
          },
        }}
      />
    );
  }, [forceSheetRender, loading, dsheetId, workbookId]);

  // Prepare navbar props for title handling
  const navbarProps = {
    title,
    onTitleChange: onInternalTitleChange,
  };

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
          {renderNavbar(navbarProps)}
        </nav>
      )}
      <div style={{ height: '96.4%', marginTop: '56px' }}>
        {MemoizedSheetEditor}
      </div>
      <OnboardingUI sheetEditorRef={editorRef} />
    </div>
  );
};

export default SpreadsheetEditor;
