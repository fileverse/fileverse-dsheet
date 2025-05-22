import React, { useMemo } from 'react';
import { Workbook } from '@fileverse-dev/fortune-react';
import { Cell } from '@fileverse-dev/fortune-core';

import { DEFAULT_SHEET_DATA } from '../constants/shared-constants';
import { getCustomToolbarItems } from '../utils/custom-toolbar-item';
import { useEditor } from '../contexts/editor-context';
import { afterUpdateCell } from '../utils/after-update-cell';
import { handleCSVUpload } from '../utils/csv-import';
import { handleExportToXLSX } from '../utils/xlsx-export';
import { handleExportToCSV } from '../utils/csv-export';
import { handleExportToJSON } from '../utils/json-export';
import { useXLSXImport } from '../hooks/use-xlsx-import';
import { OnboardingHandlerType, DataBlockApiKeyHandlerType } from '../types';

// Use the types defined in types.ts
type OnboardingHandler = OnboardingHandlerType;
type DataBlockApiKeyHandler = DataBlockApiKeyHandlerType;

interface EditorWorkbookProps {
  isReadOnly?: boolean;
  toggleTemplateSidebar?: () => void;
  onboardingComplete?: boolean;
  onboardingHandler?: OnboardingHandler;
  dataBlockApiKeyHandler?: DataBlockApiKeyHandler;
  exportDropdownOpen?: boolean;
  setExportDropdownOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  dsheetId: string;
}

/**
 * EditorWorkbook component handles rendering the Fortune Workbook with proper configuration
 */
export const EditorWorkbook: React.FC<EditorWorkbookProps> = ({
  isReadOnly = false,
  toggleTemplateSidebar,
  onboardingComplete,
  onboardingHandler,
  dataBlockApiKeyHandler,
  exportDropdownOpen = false,
  setExportDropdownOpen = () => {},
  dsheetId,
}) => {
  const {
    sheetEditorRef,
    ydocRef,
    currentDataRef,
    handleChange,
    forceSheetRender,
    setForceSheetRender,
    syncStatus,
  } = useEditor();

  // Initialize XLSX import functionality
  const { handleXLSXUpload } = useXLSXImport({
    sheetEditorRef,
    ydocRef,
    setForceSheetRender,
    dsheetId,
    currentDataRef,
  });

  // Memoized workbook component to avoid unnecessary re-renders
  return useMemo(() => {
    // Create a unique key to force re-render when needed
    const workbookKey = `workbook-${dsheetId}-${forceSheetRender}`;

    // Make sure we have data to display
    const data =
      currentDataRef.current && currentDataRef.current.length > 0
        ? currentDataRef.current
        : DEFAULT_SHEET_DATA;

    return (
      <Workbook
        key={workbookKey}
        ref={sheetEditorRef}
        data={data}
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
          sheetEditorRef,
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
            const refObj = { current: sheetEditorRef.current };
            console.log(oldValue);
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
  }, [
    forceSheetRender,
    isReadOnly,
    handleChange,
    toggleTemplateSidebar,
    onboardingComplete,
    onboardingHandler,
    dataBlockApiKeyHandler,
    dsheetId,
    exportDropdownOpen,
    // Add syncStatus to the dependency array to ensure re-render when sync completes
    syncStatus,
  ]);
};
