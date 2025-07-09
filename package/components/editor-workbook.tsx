/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useEffect, useMemo, useRef } from 'react';
import { Workbook } from '@fileverse-dev/fortune-react';
import { Cell } from '@fileverse-dev/fortune-core';

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
  setExportDropdownOpen = () => { },
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

  const cryptoPriceRef = useRef({});
  const intervalRef = useRef(null);

  const fetchPrice = async () => {
    // const ETH = await sheetEditorRef.current?.getCryptoPrice('ethereum', 'usd');
    // const BTC = await sheetEditorRef.current?.getCryptoPrice('bitcoin', 'usd');
    // const SOL = await sheetEditorRef.current?.getCryptoPrice('solana', 'usd');

    const cryptoPrices = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd', {
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': 'CG-uwNr6AVqHrfcvCw84RUN4fb8',
      }
    });
    const cryptoData = await cryptoPrices.json();
    const ETH = cryptoData.ethereum.usd;
    const BTC = cryptoData.bitcoin.usd;
    const SOL = cryptoData.solana.usd;

    cryptoPriceRef.current = {
      ETH,
      BTC,
      SOL
    }

    refreshDenomination();

  }

  const refreshDenomination = () => {
    if (!cryptoPriceRef.current.BTC) return;
    const currentData = sheetEditorRef.current?.getSheet();
    console.log("currentData", currentData);
    const cellData = currentData.celldata;

    for (let i = 0; i < cellData.length; i++) {
      const cell = { ...cellData[i] } as any; cellData[i];

      cell.v = typeof cell.v === 'string' ? cell.v : { ...cellData[i].v };

      const value = cell.v.m?.toString();
      if (value?.includes("BTC")) {
        const decemialCount = cell.v.m.includes('.') ? cell.v.m.split(' ')[0].split('.')[1].length : 0;
        console.log("BTC", cell.baseValue, cryptoPriceRef.current.BTC, cell.v.m.toString(), decemialCount, cell.v.m.split(' ')[0].split('.')[1].length);
        cell.v.m = value.replace(/\d+(\.\d+)?/, (cell.v.baseValue / cryptoPriceRef.current.BTC).toFixed(decemialCount).toString());
      } else if (value?.includes("ETH")) {
        cell.v.m = value.replace(/\d+(\.\d+)?/, (cell.v.baseValue / cryptoPriceRef.current.ETH).toString());
      } else if (value?.includes("SOL")) {
        cell.v.m = value.replace(/\d+(\.\d+)?/, (cell.v.baseValue / cryptoPriceRef.current.SOL).toString());
      }

      console.log("cell", cell);
      sheetEditorRef.current?.setCellValue(cell.r, cell.c, cell.v);

    }
  }

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchPrice();
      console.log("hahahah", cryptoPriceRef.current);

    }, 24000);

    return () => {
      clearInterval(intervalRef.current);
    };

  }, []);

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
            console.log('afterActivateSheet', currentDataRef.current, sheetEditorRef.current?.getAllSheets());
            if (sheetEditorRef.current?.getAllSheets().length > 0) {
              console.log('afterActivateSheet ==', sheetEditorRef.current?.getSheet());
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
