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

      <div
        style={{ height: '97.8%', marginTop: '44px' }}
        className="relative overflow-hidden"
      >
        <TransitionWrapper show={loading}>
          <SkeletonLoader isReadOnly={isReadOnly} />
        </TransitionWrapper>

        <TransitionWrapper show={!loading}>
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
}: DsheetProps): JSX.Element => {
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);

  return (
    <EditorProvider
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
    >
      <EditorContent
        commentData={commentData}
        getCommentCellUI={getCommentCellUI}
        renderNavbar={renderNavbar}
        setFetchingURLData={setFetchingURLData}
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
      />
    </EditorProvider>
  );
};

export default SpreadsheetEditor;
