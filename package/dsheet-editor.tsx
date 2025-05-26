import { useState, useEffect } from 'react';
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

import '@fileverse-dev/fortune-react/dist/index.css';
import './styles/index.css';

// Use the types defined in types.ts
type OnboardingHandler = OnboardingHandlerType;
type DataBlockApiKeyHandler = DataBlockApiKeyHandlerType;

// Transition wrapper component with improved transitions
const TransitionWrapper = ({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready before starting fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for fade out to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 500); // Match duration-500
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 transition-all duration-500 ease-in-out transform',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
      )}
      style={{
        willChange: 'opacity, transform',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
};

/**
 * EditorContent - Internal component that renders the editor content
 * Uses the context to access state and renders appropriate UI
 */
const EditorContent = ({
  renderNavbar,
  isReadOnly,
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
}: Pick<
  DsheetProps,
  | 'renderNavbar'
  | 'isReadOnly'
  | 'toggleTemplateSidebar'
  | 'selectedTemplate'
  | 'dsheetId'
> & {
  commentData?: object;
  getCommentCellUI?: (row: number, column: number) => void;
  isTemplateOpen?: boolean;
  exportDropdownOpen: boolean;
  setExportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onboardingComplete?: boolean;
  onboardingHandler?: OnboardingHandler;
  dataBlockApiKeyHandler?: DataBlockApiKeyHandler;
}) => {
  const {
    loading,
    sheetEditorRef,
    currentDataRef,
    ydocRef,
    setForceSheetRender,
  } = useEditor();

  // Initialize template button functionality
  useApplyTemplatesBtn({
    selectedTemplate,
    ydocRef,
    dsheetId,
    currentDataRef,
    setForceSheetRender,
    sheetEditorRef,
  });

  // Apply custom styling based on dropdown and template states
  useFortuneDocumentStyle(exportDropdownOpen || false, isTemplateOpen || false);

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
            `h-14 color-bg-default py-2 px-4 flex gap-2 items-center
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
        style={{ height: '96.4%', marginTop: '56px' }}
        className="relative overflow-hidden"
      >
        <TransitionWrapper show={loading}>
          <SkeletonLoader isReadOnly={isReadOnly} />
        </TransitionWrapper>

        <TransitionWrapper show={!loading}>
          <EditorWorkbook
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
  sheetEditorRef: externalSheetEditorRef,
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
    >
      <EditorContent
        commentData={commentData}
        getCommentCellUI={getCommentCellUI}
        renderNavbar={renderNavbar}
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
      />
    </EditorProvider>
  );
};

export default SpreadsheetEditor;
