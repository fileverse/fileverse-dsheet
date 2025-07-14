/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useEffect, useMemo } from 'react';
import { Workbook } from '@fileverse-dev/fortune-react';
import { Cell } from '@fileverse-dev/fortune-react';

import {
  DEFAULT_SHEET_DATA,
  TOOL_BAR_ITEMS,
  CELL_CONTEXT_MENU_ITEMS,
  HEADER_CONTEXT_MENU_ITEMS,
} from '../constants/shared-constants';
import { getCustomToolbarItems } from '../utils/custom-toolbar-item';
import { useEditor } from '../contexts/editor-context';
import { afterUpdateCell } from '../utils/after-update-cell';
import { handleCSVUpload } from '../utils/csv-import';
import { handleExportToXLSX } from '../utils/xlsx-export';
import { handleExportToCSV } from '../utils/csv-export';
import { handleExportToJSON } from '../utils/json-export';
import { useXLSXImport } from '../hooks/use-xlsx-import';
import { useRefreshDenomination } from '../hooks/useRefreshDenomination';
import { OnboardingHandlerType, DataBlockApiKeyHandlerType } from '../types';

// Use the types defined in types.ts
type OnboardingHandler = OnboardingHandlerType;
type DataBlockApiKeyHandler = DataBlockApiKeyHandlerType;

interface EditorWorkbookProps {
  setShowFetchURLModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setFetchingURLData?: (fetching: boolean) => void;
  setInputFetchURLDataBlock?: React.Dispatch<React.SetStateAction<string>>;
  isReadOnly?: boolean;
  allowComments?: boolean;
  toggleTemplateSidebar?: () => void;
  onboardingComplete?: boolean;
  onboardingHandler?: OnboardingHandler;
  dataBlockApiKeyHandler?: DataBlockApiKeyHandler;
  exportDropdownOpen?: boolean;
  // eslint-disable-next-line @typescript-eslint/ban-types
  commentData?: Object;
  getCommentCellUI?: (row: number, column: number) => void;
  setExportDropdownOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  dsheetId: string;
  storeApiKey?: (apiKeyName: string) => void;
  onDataBlockApiResponse?: (dataBlockName: string) => void;
  onDuneChartEmbed?: () => void;
  onSheetCountChange?: (sheetCount: number) => void;
}

/**
 * EditorWorkbook component handles rendering the Fortune Workbook with proper configuration
 */
export const EditorWorkbook: React.FC<EditorWorkbookProps> = ({
  setInputFetchURLDataBlock,
  setShowFetchURLModal,
  setFetchingURLData,
  isReadOnly = false,
  allowComments = false,
  toggleTemplateSidebar,
  onboardingComplete,
  onboardingHandler,
  dataBlockApiKeyHandler,
  exportDropdownOpen = false,
  commentData,
  getCommentCellUI,
  setExportDropdownOpen = () => {},
  dsheetId,
  storeApiKey,
  onDataBlockApiResponse,
  onDuneChartEmbed,
  onSheetCountChange,
}) => {
  const {
    sheetEditorRef,
    ydocRef,
    currentDataRef,
    handleChange,
    forceSheetRender,
    setForceSheetRender,
    syncStatus,
    dataBlockCalcFunction,
    setDataBlockCalcFunction,
    isAuthorized,
  } = useEditor();

  useEffect(() => {
    // @ts-ignore
    window.editorRef = sheetEditorRef.current;
    // @ts-ignore
    window.ydocRef = ydocRef.current;
  }, [isReadOnly]);

  // Initialize XLSX import functionality
  const { handleXLSXUpload } = useXLSXImport({
    sheetEditorRef,
    ydocRef,
    setForceSheetRender,
    dsheetId,
    currentDataRef,
  });

  const cellContextMenu = isReadOnly
    ? allowComments
      ? ['comment']
      : []
    : CELL_CONTEXT_MENU_ITEMS;
  const headerContextMenu = isReadOnly ? ['filter'] : HEADER_CONTEXT_MENU_ITEMS;
  const toolbarItems = isReadOnly
    ? allowComments
      ? ['filter', 'comment']
      : ['filter']
    : TOOL_BAR_ITEMS;

  const { refreshDenomination } = useRefreshDenomination({ sheetEditorRef });

  // Memoized workbook component to avoid unnecessary re-renders
  return useMemo(() => {
    // Create a unique key to force re-render when needed
    const workbookKey = `workbook-${dsheetId}-${forceSheetRender}`;

    // Use actual data if available, otherwise fallback to default data only in edit mode
    const data =
      currentDataRef.current && currentDataRef.current.length > 0
        ? currentDataRef.current
        : isReadOnly
          ? []
          : DEFAULT_SHEET_DATA;

    return (
      // @ts-ignore
      <Workbook
        isFlvReadOnly={isReadOnly}
        isAuthorized={isAuthorized}
        key={workbookKey}
        ref={sheetEditorRef}
        data={data}
        toolbarItems={toolbarItems}
        cellContextMenu={cellContextMenu}
        headerContextMenu={headerContextMenu}
        //@ts-ignore
        getCommentCellUI={getCommentCellUI}
        onChange={handleChange}
        showFormulaBar={true}
        showToolbar={true}
        lang={'en'}
        rowHeaderWidth={60}
        columnHeaderHeight={24}
        defaultColWidth={100}
        defaultRowHeight={21}
        customToolbarItems={
          !isReadOnly
            ? getCustomToolbarItems({
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
                setShowFetchURLModal,
              })
            : []
        }
        hooks={{
          afterActivateSheet: () => {
            if (
              sheetEditorRef.current &&
              sheetEditorRef.current?.getAllSheets().length > 0
            ) {
              refreshDenomination();
            }
          },
          afterUpdateCell: (
            row: number,
            column: number,
            _oldValue: Cell,
            newValue: Cell,
          ): void => {
            const refObj = { current: sheetEditorRef.current };
            afterUpdateCell({
              oldValue: _oldValue,
              row,
              column,
              newValue,
              sheetEditorRef: refObj,
              onboardingComplete,
              // @ts-ignore
              setFetchingURLData,
              onboardingHandler,
              dataBlockApiKeyHandler,
              storeApiKey,
              setInputFetchURLDataBlock,
              onDataBlockApiResponse,
              setDataBlockCalcFunction,
              dataBlockCalcFunction,
            });
          },
        }}
        onDuneChartEmbed={onDuneChartEmbed}
        onSheetCountChange={onSheetCountChange}
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
    commentData,
    syncStatus,
    currentDataRef.current,
    isAuthorized,
  ]);
};
