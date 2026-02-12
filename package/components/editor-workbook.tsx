/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { ComponentProps, useEffect, useMemo } from 'react';
import { Workbook } from '@fileverse-dev/fortune-react';
import { Cell } from '@fileverse-dev/fortune-react';
import {
  TOOL_BAR_ITEMS,
  CELL_CONTEXT_MENU_ITEMS,
  HEADER_CONTEXT_MENU_ITEMS,
  DEFAULT_SHEET_DATA,
} from '../constants/shared-constants';
import { getCustomToolbarItems } from '../utils/custom-toolbar-item';
import { useEditor } from '../contexts/editor-context';
import {
  afterUpdateCell,
  SmartContractQueryHandler,
} from '../utils/after-update-cell';
import { dataVerificationYdocUpdate } from '../utils/data-verification-ydoc-update';
import { liveQueryListYdocUpdate } from '../utils/live-query-list-ydoc-update';
import { calcChainYdocUpdate } from '../utils/calc-chain-ydoc-update';
import { conditionFormatYdocUpdate } from '../utils/condition-format-ydoc-update';
import { dataBlockListYdocUpdate } from '../utils/data-block-list-ydoc-update';
import { hyperlinkYdocUpdate } from '../utils/hyperlink-ydoc-update';
import { updateYdocSheetData, SheetChangePath } from '../utils/update-ydoc';
import { handleCSVUpload } from '../utils/csv-import';
import { handleExportToXLSX } from '../utils/xlsx-export';
import { handleExportToCSV } from '../utils/csv-export';
import { handleExportToJSON } from '../utils/json-export';
import { useXLSXImport } from '../hooks/use-xlsx-import';
import { usehandleHomepageRedirect } from '../hooks/use-homepage-redirect';
import { OnboardingHandlerType, DataBlockApiKeyHandlerType } from '../types';
import {
  createAfterColRowChangesHandler,
  createAfterOrderChangesHandler,
  createSheetLengthChangeHandler,
  syncCurrentSheetField,
} from './editor-workbook-sync';

// Use the types defined in types.ts
type OnboardingHandler = OnboardingHandlerType;
type DataBlockApiKeyHandler = DataBlockApiKeyHandlerType;

interface EditorWorkbookProps {
  setShowSmartContractModal?: React.Dispatch<React.SetStateAction<boolean>>;
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
  getCommentCellUI?: ComponentProps<typeof Workbook>['getCommentCellUI'];
  setExportDropdownOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  dsheetId: string;
  storeApiKey?: (apiKeyName: string) => void;
  onDataBlockApiResponse?: (dataBlockName: string) => void;
  onDuneChartEmbed?: () => void;
  onSheetCountChange?: (sheetCount: number) => void;
  handleSmartContractQuery?: SmartContractQueryHandler;
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
  setExportDropdownOpen = () => { },
  dsheetId,
  storeApiKey,
  onDataBlockApiResponse,
  onDuneChartEmbed,
  onSheetCountChange,
  handleSmartContractQuery,
}) => {
  const {
    setSelectedTemplate,
    setShowSmartContractModal,
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
    getDocumentTitle,
    updateDocumentTitle,
    handleLiveQuery,
  } = useEditor();

  useEffect(() => {
    // @ts-ignore
    window.editorRef = sheetEditorRef.current;
    // @ts-ignore
    window.ydocRef = ydocRef.current;
    // @ts-ignore move this to firward ref
    window.setForceRenderEditor = setForceSheetRender;
    // @ts-ignore
    window.currentDataRef = currentDataRef;
  }, [isReadOnly]);

  // Initialize XLSX import functionality
  const { handleXLSXUpload } = useXLSXImport({
    sheetEditorRef,
    ydocRef,
    setForceSheetRender,
    dsheetId,
    currentDataRef,
    updateDocumentTitle,
  });

  usehandleHomepageRedirect({
    setSelectedTemplate,
    handleXLSXUpload,
    handleCSVUpload,
    ydocRef,
    dsheetId,
    currentDataRef,
    setForceSheetRender,
    sheetEditorRef,
    updateDocumentTitle,
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

  const {
    handleOnChangePortalUpdate
  } = useEditor();

  const syncContext = {
    sheetEditorRef,
    ydocRef,
    dsheetId,
    handleOnChangePortalUpdate,
  };
  const handleSheetLengthChange = createSheetLengthChangeHandler({
    ...syncContext,
    currentDataRef,
  });
  const handleAfterOrderChanges = createAfterOrderChangesHandler(syncContext);
  const handleAfterColRowChanges = createAfterColRowChangesHandler(syncContext);

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
        // @ts-ignore
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
        defaultColWidth={104}
        defaultRowHeight={23}
        customToolbarItems={
          !isReadOnly
            ? getCustomToolbarItems({
              handleContentPortal: handleOnChangePortalUpdate,
              setShowSmartContractModal,
              getDocumentTitle,
              updateDocumentTitle,
              setExportDropdownOpen,
              handleCSVUpload,
              // @ts-ignore
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
          afterUpdateCell: (
            row: number,
            column: number,
            _oldValue: Cell,
            newValue: Cell,
          ): void => {
            const refObj = { current: sheetEditorRef.current };
            afterUpdateCell({
              handleContentPortal: handleOnChangePortalUpdate,
              dsheetId,
              ydocRef,
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
              handleSmartContractQuery,
              handleLiveQueryData: handleLiveQuery,
            });
          },
          // @ts-ignore Fortune Hooks type misses this runtime hook.
          sheetLengthChange: handleSheetLengthChange,
          dataVerificationChange: () => {
            dataVerificationYdocUpdate({
              sheetEditorRef,
              ydocRef,
              dsheetId,
              handleContentPortal: handleOnChangePortalUpdate
            })
          },
          liveQueryChange: () => {
            liveQueryListYdocUpdate({
              sheetEditorRef,
              ydocRef,
              dsheetId,
              handleContentPortal: handleOnChangePortalUpdate
            })
          },
          calcChainChange: () => {
            calcChainYdocUpdate({
              sheetEditorRef,
              ydocRef,
              dsheetId,
              handleContentPortal: handleOnChangePortalUpdate
            })
            dataBlockListYdocUpdate({
              sheetEditorRef,
              ydocRef,
              dsheetId,
              dataBlockCalcFunction
            })
          },
          conditionFormatChange: () => {
            conditionFormatYdocUpdate({
              sheetEditorRef,
              ydocRef,
              dsheetId,
              handleContentPortal: handleOnChangePortalUpdate
            })
          },
          hyperlinkChange: () => {
            hyperlinkYdocUpdate({
              sheetEditorRef,
              ydocRef,
              dsheetId,
              handleContentPortal: handleOnChangePortalUpdate
            })
          },
          updateCellYdoc: (changes: SheetChangePath[]) => {
            updateYdocSheetData(
              ydocRef.current,
              dsheetId,
              changes,
              handleOnChangePortalUpdate
            )
          },
          afterImagesChange: () => {
            syncCurrentSheetField(syncContext, 'images');
          },
          afterIframesChange: () => {
            syncCurrentSheetField(syncContext, 'iframes');
          },
          afterFrozenChange: () => {
            syncCurrentSheetField(syncContext, 'frozen');
          },
          afterNameChanges: () => {
            syncCurrentSheetField(syncContext, 'name');
          },
          afterOrderChanges: handleAfterOrderChanges,
          afterConfigChanges: () => {
            syncCurrentSheetField(syncContext, 'config');
          },
          afterColRowChanges: handleAfterColRowChanges,
          afterShowGridLinesChange: () => {
            syncCurrentSheetField(syncContext, 'showGridLines');
          }
        }}
        onDuneChartEmbed={onDuneChartEmbed}
        onSheetCountChange={onSheetCountChange}
      />
    );
  }, [
    forceSheetRender,
    isReadOnly,
    toggleTemplateSidebar,
    onboardingComplete,
    onboardingHandler,
    dataBlockApiKeyHandler,
    dsheetId,
    exportDropdownOpen,
    commentData,
    syncStatus,
    isAuthorized,
  ]);
};
