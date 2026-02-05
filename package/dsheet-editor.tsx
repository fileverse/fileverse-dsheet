import React, { ComponentProps, useEffect, useState } from 'react';
import cn from 'classnames';
import * as Y from 'yjs';
// import { Sheet } from '@fileverse-dev/fortune-react';
// import { fromUint8Array } from 'js-base64';
import { DEFAULT_SHEET_DATA } from './constants/shared-constants';
import { useFortuneDocumentStyle } from './hooks/use-document-style';
import {
  DsheetProps,
  EditorValues,
  OnboardingHandlerType,
  DataBlockApiKeyHandlerType,
} from './types';
import SkeletonLoader from './components/skeleton-loader';
import { EditorProvider, useEditor } from './contexts/editor-context';
import { EditorWorkbook } from './components/editor-workbook';
import { useApplyTemplatesBtn } from './hooks/use-apply-templates';
import { TransitionWrapper } from './components/transition-wrapper';
import { PermissionChip } from './components/permission-chip';
// import { FLVURL } from '@fileverse-dev/formulajs';
// import { formulaResponseUiSync } from './utils/formula-ui-sync';

// import { Button, TextField, LucideIcon, Toggle } from '@fileverse/ui';

import '@fileverse-dev/fortune-react/lib/index.css';
import './styles/index.css';
import { SmartContractQueryHandler } from './utils/after-update-cell';
import {
  updateYdocSheetData,
  //  ySheetArrayToPlain 
} from './utils/update-ydoc';
import { Workbook } from '@fileverse-dev/fortune-react';

// Use the types defined in types.ts
type OnboardingHandler = OnboardingHandlerType;
type DataBlockApiKeyHandler = DataBlockApiKeyHandlerType;

/**
 * EditorContent - Internal component that renders the editor content
 * Uses the context to access state and renders appropriate UI
 */
const EditorContent = ({
  setShowFetchURLModal,
  renderNavbar,
  isReadOnly,
  allowComments,
  toggleTemplateSidebar,
  onboardingComplete,
  onboardingHandler,
  dataBlockApiKeyHandler,
  isTemplateOpen,
  exportDropdownOpen,
  setExportDropdownOpen,
  dsheetId,
  commentData,
  getCommentCellUI,
  selectedTemplate,
  setFetchingURLData,
  setInputFetchURLDataBlock,
  storeApiKey,
  onDataBlockApiResponse,
  onDuneChartEmbed,
  onSheetCountChange,
  handleSmartContractQuery,
  isNewSheet,
}: Pick<
  DsheetProps,
  | 'renderNavbar'
  | 'isReadOnly'
  | 'allowComments'
  | 'toggleTemplateSidebar'
  | 'selectedTemplate'
  | 'dsheetId'
  | 'setFetchingURLData'
  | 'setShowFetchURLModal'
  | 'setInputFetchURLDataBlock'
  | 'storeApiKey'
  | 'isNewSheet'
> & {
  commentData?: object;
  getCommentCellUI?: ComponentProps<typeof Workbook>['getCommentCellUI'];
  isTemplateOpen?: boolean;
  exportDropdownOpen: boolean;
  setExportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onboardingComplete?: boolean;
  onboardingHandler?: OnboardingHandler;
  dataBlockApiKeyHandler?: DataBlockApiKeyHandler;
  storeApiKey?: (apiKeyName: string) => void;
  onDataBlockApiResponse?: (dataBlockName: string) => void;
  onDuneChartEmbed?: () => void;
  onSheetCountChange?: (sheetCount: number) => void;
  handleSmartContractQuery?: SmartContractQueryHandler;
}) => {
  const {
    loading,
    sheetEditorRef,
    currentDataRef,
    ydocRef,
    setForceSheetRender,
    setDataBlockCalcFunction,
    initialiseLiveQueryData,
    handleOnChangePortalUpdate
  } = useEditor();

  // Initialize template button functionality
  useApplyTemplatesBtn({
    selectedTemplate,
    ydocRef,
    dsheetId,
    currentDataRef,
    setForceSheetRender,
    sheetEditorRef,
    setDataBlockCalcFunction,
    initialiseLiveQueryData,
  });

  // Apply custom styling based on dropdown and template states
  useFortuneDocumentStyle({
    exportDropdownOpen,
    isTemplateOpen,
    isReadOnly,
    loading,
  });

  // Create editor values to pass to the navbar
  const editorValues: EditorValues = {
    sheetEditorRef,
    currentDataRef,
    ydocRef,
  };
  const shouldRenderSheet = currentDataRef.current.length > 0 || isNewSheet;

  const cellArrayToYMap = (celldata: any[] = []) => {
    const yCellMap = new Y.Map();

    celldata.forEach((cell) => {
      yCellMap.set(`${cell.r}_${cell.c}`, cell);
    });

    return yCellMap;
  };

  const plainSheetToYMap = (sheet: any, index = 0) => {
    const ySheet = new Y.Map();

    ySheet.set('id', sheet.id ?? crypto.randomUUID());
    ySheet.set('name', sheet.name ?? `Sheet${index + 1}`);
    ySheet.set('order', sheet.order ?? index);
    ySheet.set('row', sheet.row ?? 500);
    ySheet.set('column', sheet.column ?? 36);
    ySheet.set('status', sheet.status ?? (index === 0 ? 1 : 0));
    ySheet.set('config', sheet.config ?? {});
    ySheet.set('celldata', cellArrayToYMap(sheet.celldata ?? []));
    ySheet.set('calcChain', cellArrayToYMap(sheet.calcChain ?? []));
    ySheet.set('dataBlockCalcFunction', sheet.dataBlockCalcFunction ?? {});
    const yDataBlockList = new Y.Map();
    ySheet.set('dataBlockCalcFunction', yDataBlockList);
    const yLiveQueryList = new Y.Map();
    ySheet.set('liveQueryList', yLiveQueryList);
    const dataVerification = new Y.Map();
    ySheet.set('dataVerification', dataVerification);
    const conditionRules = new Y.Map();
    ySheet.set('conditionRules', conditionRules);

    const luckysheet_conditionformat_save = new Y.Array();
    ySheet.set('luckysheet_conditionformat_save', luckysheet_conditionformat_save);


    return ySheet;
  };

  useEffect(() => {
    // console.log('is new shouldRenderSheet kkuu', shouldRenderSheet, isNewSheet, ydocRef.current, sheetEditorRef);
    if (isNewSheet) {
      ydocRef.current?.transact(() => {
        const sheetArray =
          ydocRef.current?.getArray(dsheetId);
        //@ts-ignore
        // console.log('sheetArray length init', ySheetArrayToPlain(sheetArray));
        // console.log('sheetArray length init', sheetArray?.toArray().length, ydocRef.current);
        const sData: any = []
        if (sheetArray?.toArray().length === 0 && ydocRef.current) {
          DEFAULT_SHEET_DATA.forEach((sheet, index) => {
            // console.log('sheet getting inti', sheet);
            const id = crypto.randomUUID();
            sheet = {
              ...sheet,
              id,
            }
            sheetArray?.insert(0, [
              plainSheetToYMap(sheet, index),
            ]);
            sData.push(sheet);
          });
          //@ts-ignore
          currentDataRef.current = sData;
          const currentSheetId = sheetEditorRef.current?.getWorkbookContext()
            ?.currentSheetId as string;

          updateYdocSheetData(
            ydocRef.current,
            dsheetId,
            [{
              sheetId: currentSheetId, path: ['celldata'], value: {
                r: 0,
                c: 0,
                v: {
                  "ct": {
                    "fa": "General",
                    "t": "g"
                  },
                  "v": "",
                  "tb": "1",
                  "m": ""
                },
              }, key: '0' + '_' + '0',
              type: 'update',
            }],
            handleOnChangePortalUpdate
          )
        }
      });
    }
  }, [isNewSheet, shouldRenderSheet, loading]);

  return (
    <div
      style={{ height: 'calc(100vh)' }}
      className={isReadOnly ? 'fortune-read-only' : ''}
    >
      {renderNavbar && (
        <nav
          id="Navbar"
          className={cn(
            `h-[44px] color-bg-default px-4 flex gap-2 items-center
             justify-between w-screen fixed left-0 top-0 border-b
             color-border-default z-10 transition-transform duration-300`,
            {
              'translate-y-0': true,
              'translate-y-[-100%]': false,
            },
          )}
        >
          {renderNavbar(editorValues)}
        </nav>
      )}

      <div className="relative overflow-hidden h-[94dvh] md:!h-[calc(100vh-44px)] mt-[44px]">
        <TransitionWrapper show={true}>
          <SkeletonLoader isReadOnly={isReadOnly} />
        </TransitionWrapper>

        <TransitionWrapper show={!loading && shouldRenderSheet} duration={1000}>
          {/* Permission chip - only visible with real content */}
          {isReadOnly && (
            <div className="absolute top-2 right-4 z-20">
              <PermissionChip allowComments={allowComments || false} />
            </div>
          )}

          <EditorWorkbook
            setShowFetchURLModal={setShowFetchURLModal}
            setFetchingURLData={setFetchingURLData}
            setInputFetchURLDataBlock={setInputFetchURLDataBlock}
            commentData={commentData}
            getCommentCellUI={getCommentCellUI}
            isReadOnly={isReadOnly}
            toggleTemplateSidebar={toggleTemplateSidebar}
            onboardingComplete={onboardingComplete}
            onboardingHandler={onboardingHandler}
            dataBlockApiKeyHandler={dataBlockApiKeyHandler}
            exportDropdownOpen={exportDropdownOpen}
            setExportDropdownOpen={setExportDropdownOpen}
            dsheetId={dsheetId}
            storeApiKey={storeApiKey}
            allowComments={allowComments}
            onDataBlockApiResponse={onDataBlockApiResponse}
            onDuneChartEmbed={onDuneChartEmbed}
            onSheetCountChange={onSheetCountChange}
            handleSmartContractQuery={handleSmartContractQuery}
          />
        </TransitionWrapper>
      </div>
    </div>
  );
};

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
  allowComments = false,
  renderNavbar,
  enableIndexeddbSync,
  dsheetId = '',
  portalContent,
  onChange,
  username,
  selectedTemplate,
  toggleTemplateSidebar,
  isTemplateOpen,
  enableWebrtc,
  onboardingComplete,
  onboardingHandler,
  commentData,
  getCommentCellUI,
  dataBlockApiKeyHandler,
  setFetchingURLData,
  setShowFetchURLModal,
  setInputFetchURLDataBlock,
  sheetEditorRef: externalSheetEditorRef,
  storeApiKey,
  onDuneChartEmbed,
  onSheetCountChange,
  onDataBlockApiResponse,
  isAuthorized,
  getDocumentTitle,
  updateDocumentTitle,
  setShowSmartContractModal,
  editorStateRef,
  handleSmartContractQuery,
  setSelectedTemplate,
  isNewSheet,
  liveQueryRefreshRate,
  enableLiveQuery,
}: DsheetProps): JSX.Element => {
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);

  return (
    <EditorProvider
      setSelectedTemplate={setSelectedTemplate}
      setShowSmartContractModal={setShowSmartContractModal}
      getDocumentTitle={getDocumentTitle}
      updateDocumentTitle={updateDocumentTitle}
      dsheetId={dsheetId}
      username={username}
      portalContent={portalContent}
      enableIndexeddbSync={enableIndexeddbSync}
      enableWebrtc={enableWebrtc}
      isReadOnly={isReadOnly}
      allowComments={allowComments}
      onChange={onChange}
      externalEditorRef={externalSheetEditorRef}
      isCollaborative={isCollaborative}
      commentData={commentData}
      isAuthorized={isAuthorized}
      editorStateRef={editorStateRef}
      liveQueryRefreshRate={liveQueryRefreshRate}
      enableLiveQuery={enableLiveQuery}
      dataBlockApiKeyHandler={dataBlockApiKeyHandler}
    >
      <EditorContent
        commentData={commentData}
        getCommentCellUI={getCommentCellUI}
        renderNavbar={renderNavbar}
        setFetchingURLData={setFetchingURLData}
        isNewSheet={isNewSheet}
        setShowFetchURLModal={setShowFetchURLModal}
        setInputFetchURLDataBlock={setInputFetchURLDataBlock}
        isReadOnly={isReadOnly}
        toggleTemplateSidebar={toggleTemplateSidebar}
        onboardingComplete={onboardingComplete}
        onboardingHandler={onboardingHandler as OnboardingHandler}
        dataBlockApiKeyHandler={
          dataBlockApiKeyHandler as DataBlockApiKeyHandler
        }
        isTemplateOpen={isTemplateOpen}
        exportDropdownOpen={exportDropdownOpen}
        setExportDropdownOpen={setExportDropdownOpen}
        dsheetId={dsheetId}
        selectedTemplate={selectedTemplate}
        storeApiKey={storeApiKey}
        allowComments={allowComments}
        onDuneChartEmbed={onDuneChartEmbed}
        onSheetCountChange={onSheetCountChange}
        onDataBlockApiResponse={onDataBlockApiResponse}
        handleSmartContractQuery={handleSmartContractQuery}
      />
    </EditorProvider>
  );
};

export default SpreadsheetEditor;
