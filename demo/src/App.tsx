import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DSheetEditor, WorkbookInstance } from '../../src/index';
import type { CollaborationProps, CollabState } from '../../src/index';
import {
  Button,
  Tag,
  IconButton,
  LucideIcon,
  DynamicDropdown,
  Toaster,
  toast,
} from '@fileverse/ui';
import { useMediaQuery } from 'usehooks-ts';
import { fromUint8Array } from 'js-base64';
import { crypto as cryptoUtils } from './crypto';
import { collabStore } from './storage/collab-store';
import { getKeyFromURLParams, getCollabIdFromURL } from './utils';

function App() {
  const [title, setTitle] = useState('Untitled');
  const isMediaMax1280px = useMediaQuery('(max-width: 1280px)');
  const sheetEditorRef = useRef<WorkbookInstance>(null);
  const dsheetId = 'demo-dsheet-6';

  // @ts-expect-error later
  window.NEXT_PUBLIC_PROXY_BASE_URL =
    'https://staging-api-proxy-ca4268d7d581.herokuapp.com';

  // --- Collab state ---
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [collabRoomKey, setCollabRoomKey] = useState('');
  const [collaborationId, setCollaborationId] = useState('');
  const [collabIsOwner, setCollabIsOwner] = useState(false);
  const [username, setUsername] = useState('Anonymous');
  const [collabStatus, setCollabStatus] = useState<string>('off');
  const [collabExtras, setCollabExtras] = useState<{
    ownerEdSecret?: string;
    contractAddress?: string;
    ownerAddress?: string;
  }>({});

  // Restore collab config from localStorage on mount
  useEffect(() => {
    const stored = collabStore.getCollabConf();
    if (stored) {
      setCollabRoomKey(stored.roomKey);
      setCollaborationId(stored.roomId);
      setUsername(stored.username);
      setCollabIsOwner(stored.isOwner);
      setCollabExtras({
        ownerEdSecret: stored.ownerEdSecret,
        contractAddress: stored.contractAddress,
        ownerAddress: stored.ownerAddress,
      });
      setCollabEnabled(true);
    }
  }, []);

  // Auto-join if URL contains ?collaborationId=...#key=...
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const paramCollaborationId = getCollabIdFromURL();
    const paramKey = getKeyFromURLParams(searchParams);

    if (paramCollaborationId && paramKey) {
      const name = prompt("What's your username?");
      if (!name) return;

      setCollabRoomKey(paramKey);
      setCollaborationId(paramCollaborationId);
      setUsername(name);
      setCollabIsOwner(false);
      setCollabEnabled(true);
    }
  }, []);

  // Start a new collab session as owner
  const onToggleCollaboration = async () => {
    const name = prompt("What's your username?");
    if (!name) return;

    const { privateKey } = cryptoUtils.generateKeyPair();
    const newCollabId = globalThis.crypto.randomUUID();
    const privateKeyBase64 = fromUint8Array(privateKey, true);

    console.log("inside onToggleCollaboration");

    const extras = {
      ownerEdSecret: import.meta.env.VITE_OWNER_ED_SECRET as string | undefined,
      contractAddress: import.meta.env.VITE_COLLAB_CONTRACT_ADDRESS as string | undefined,
      ownerAddress: import.meta.env.VITE_COLLAB_OWNER_ADDRESS as string | undefined,
    };

    console.log('extras', extras);

    collabStore.setCollabConf({
      roomKey: privateKeyBase64,
      roomId: newCollabId,
      wsUrl: import.meta.env.VITE_COLLAB_WS_URL,
      isOwner: true,
      username: name,
      ...extras,
    });

    setCollabRoomKey(privateKeyBase64);
    setCollaborationId(newCollabId);
    setUsername(name);
    setCollabIsOwner(true);
    setCollabExtras(extras);
    setCollabEnabled(true);

    const joinUrl = `${window.location.origin}?collaborationId=${newCollabId}#key=${privateKeyBase64}`;
    console.log('Collaboration join URL:', joinUrl);

    await navigator.clipboard.writeText(joinUrl);
    toast({
      title: 'Collaboration link copied to clipboard',
      variant: 'success',
      toastType: 'mini',
      iconType: 'icon',
    });
  };

  const stopCollaboration = () => {
    setCollabEnabled(false);
    setCollaborationId('');
    setCollabRoomKey('');
    setUsername('Anonymous');
    setCollabIsOwner(false);
    setCollabExtras({});
    setCollabStatus('off');
    collabStore.clearCollabConf();
  };

  // Build CollaborationProps passed to DSheetEditor
  const collaboration = useMemo((): CollaborationProps => {
    if (!collabEnabled || !collaborationId || !collabRoomKey) {
      return { enabled: false };
    }
    return {
      enabled: true,
      connection: {
        roomKey: collabRoomKey,
        roomId: collaborationId,
        wsUrl: import.meta.env.VITE_COLLAB_WS_URL,
        isOwner: collabIsOwner,
        ownerEdSecret: collabExtras.ownerEdSecret,
        contractAddress: collabExtras.contractAddress,
        ownerAddress: collabExtras.ownerAddress,
      },
      session: {
        username,
        isEns: false,
      },
      services: {
        commitToStorage: undefined,
        fetchFromStorage: undefined,
      },
      on: {
        onStateChange: (state: CollabState) => {
          if (state.status === 'syncing') {
            setCollabStatus(state.hasUnmergedPeerUpdates ? 'merging' : 'syncing');
          } else {
            setCollabStatus(state.status);
          }
          if (state.status === 'syncing' && state.hasUnmergedPeerUpdates) {
            toast({ title: 'Syncing all new changes', variant: 'info', toastType: 'mini', iconType: 'icon' });
          } else if (state.status === 'reconnecting') {
            toast({ title: `Reconnecting (${state.attempt}/${state.maxAttempts})…`, variant: 'warning', toastType: 'mini', iconType: 'icon' });
          } else if (state.status === 'error') {
            toast({ title: 'Collaboration error', description: state.error.message, variant: 'error', iconType: 'icon' });
          }
        },
        onError: (error) => {
          console.error('[DSheet collab] error:', error);
          toast({ title: 'Collaboration error', description: error.message, variant: 'error', iconType: 'icon' });
        },
      },
    };
  }, [collabEnabled, collaborationId, collabRoomKey, collabIsOwner, collabExtras, username]);

  const handleSheetChange = useCallback(() => { }, []);

  const isOwnerEdSecretSet = Boolean(import.meta.env.VITE_OWNER_ED_SECRET);

  const renderNavbar = (): JSX.Element => {
    return (
      <>
        <div className="flex items-center gap-[12px]">
          <IconButton variant={'ghost'} icon="Menu" size="md" />
          <div className="relative truncate inline-block xl:!max-w-[300px] !max-w-[108px] color-bg-default text-[14px] font-medium leading-[20px]">
            <span className="invisible whitespace-pre">{title || 'Untitled'}</span>
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
            Saved locally
          </Tag>
          {collabEnabled && (
            <Tag
              icon="Users"
              className="h-6 rounded !border !color-border-default text-[12px] font-normal hidden xl:flex"
            >
              {collabStatus === 'ready' ? 'Live' : collabStatus}
            </Tag>
          )}
        </div>

        <div className="flex gap-2">
          {isMediaMax1280px ? (
            <DynamicDropdown
              key="navbar-more-actions"
              align="center"
              sideOffset={10}
              anchorTrigger={
                <IconButton icon={'EllipsisVertical'} variant="ghost" size="md" />
              }
              content={
                <div className="flex flex-col gap-1 p-2 w-fit shadow-elevation-3">
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

          {/* Collab button */}
          {!collabEnabled ? (
            <IconButton
              variant={'ghost'}
              disabled={!isOwnerEdSecretSet}
              icon="Users"
              size="md"
              title={isOwnerEdSecretSet ? 'Start collaboration' : 'Set VITE_OWNER_ED_SECRET in demo/.env to enable'}
              onClick={onToggleCollaboration}
            />
          ) : (
            <DynamicDropdown
              key="collab-actions"
              align="center"
              sideOffset={10}
              anchorTrigger={
                <IconButton icon={'Users'} variant="ghost" size="md" />
              }
              content={
                <div className="flex flex-col gap-1 p-2 w-fit shadow-elevation-3">
                  {collabIsOwner && (
                    <Button variant={'ghost'} onClick={stopCollaboration}>
                      Stop Collaboration
                    </Button>
                  )}
                  <Button
                    variant={'ghost'}
                    onClick={async () => {
                      const joinUrl = `${window.location.origin}?collaborationId=${collaborationId}#key=${collabRoomKey}`;
                      await navigator.clipboard.writeText(joinUrl);
                      toast({ title: 'Join link copied', variant: 'success', toastType: 'mini', iconType: 'icon' });
                    }}
                  >
                    Copy Join Link
                  </Button>
                </div>
              }
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
  useEffect(() => {
    setTimeout(() => {
      setIsNewSheet(true);
    }, 5000);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="*" element={
          <div>
            <Toaster position="bottom-right" duration={3000} />
            <DSheetEditor
              isReadOnly={false}
              renderNavbar={renderNavbar}
              dsheetId={dsheetId}
              onChange={handleSheetChange}
              sheetEditorRef={sheetEditorRef}
              enableIndexeddbSync={true}
              isAuthorized={false}
              isNewSheet={isNewSheet}
              collaboration={collaboration}
              username={username}
            />
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
