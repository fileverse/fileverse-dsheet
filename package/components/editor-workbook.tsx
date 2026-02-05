/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { ComponentProps, useEffect, useMemo } from 'react';
import { Workbook } from '@fileverse-dev/fortune-react';
import { Cell } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';


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

import { useRefreshDenomination } from '../hooks/use-refresh-denomination';
import { OnboardingHandlerType, DataBlockApiKeyHandlerType } from '../types';

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

  // useEffect(() => {
  //   dataBlockListYdocUpdate({
  //     sheetEditorRef,
  //     ydocRef,
  //     dsheetId,
  //     dataBlockCalcFunction
  //   })
  // }, [dataBlockCalcFunction]);

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
  console.log('refreshDenomination', refreshDenomination);
  const {
    handleOnChangePortalUpdate
  } = useEditor();

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

    console.log('data vvvvvvv', data);

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
          // afterActivateSheet: () => {
          //   if (
          //     sheetEditorRef.current &&
          //     sheetEditorRef.current?.getAllSheets().length > 0
          //   ) {
          //     refreshDenomination();
          //   }
          // },
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
          sheetLengthChange: () => {
            const sheetArray = ydocRef.current?.getArray<Y.Map<any>>(dsheetId);

            const sheets = sheetEditorRef.current?.getAllSheets();
            const docSheetLength = sheetArray?.toArray()?.length || 1;
            const editorSheetLength = sheets?.length || 1;

            if (docSheetLength < editorSheetLength && editorSheetLength > 1 && docSheetLength > 0) {
              // @ts-ignore
              currentDataRef.current = sheetEditorRef.current?.getAllSheets();

              setTimeout(() => {

                const createdSheet = sheets?.[sheets.length - 1];
                const sheet = { ...createdSheet };
                const sheetArray = ydocRef.current?.getArray<Y.Map<any>>(dsheetId);
                const ySheet = new Y.Map<any>();

                ySheet.set('id', sheet?.id);
                ySheet.set('name', sheet?.name);
                ySheet.set('order', sheet?.order);
                ySheet.set('row', sheet?.row ?? 500);
                ySheet.set('column', sheet?.column ?? 36);
                ySheet.set('status', 1);
                ySheet.set('config', sheet?.config ?? {});
                ySheet.set('celldata', new Y.Map());
                ySheet.set('calcChain', new Y.Map());
                ySheet.set('dataBlockCalcFunction', new Y.Array());

                ydocRef?.current?.transact(() => {
                  sheetArray?.push([ySheet]);
                });

                sheetEditorRef.current?.activateSheet({
                  id: sheets?.[sheets.length - 1]?.id
                });

              }, 50);
              setTimeout(() => {
                sheetEditorRef.current?.activateSheet({
                  id: sheets?.[sheets.length - 1]?.id
                });
              }, 80)
            }

          },
          afterDeleteSheet(id) {
            const sheetArray = ydocRef.current?.getArray<Y.Map<any>>(dsheetId);
            const index = sheetArray?.toArray()
              .findIndex((s) => s.get('id') === id);

            if (index === -1) return false;

            ydocRef?.current?.transact(() => {
              sheetArray?.delete(index as number, 1);
            });

            //const sheetArray = ydocRef.current?.getArray<Y.Map>(dsheetId);
          },
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
            console.log('updateCellYdoc changes from fortune', changes);
            updateYdocSheetData(
              ydocRef.current,
              dsheetId,
              changes,
              handleOnChangePortalUpdate
            )
          },
          afterImagesChange: () => {
            const currentSheet = sheetEditorRef?.current?.getSheet()
            let oldSheets = ydocRef?.current?.getArray(dsheetId);
            const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
            const ydocImage = currentYdocSheet?.get('images');
            if (ydocImage !== currentSheet?.images) {
              currentYdocSheet?.set('images', currentSheet?.images);
              // @ts-ignore
              handleOnChangePortalUpdate(oldSheets?.toArray());
            }

          },
          afterIframesChange: () => {
            const currentSheet = sheetEditorRef?.current?.getSheet()
            let oldSheets = ydocRef?.current?.getArray(dsheetId);
            const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
            const ydocIframe = currentYdocSheet?.get('iframes');
            if (ydocIframe !== currentSheet?.iframes) {
              currentYdocSheet?.set('iframes', currentSheet?.iframes);
              // @ts-ignore
              handleOnChangePortalUpdate(oldSheets?.toArray());
            }
          },
          afterFrozenChange: () => {
            const currentSheet = sheetEditorRef?.current?.getSheet()
            let oldSheets = ydocRef?.current?.getArray(dsheetId);
            const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
            const ydocFrozen = currentYdocSheet?.get('frozen');
            if (ydocFrozen !== currentSheet?.frozen) {
              currentYdocSheet?.set('frozen', currentSheet?.frozen);
              // @ts-ignore
              handleOnChangePortalUpdate(oldSheets?.toArray());
            }
          },
          afterNameChanges: () => {
            const currentSheet = sheetEditorRef?.current?.getSheet()
            let oldSheets = ydocRef?.current?.getArray(dsheetId);
            const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
            const ydocName = currentYdocSheet?.get('name');
            if (ydocName !== currentSheet?.name) {
              currentYdocSheet?.set('name', currentSheet?.name);
              // @ts-ignore
              handleOnChangePortalUpdate(oldSheets?.toArray());
            }
          },
          afterOrderChanges: () => {
            const allSheets = sheetEditorRef?.current?.getAllSheets();
            let oldSheets = ydocRef?.current?.getArray(dsheetId);
            allSheets?.forEach((sheet) => {
              const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === sheet?.id) as any;
              const ydocOrder = currentYdocSheet?.get('order');
              if (ydocOrder !== sheet?.order) {
                currentYdocSheet?.set('order', sheet?.order);
                // @ts-ignore
                handleOnChangePortalUpdate(oldSheets?.toArray());
              }
            })
          },
          afterConfigChanges: () => {
            const currentSheet = sheetEditorRef?.current?.getSheet()
            let oldSheets = ydocRef?.current?.getArray(dsheetId);
            const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
            const ydocConfig = currentYdocSheet?.get('config');
            if (ydocConfig !== currentSheet?.config) {
              currentYdocSheet?.set('config', currentSheet?.config);
              // @ts-ignore
              handleOnChangePortalUpdate(oldSheets?.toArray());
            }
          },
          afterColRowChanges: () => {
            const currentSheet = sheetEditorRef?.current?.getSheet()
            let oldSheets = ydocRef?.current?.getArray(dsheetId);
            const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
            const ydocCol = currentYdocSheet?.get('column');
            const ydocRow = currentYdocSheet?.get('row');
            if (ydocCol !== currentSheet?.column || ydocRow !== currentSheet?.row) {
              currentYdocSheet?.set('column', currentSheet?.column);
              currentYdocSheet?.set('row', currentSheet?.row);
              // @ts-ignore
              handleOnChangePortalUpdate(oldSheets?.toArray());
            }
          },
          afterShowGridLinesChange: () => {
            const currentSheet = sheetEditorRef?.current?.getSheet()
            let oldSheets = ydocRef?.current?.getArray(dsheetId);
            const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
            const ydocShowGridLines = currentYdocSheet?.get('showGridLines');
            if (ydocShowGridLines !== currentSheet?.showGridLines) {
              currentYdocSheet?.set('showGridLines', currentSheet?.showGridLines);
              // @ts-ignore
              handleOnChangePortalUpdate(oldSheets?.toArray());
            }
          }
        }}
        onDuneChartEmbed={onDuneChartEmbed}
        onSheetCountChange={onSheetCountChange}
      />
    );
  }, [
    forceSheetRender,
    isReadOnly,
    // handleChange,
    toggleTemplateSidebar,
    onboardingComplete,
    onboardingHandler,
    dataBlockApiKeyHandler,
    dsheetId,
    exportDropdownOpen,
    commentData,
    syncStatus,
    // currentDataRef.current,
    isAuthorized,
  ]);
};
