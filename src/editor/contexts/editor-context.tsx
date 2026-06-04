import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import throttle from 'lodash/throttle';
import { LiveQueryData, Sheet } from '@sheet-engine/react';
import { WorkbookInstance } from '@sheet-engine/react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { fromUint8Array } from 'js-base64';

import { useEditorSync } from '../hooks/use-editor-sync';
import { useEditorData } from '../hooks/use-editor-data';
import {
  updateRowIndices,
  updateColumnIndices,
} from '../utils/update-index-after-drag';
import { DataBlockApiKeyHandlerType, SheetUpdateData } from '../types';
import type { CollaborationProps, CollabState } from '../../sync-local/types';
import type { Awareness } from 'y-protocols/awareness';
// Define the shape of the context
export interface EditorContextType {
  setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  handleOnChangePortalUpdate: () => void;
  setSelectedTemplate?: React.Dispatch<React.SetStateAction<string>>;
  setShowSmartContractModal?: React.Dispatch<React.SetStateAction<boolean>>;
  getDocumentTitle?: (dsheetId: string) => Promise<string>;
  updateDocumentTitle?: (title: string) => void;
  isAuthorized: boolean;
  dataBlockCalcFunction: { [key: string]: { [key: string]: any } };
  setDataBlockCalcFunction: React.Dispatch<
    React.SetStateAction<{ [key: string]: { [key: string]: any } }>
  >;
  refreshIndexedDB: () => Promise<void>;
  // Core refs
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>;
  ydocRef: React.MutableRefObject<Y.Doc | null>;
  persistenceRef: React.MutableRefObject<IndexeddbPersistence | null>;

  // Sheet data
  sheetData: Sheet[];
  setSheetData: React.Dispatch<React.SetStateAction<Sheet[]>>;
  currentDataRef: React.MutableRefObject<Sheet[]>;
  remoteUpdateRef: React.MutableRefObject<boolean>;
  handleChange: (data: Sheet[]) => void;
  initialiseLiveQueryData: (data: Sheet[]) => void;

  // UI states
  loading: boolean;
  forceSheetRender: number;
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>;

  // Sync status
  syncStatus: 'initializing' | 'syncing' | 'synced' | 'error';

  // Socket.IO collaboration
  collabEnabled?: boolean;
  collabState?: CollabState;
  isCollabReady?: boolean;
  isCollabSyncing?: boolean;
  hasCollabContentInitialised?: boolean;
  awareness?: Awareness | null;
  terminateSession?: () => void;

  handleLiveQuery: (subsheetIndex: number, data: LiveQueryData) => void;
}

// Create the context with a default value
const EditorContext = createContext<EditorContextType | undefined>(undefined);

// Props for the provider component
interface EditorProviderProps {
  allowComments?: boolean;
  setSelectedTemplate?: React.Dispatch<React.SetStateAction<string>>;
  setShowSmartContractModal?: React.Dispatch<React.SetStateAction<boolean>>;
  getDocumentTitle?: (dsheetId: string) => Promise<string>;
  updateDocumentTitle?: (title: string) => void;
  isAuthorized: boolean;
  children: React.ReactNode;
  dsheetId: string;
  username?: string;
  portalContent?: string;
  enableIndexeddbSync?: boolean;
  isReadOnly?: boolean;
  onChange?: (data: SheetUpdateData, encodedUpdate?: string) => void;
  collaboration?: CollaborationProps;
  externalEditorRef?: React.MutableRefObject<WorkbookInstance | null>;
  commentData?: object;
  editorStateRef?: React.MutableRefObject<{
    refreshIndexedDB: () => Promise<void>;
  } | null>;
  enableLiveQuery?: boolean;
  liveQueryRefreshRate?: number;
  dataBlockApiKeyHandler?: DataBlockApiKeyHandlerType;
}

// Provider component that wraps the app
export const EditorProvider: React.FC<EditorProviderProps> = ({
  setSelectedTemplate,
  setShowSmartContractModal,
  getDocumentTitle,
  updateDocumentTitle,
  children,
  dsheetId,
  username = 'Anonymous',
  portalContent = '',
  enableIndexeddbSync = true,
  isReadOnly = false,
  allowComments = false,
  onChange,
  externalEditorRef,
  collaboration,
  commentData,
  isAuthorized,
  editorStateRef,
  enableLiveQuery,
  liveQueryRefreshRate,
  dataBlockApiKeyHandler,
}) => {
  const [forceSheetRender, setForceSheetRender] = useState<number>(1);
  const internalEditorRef = useRef<WorkbookInstance | null>(null);
  const sheetEditorRef = externalEditorRef || internalEditorRef;
  const [dataBlockCalcFunction, setDataBlockCalcFunction] = useState<{
    [key: string]: { [key: string]: any };
  }>({});

  const updateDataBlockCalcFunctionAfterRowDrag = useCallback(
    (
      selectedSourceIndex: number[],
      selectedTargetIndex: number[],
      type: string,
      sheetId: string,
      sourceIndex: number,
      targetIndex: number,
    ) => {
      setDataBlockCalcFunction((prev) => {
        const cloneDataBlockCalcFunction = { ...prev };
        const sheetData = cloneDataBlockCalcFunction?.[sheetId];

        let result;
        if (type === 'row') {
          result = updateRowIndices(
            sheetData,
            selectedSourceIndex,
            selectedTargetIndex,
            sourceIndex,
            targetIndex,
          );
        } else {
          result = updateColumnIndices(
            sheetData,
            selectedSourceIndex,
            selectedTargetIndex,
            sourceIndex,
            targetIndex,
          );
        }

        if (result !== sheetData) {
          cloneDataBlockCalcFunction[sheetId] = result;
        }

        if (
          JSON.stringify(cloneDataBlockCalcFunction) !== JSON.stringify(prev)
        ) {
          return cloneDataBlockCalcFunction;
        }

        return prev;
      });
    },
    [],
  );

  useEffect(() => {
    // @ts-expect-error exposed for FortuneSheet drag hook
    window.updateDataBlockCalcFunctionAfterRowDrag =
      updateDataBlockCalcFunctionAfterRowDrag;
    return () => {
      // @ts-expect-error exposed for FortuneSheet drag hook
      delete window.updateDataBlockCalcFunctionAfterRowDrag;
    };
  }, [updateDataBlockCalcFunctionAfterRowDrag]);

  // Stable pointer to the latest sheet data — populated by useEditorData below.
  // Declared here so onCollabUpdate (which feeds into useEditorSync) can reference it
  // without causing a TDZ issue or stale closure.
  const currentDataForCollabRef = useRef<Sheet[]>([]);

  const onCollabUpdateRef = useRef(onChange);
  useEffect(() => {
    onCollabUpdateRef.current = onChange;
  }, [onChange]);

  // onCollabUpdate: called by SyncManager when a remote update arrives.
  // Stable function — uses refs so it never needs to be recreated.
  const onCollabUpdate = useCallback((fullState: string, _chunk: string) => {
    if (!onCollabUpdateRef.current) return;
    onCollabUpdateRef.current(
      { data: currentDataForCollabRef.current },
      fullState,
    );
  }, []);

  // Initialize YJS document, persistence, and optional Socket.IO collab transport
  const {
    ydocRef,
    persistenceRef,
    syncStatus,
    isSyncedRef,
    refreshIndexedDB,
    collabState,
    isCollabReady,
    isCollabSyncing,
    hasCollabContentInitialised,
    awareness,
    terminateSession,
  } = useEditorSync(
    dsheetId,
    enableIndexeddbSync,
    isReadOnly,
    collaboration,
    onCollabUpdate,
  );

  useMemo(() => {
    if (!editorStateRef) return;
    editorStateRef.current = {
      ...editorStateRef.current,
      refreshIndexedDB,
    };
  }, [editorStateRef]);

  // Expose terminateSession on the external workbook ref so host apps can
  // call sheetEditorRef.current?.terminateSession() to end the relay session.
  // Runs every commit (no deps) so we re-attach as soon as the Workbook's
  // useImperativeHandle populates externalEditorRef.current — mutating a ref
  // does not trigger re-renders, so a deps-watched effect would miss it.
  useEffect(() => {
    if (externalEditorRef?.current && terminateSession) {
      (externalEditorRef.current as any).terminateSession = terminateSession;
    }
  });

  // Wrapper for onChange to handle type compatibility
  const handleOnChangePortalUpdate = useMemo(() => {
    if (!onChange) {
      return () => { };
    }

    return throttle(() => {
      if (!ydocRef.current) return;
      const encodedUpdate = fromUint8Array(
        Y.encodeStateAsUpdate(ydocRef.current),
      );
      onChange({ data: currentDataRef.current }, encodedUpdate);
    }, 1000);
  }, [onChange, dsheetId]);

  useEffect(() => {
    if (!onChange) return;

    const handleBeforeUnload = () => {
      handleOnChangePortalUpdate();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onChange, handleOnChangePortalUpdate]);

  // Initialize sheet data
  const {
    sheetData,
    setSheetData,
    currentDataRef,
    remoteUpdateRef,
    isDataLoaded,
    handleChange,
    handleLiveQuery,
    initialiseLiveQueryData,
    setIsDataLoaded,
  } = useEditorData(
    ydocRef,
    dsheetId,
    sheetEditorRef,
    setForceSheetRender,
    portalContent,
    isReadOnly,
    handleOnChangePortalUpdate,
    syncStatus,
    commentData,
    dataBlockCalcFunction,
    setDataBlockCalcFunction,
    enableLiveQuery,
    liveQueryRefreshRate,
    dataBlockApiKeyHandler,
    allowComments,
    hasCollabContentInitialised,
    collaboration?.enabled === true,
  );

  // Keep the stable collab ref in sync with the live currentDataRef
  currentDataForCollabRef.current = currentDataRef.current;

  // Force re-render when data changes
  useEffect(() => {
    // If data is loaded from persistence but the sheet isn't rendered yet
    if (isDataLoaded && syncStatus === 'synced' && isSyncedRef.current) {
      setForceSheetRender((prev) => prev + 1);
    }
  }, [isDataLoaded, syncStatus]);

  // Loading state is based on data loading, sync status, and data availability in read-only mode
  const loading =
    !isDataLoaded ||
    syncStatus === 'initializing' ||
    syncStatus === 'syncing' ||
    // In read-only mode, continue showing the loading state if we have no data yet
    (isReadOnly &&
      (!currentDataRef.current || currentDataRef.current.length === 0));

  // Create the context value
  const contextValue: EditorContextType = useMemo(() => {
    return {
      setSelectedTemplate,
      setShowSmartContractModal,
      getDocumentTitle,
      updateDocumentTitle,
      dataBlockCalcFunction,
      setDataBlockCalcFunction,
      sheetEditorRef,
      ydocRef,
      persistenceRef,
      sheetData,
      setSheetData,
      currentDataRef,
      remoteUpdateRef,
      handleChange,
      loading,
      setIsDataLoaded,
      forceSheetRender,
      setForceSheetRender,
      syncStatus,
      isAuthorized,
      refreshIndexedDB,
      handleLiveQuery,
      initialiseLiveQueryData,
      isReadOnly,
      handleOnChangePortalUpdate,
      // Socket.IO collab
      collabEnabled: collaboration?.enabled === true,
      collabState,
      isCollabReady,
      isCollabSyncing,
      hasCollabContentInitialised,
      awareness,
      terminateSession,
    };
  }, [
    setIsDataLoaded,
    setShowSmartContractModal,
    getDocumentTitle,
    updateDocumentTitle,
    dataBlockCalcFunction,
    setDataBlockCalcFunction,
    sheetEditorRef,
    ydocRef,
    persistenceRef,
    sheetData,
    setSheetData,
    currentDataRef,
    remoteUpdateRef,
    handleChange,
    loading,
    forceSheetRender,
    setForceSheetRender,
    syncStatus,
    isAuthorized,
    handleLiveQuery,
    initialiseLiveQueryData,
    isReadOnly,
    collaboration?.enabled,
    collabState,
    isCollabReady,
    isCollabSyncing,
    hasCollabContentInitialised,
    awareness,
    terminateSession,
  ]);

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
};

// Custom hook to use the editor context
export const useEditor = (): EditorContextType => {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};
