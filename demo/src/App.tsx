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
import type { KirhaToolUsage } from '../../index';

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

  // Kirha integration state
  const [showKirhaKeyModal, setShowKirhaKeyModal] = useState(false);
  const [kirhaApiKey, setKirhaApiKey] = useState('');
  const [kirhaToolUsageLog, setKirhaToolUsageLog] = useState<KirhaToolUsage | null>(null);

  // Handle Kirha tool usage callback - logs what tools Kirha used
  const handleKirhaToolUsage = useCallback((toolUsage: KirhaToolUsage) => {
    console.log('[KIRHA] Tools used:', toolUsage);
    setKirhaToolUsageLog(toolUsage);
    // Auto-hide after 5 seconds
    setTimeout(() => setKirhaToolUsageLog(null), 5000);
  }, []);

  // Handle data block API key requests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDataBlockApiKey = useCallback(({ data }: { data: any }) => {
    if (data.apiKeyName === 'KIRHA_API_KEY') {
      setShowKirhaKeyModal(true);
    }
  }, []);

  // Save Kirha API key
  const saveKirhaApiKey = () => {
    if (kirhaApiKey) {
      // Store in localStorage for the formulajs library to access
      localStorage.setItem('KIRHA_API_KEY', kirhaApiKey);
      setShowKirhaKeyModal(false);
      setKirhaApiKey('');
    }
  };

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
                    onClick={() => { }}
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


  const [isNewSheet, setIsNewSheet] = useState(false);


  useEffect(() => { setTimeout(() => { setIsNewSheet(true) }, 5000) }, [])

  const EditorPage = () => (
    <div>
      <DSheetEditor
        isReadOnly={false}
        renderNavbar={renderNavbar}
        dsheetId={dsheetId}
        onChange={handleSheetChange}
        sheetEditorRef={sheetEditorRef}
        enableIndexeddbSync={true}
        isAuthorized={false}
        isNewSheet={isNewSheet}
        dataBlockApiKeyHandler={handleDataBlockApiKey}
        onKirhaToolUsage={handleKirhaToolUsage}
      />

      {/* Kirha API Key Modal */}
      {showKirhaKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Enter Kirha API Key</h2>
            <p className="text-sm text-gray-600 mb-4">
              To use the KIRHA function, please enter your Kirha API key.
              Get one at <a href="https://kirha.ai" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">kirha.ai</a>
            </p>
            <input
              type="password"
              value={kirhaApiKey}
              onChange={(e) => setKirhaApiKey(e.target.value)}
              placeholder="Enter your Kirha API key"
              className="w-full px-3 py-2 border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowKirhaKeyModal(false)}>
                Cancel
              </Button>
              <Button onClick={saveKirhaApiKey}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Kirha Tool Usage Toast */}
      {kirhaToolUsageLog && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <LucideIcon name="Sparkles" size="sm" />
            <span className="font-medium">Kirha Tools Used</span>
          </div>
          <div className="text-sm text-gray-300">
            {kirhaToolUsageLog.map((tool, i) => (
              <div key={i} className="flex justify-between">
                <span>{tool.tool_name}</span>
                {tool.credits && <span className="text-gray-400">{tool.credits} credits</span>}
              </div>
            ))}
          </div>
        </div>
      )}
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
