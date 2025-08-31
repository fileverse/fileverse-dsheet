import React, { useState } from 'react';
import cn from 'classnames';

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
  getCommentCellUI?: (row: number, column: number) => void;
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
  isDevMode,
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
      onChange={onChange}
      externalEditorRef={externalSheetEditorRef}
      isCollaborative={isCollaborative}
      commentData={commentData}
      isAuthorized={isAuthorized}
      editorStateRef={editorStateRef}
      isDevMode={isDevMode}
      enableLiveQuery={enableLiveQuery}
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
