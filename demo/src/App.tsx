import { useState, useCallback, useRef } from 'react';
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
  const dsheetId = 'demo-dsheet-2';

  // Handle data changes in the sheet - kept empty as we don't need to log anything
  const handleSheetChange = useCallback(() => {}, []);

  const renderNavbar = (): JSX.Element => {
    return (
      <>
        <div className="flex items-center gap-[12px]">
          <IconButton variant={'ghost'} icon="Menu" size="md" />
          <div className="relative truncate inline-block xl:!max-w-[300px] !max-w-[108px] color-bg-default text-[14px] font-medium leading-[20px]">
            <span className="invisible whitespace-pre">
              {title || 'Untitled'}
            </span>
            <input
              className="focus:outline-none truncate color-bg-default absolute top-0 left-0 right-0 bottom-0 select-text"
              type="text"
              placeholder="Untitled"
              value={title || 'Untitled'}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <Tag
            icon="BadgeCheck"
            className="h-6 rounded !border !color-border-default color-text-secondary text-[12px] font-normal hidden xl:flex"
          >
            Saved in local storage
          </Tag>
          <div className="w-6 h-6 rounded color-bg-secondary flex justify-center items-center border color-border-default xl:hidden">
            <LucideIcon
              name="BadgeCheck"
              size="sm"
              className="color-text-secondary"
            />
          </div>
        </div>
        <div className="flex gap-2">
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
                />
              }
              content={
                <div className="flex flex-col gap-1 p-2 w-fit shadow-elevation-3 ">
                  <Button
                    variant={'ghost'}
                    onClick={() => {}}
                    className="flex justify-start gap-2"
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
              className="flex xl:hidden"
              size="md"
            />
          )}
          <Button
            toggleLeftIcon={true}
            leftIcon="Share2"
            variant={'ghost'}
            className="!min-w-[90px] !px-0 hidden xl:flex"
          >
            Share
          </Button>
          <div className="flex gap-2 px-2 justify-center items-center">
            <LucideIcon name="Farcaster" />
            <div className="flex-col hidden xl:flex">
              <p className="text-heading-xsm">@[username]</p>
              <p className="text-helper-text-sm">Farcaster</p>
            </div>
          </div>
        </div>
      </>
    );
  };

  const EditorPage = () => (
    <div>
      <DSheetEditor
        isReadOnly={true}
        renderNavbar={renderNavbar}
        dsheetId={dsheetId}
        onChange={handleSheetChange}
        sheetEditorRef={sheetEditorRef}
        enableIndexeddbSync={true}
        isAuthorized={true}
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
