import React, { ComponentProps, useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import * as Y from 'yjs';
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
import '@sheet-engine/react/index.css';
import './styles/index.css';
import { SmartContractQueryHandler } from './utils/after-update-cell';
import { Workbook } from '@sheet-engine/react';
import { useSidebar } from './components/sidebar/sidebar-context';
import { EditorRightSidebar } from './components/sidebar/editor-right-sidebar';
import { PanelConfig } from './types';
import { DataVerification } from './components/sidebars/data-verification';
import { ConditionalFormat } from './components/sidebars/conditional-format';
import { Templates } from './components/sidebars/templates';
import FunctionContent from './components/sidebars/function-content';
import { TemplatePreview, Template } from './components/sidebars/template-ui';
import { useMediaQuery } from 'usehooks-ts';

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
  allowSheetDownload,
  allowComments,
  toggleTemplateSidebar,
  onboardingComplete,
  onboardingCompleteLocalStorageKey,
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
  customPanels,
}: Pick<
  DsheetProps,
  | 'renderNavbar'
  | 'isReadOnly'
  | 'allowSheetDownload'
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
  onboardingCompleteLocalStorageKey?: string;
  onboardingHandler?: OnboardingHandler;
  dataBlockApiKeyHandler?: DataBlockApiKeyHandler;
  storeApiKey?: (apiKeyName: string) => void;
  onDataBlockApiResponse?: (dataBlockName: string) => void;
  onDuneChartEmbed?: () => void;
  onSheetCountChange?: (sheetCount: number) => void;
  handleSmartContractQuery?: SmartContractQueryHandler;
  customPanels?: PanelConfig[];
}) => {
  const {
    loading,
    syncStatus,
    collabEnabled,
    sheetEditorRef,
    currentDataRef,
    ydocRef,
    setForceSheetRender,
    setDataBlockCalcFunction,
    initialiseLiveQueryData,
    setSelectedTemplate: contextSetSelectedTemplate,
  } = useEditor();

  const { activePanel, isOpen, openPanel, closePanel, togglePanel } =
    useSidebar();

  // Stable reference so the memoized EditorWorkbook (and its toolbar) is not
  // rebuilt on every panel toggle.
  const openTemplatesPanel = useCallback(
    () => togglePanel('templates'),
    [togglePanel],
  );

  const [internalSelectedTemplate, setInternalSelectedTemplate] = useState<
    string | null
  >(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<Template | null>(null);
  const [shouldHandleSuggestionFromCell, setShouldHandleSuggestionFromCell] =
    useState(0);
  const isMobile = useMediaQuery('(max-width: 840px)', { defaultValue: false });

  const builtInPanels: PanelConfig[] = [
    {
      id: 'templates',
      header: {
        title: 'Templates',
        subtitle:
          'Start with pre-built templates. Includes smart contract analysis, real time coins price and much more for blockchain analytics',
      },
      width: '380px',
      content: (
        <Templates
          setSelectedTemplate={(slug) => setInternalSelectedTemplate(slug)}
          setHoveredTemplate={setHoveredTemplate}
        />
      ),
    },
    {
      id: 'data-verification',
      header: { title: 'Data Validation' },
      width: '380px',
      content: <DataVerification />,
    },
    {
      id: 'conditional-format',
      header: { title: 'Conditional Formatting' },
      width: '380px',
      content: <ConditionalFormat />,
    },
    {
      id: 'functions',
      header: { title: 'Function' },
      width: '380px',
      content: (
        <FunctionContent
          sheetEditorRef={sheetEditorRef}
          shouldHandleSuggestionFromCell={shouldHandleSuggestionFromCell}
        />
      ),
    },
  ];

  const allPanels: PanelConfig[] = [...builtInPanels, ...(customPanels ?? [])];

  const activePanelConfig = (() => {
    const panel = allPanels.find((p) => p.id === activePanel);
    if (!panel) return null;
    return {
      id: panel.id,
      width: panel.width ?? '380px',
      header: panel.header,
      content: panel.content,
    };
  })();

  // Initialize template button functionality
  useApplyTemplatesBtn({
    selectedTemplate: internalSelectedTemplate ?? selectedTemplate,
    setSelectedTemplate: (slug: string | null) => {
      setInternalSelectedTemplate(null);
      contextSetSelectedTemplate?.(slug as any);
    },
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
    openPanel,
    closePanel,
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
    ySheet.set(
      'luckysheet_conditionformat_save',
      luckysheet_conditionformat_save,
    );
    return ySheet;
  };

  useEffect(() => {
    if (!isNewSheet || !ydocRef.current || !dsheetId) return;

    // Collaboration + IndexedDB must hydrate before an empty ydoc means "brand new".
    if (collabEnabled) return;
    if (syncStatus !== 'synced') return;

    ydocRef.current.transact(() => {
      const sheetArray = ydocRef.current?.getArray(dsheetId);
      //@ts-ignore
      const sData: any = [];
      if (sheetArray?.toArray().length === 0 && ydocRef.current) {
        DEFAULT_SHEET_DATA.forEach((sheet, index) => {
          const id = crypto.randomUUID();
          sheet = {
            ...sheet,
            id,
          };
          sheetArray?.insert(0, [plainSheetToYMap(sheet, index)]);
          sData.push(sheet);
        });
        //@ts-ignore
        currentDataRef.current = sData;
      }
    });
  }, [
    isNewSheet,
    syncStatus,
    collabEnabled,
    dsheetId,
    ydocRef,
    currentDataRef,
  ]);

  return (
    <div
      style={{ height: 'calc(100vh)' }}
      className={cn('dsheet-editor', isReadOnly && 'fortune-read-only')}
      data-testid="dsheet-editor"
    >
      {/* Hidden DOM triggers — FortuneCore fires these by id via element.click() */}
      <button
        id="data-verification-button"
        className="hidden"
        onClick={() => togglePanel('data-verification')}
      />
      <button
        id="conditional-format-button"
        className="hidden"
        onClick={() => openPanel('conditional-format')}
      />
      <button
        id="smartcontract-button"
        className="hidden"
        onClick={() => openPanel('smart-contract-list-view')}
      />
      <button
        id="function-button"
        className="hidden"
        onClick={() => {
          openPanel('functions');
          setShouldHandleSuggestionFromCell((p) => p + 1);
        }}
      />

      {renderNavbar && (
        <nav
          id="Navbar"
          className={cn(
            'dsheet-nav h-[44px] color-bg-default px-4 flex gap-2 items-center justify-between w-screen fixed left-0 top-0 border-b color-border-default z-10 transition-transform duration-300',
            {
              'translate-y-0': true,
              'translate-y-[-100%]': false,
            },
          )}
          data-testid="dsheet-navbar"
        >
          {renderNavbar(editorValues)}
        </nav>
      )}

      <div
        className="dsheet-editor-main relative overflow-hidden h-[94dvh] md:!h-[calc(100vh-44px)] mt-[44px]"
        data-testid="dsheet-editor-main"
      >
        <TransitionWrapper show={true}>
          <SkeletonLoader isReadOnly={isReadOnly} />
        </TransitionWrapper>

        <TransitionWrapper show={!loading && shouldRenderSheet} duration={1000}>
          {/* Permission chip - only visible with real content */}
          {isReadOnly && (
            <div
              className="dsheet-permission-chip-wrap absolute top-2 right-4 z-20"
              data-testid="dsheet-permission-chip-wrap"
            >
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
            allowSheetDownload={allowSheetDownload}
            toggleTemplateSidebar={openTemplatesPanel}
            onboardingComplete={onboardingComplete}
            onboardingCompleteLocalStorageKey={
              onboardingCompleteLocalStorageKey
            }
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

      <EditorRightSidebar
        isOpen={isOpen && activePanelConfig !== null}
        activePanelConfig={activePanelConfig}
        onClose={closePanel}
        isReadOnly={isReadOnly}
      />
      {hoveredTemplate && !isMobile && (
        <TemplatePreview template={hoveredTemplate} />
      )}
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
  isReadOnly = false,
  allowSheetDownload,
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
  onboardingComplete,
  onboardingCompleteLocalStorageKey,
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
  collaboration,
  customPanels,
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
      isReadOnly={isReadOnly}
      allowComments={allowComments}
      onChange={onChange}
      externalEditorRef={externalSheetEditorRef}
      collaboration={collaboration}
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
        allowSheetDownload={allowSheetDownload}
        toggleTemplateSidebar={toggleTemplateSidebar}
        onboardingComplete={onboardingComplete}
        onboardingCompleteLocalStorageKey={onboardingCompleteLocalStorageKey}
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
        customPanels={customPanels}
      />
    </EditorProvider>
  );
};

export default SpreadsheetEditor;
