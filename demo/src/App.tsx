import { useState, useCallback, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DSheetEditor from '../../package/dsheet-editor';
import {
  Button,
  Tag,
  IconButton,
  LucideIcon,
  DynamicDropdown,
} from '@fileverse/ui';
import { useMediaQuery } from 'usehooks-ts';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

function App() {
  const [title, setTitle] = useState('Untitled');
  const isMediaMax1280px = useMediaQuery('(max-width: 1280px)');
  // Create a ref to control the sheet editor
  const sheetEditorRef = useRef<WorkbookInstance>(null);

  // Use a stable dsheetId
  const dsheetId = 'demo-dsheet-6';
  // @ts-expect-error later
  window.NEXT_PUBLIC_PROXY_BASE_URL = 'https://staging-api-proxy-ca4268d7d581.herokuapp.com';

  // Handle data changes in the sheet - kept empty as we don't need to log anything
  const handleSheetChange = useCallback(() => { }, []);

  const renderNavbar = (): JSX.Element => {
    return (
      <>
        <div className="dsheet-navbar-left flex items-center gap-[12px]" data-testid="navbar-left">
          <IconButton variant={'ghost'} icon="Menu" size="md" data-testid="navbar-menu-button" />
          <div className="dsheet-doc-title-wrap relative truncate inline-block xl:!max-w-[300px] !max-w-[108px] color-bg-default text-[14px] font-medium leading-[20px]">
            <span className="invisible whitespace-pre">
              {title || 'Untitled'}
            </span>
            <input
              className="dsheet-input dsheet-input--doc-title focus:outline-none truncate color-bg-default absolute top-0 left-0 right-0 bottom-0 select-text"
              type="text"
              placeholder="Untitled"
              value={title || 'Untitled'}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="document-title-input"
            />
          </div>
          <Tag
            icon="BadgeCheck"
            className="dsheet-tag dsheet-tag--saved h-6 rounded !border !color-border-default color-text-secondary text-[12px] font-normal hidden xl:flex"
            data-testid="saved-tag"
          >
            Saved in local storage
          </Tag>
          <div className="dsheet-navbar-saved-icon w-6 h-6 rounded color-bg-secondary flex justify-center items-center border color-border-default xl:hidden" data-testid="navbar-saved-icon">
            <LucideIcon
              name="BadgeCheck"
              size="sm"
              className="color-text-secondary"
            />
          </div>
        </div>
        <div className="dsheet-navbar-right flex gap-2" data-testid="navbar-right">
          {isMediaMax1280px ? (
            <DynamicDropdown
              key="navbar-more-actions"
              align="center"
              sideOffset={10}
              anchorTrigger={
                <IconButton
                  icon={'EllipsisVertical'}
                  variant="ghost"
                  size="md"
                  data-testid="navbar-more-actions"
                />
              }
              content={
                <div className="flex flex-col gap-1 p-2 w-fit shadow-elevation-3 " data-testid="navbar-more-dropdown">
                  <Button
                    variant={'ghost'}
                    onClick={() => { }}
                    className="dsheet-btn dsheet-btn--share flex justify-start gap-2"
                    data-testid="navbar-share-button"
                  >
                    <LucideIcon name="Share2" size="sm" />
                    Share
                  </Button>
                </div>
              }
            />
          ) : (
            <IconButton
              variant={'ghost'}
              icon="Share2"
              className="dsheet-btn-icon flex xl:hidden"
              size="md"
              data-testid="navbar-share-icon"
            />
          )}
          <Button
            toggleLeftIcon={true}
            leftIcon="Share2"
            variant={'ghost'}
            className="dsheet-btn dsheet-btn--share !min-w-[90px] !px-0 hidden xl:flex"
            data-testid="navbar-share-button-desktop"
          >
            Share
          </Button>
          <div className="dsheet-navbar-farcaster flex gap-2 px-2 justify-center items-center" data-testid="navbar-farcaster">
            <LucideIcon name="Farcaster" />
            <div className="flex-col hidden xl:flex">
              <p className="dsheet-heading dsheet-heading--xsm text-heading-xsm" data-testid="navbar-username">@[username]</p>
              <p className="dsheet-text dsheet-text--helper text-helper-text-sm" data-testid="navbar-farcaster-label">Farcaster</p>
            </div>
          </div>
        </div>
      </>
    );
  };


  const [isNewSheet, setIsNewSheet] = useState(false);


  useEffect(() => { setTimeout(() => { setIsNewSheet(true) }, 5000) }, [])

  const EditorPage = () => (
    <div className="dsheet-demo-page" data-testid="dsheet-demo-page">
      <DSheetEditor
        isReadOnly={false}
        renderNavbar={renderNavbar}
        dsheetId={dsheetId}
        onChange={handleSheetChange}
        sheetEditorRef={sheetEditorRef}
        enableIndexeddbSync={true}
        isAuthorized={false}
        isNewSheet={isNewSheet}
      />
    </div>
  );

  return (
    <Router>
      <Routes>
        {/* Catch-all route */}
        <Route path="*" element={<EditorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
