import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { LiveQueryData, Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { fromUint8Array } from 'js-base64';

import { useEditorSync } from '../hooks/use-editor-sync';
import { useEditorData } from '../hooks/use-editor-data';
import { updateRowIndices, updateColumnIndices } from '../utils/update-index-after-drag';
import { useEditorCollaboration } from '../hooks/use-editor-collaboration';
import { DataBlockApiKeyHandlerType, SheetUpdateData } from '../types';

// Define the shape of the context
export interface EditorContextType {
  setSelectedTemplate?: React.Dispatch<React.SetStateAction<string>>;
  setShowSmartContractModal?: React.Dispatch<React.SetStateAction<boolean>>;
  getDocumentTitle?: () => string;
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

  // UI states
  loading: boolean;
  forceSheetRender: number;
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>;

  // Collaboration
  activeUsers: string[];
  collaborationStatus: 'disconnected' | 'connecting' | 'connected' | 'error';

  // Sync status
  syncStatus: 'initializing' | 'syncing' | 'synced' | 'error';

  // For compatibility with types
  isCollaborative?: boolean;

  handleLiveQuery: (subsheetIndex: number, data: LiveQueryData) => void;
}

// Create the context with a default value
const EditorContext = createContext<EditorContextType | undefined>(undefined);

// Props for the provider component
interface EditorProviderProps {
  setSelectedTemplate?: React.Dispatch<React.SetStateAction<string>>;
  setShowSmartContractModal?: React.Dispatch<React.SetStateAction<boolean>>;
  getDocumentTitle?: () => string;
  updateDocumentTitle?: (title: string) => void;
  isAuthorized: boolean;
  children: React.ReactNode;
  dsheetId: string;
  username?: string;
  portalContent?: string;
  enableIndexeddbSync?: boolean;
  enableWebrtc?: boolean;
  isReadOnly?: boolean;
  onChange?: (data: SheetUpdateData, encodedUpdate?: string) => void;
  externalEditorRef?: React.MutableRefObject<WorkbookInstance | null>;
  isCollaborative?: boolean;
  commentData?: Object;
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
  enableWebrtc = true,
  isReadOnly = false,
  onChange,
  externalEditorRef,
  isCollaborative = false,
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

  const updateDataBlockCalcFunctionAfterRowDrag = (
    sourceIndex: number,
    targetIndex: number,
    type: string,
    sheetId: string
  ) => {
    const cloneDataBlockCalcFunction = { ...dataBlockCalcFunction };
    const sheetData = cloneDataBlockCalcFunction?.[sheetId];

    let result;
    if (type === 'row') {
      result = updateRowIndices(sheetData, sourceIndex, targetIndex);
    } else {
      result = updateColumnIndices(sheetData, sourceIndex, targetIndex);
    }

    if (result !== sheetData) {
      cloneDataBlockCalcFunction[sheetId] = result;
    }

    if (JSON.stringify(cloneDataBlockCalcFunction) !== JSON.stringify(dataBlockCalcFunction)) {
      setDataBlockCalcFunction(cloneDataBlockCalcFunction);
    }
  }

  useEffect(() => {
    //@ts-ignore
    window.updateDataBlockCalcFunctionAfterRowDrag = updateDataBlockCalcFunctionAfterRowDrag;
    return () => {
      //@ts-ignore
      delete window.updateDataBlockCalcFunctionAfterRowDrag;
    };
  }, [updateDataBlockCalcFunctionAfterRowDrag]);

  // Initialize YJS document and persistence
  const { ydocRef, persistenceRef, syncStatus, isSyncedRef, refreshIndexedDB } =
    useEditorSync(dsheetId, enableIndexeddbSync, isReadOnly);

  useMemo(() => {
    if (!editorStateRef) return;
    editorStateRef.current = {
      ...editorStateRef.current,
      refreshIndexedDB,
    };
  }, [editorStateRef]);

  // Wrapper for onChange to handle type compatibility
  const handleOnChange =
    (data: Sheet[]) => {
      if (onChange && ydocRef.current) {
        // Encode the YJS document state to pass as second parameter
        const encodedUpdate = fromUint8Array(
          Y.encodeStateAsUpdate(ydocRef.current),
        );
        onChange({ data }, encodedUpdate);
      }
    }

  // Initialize sheet data
  const {
    sheetData,
    setSheetData,
    currentDataRef,
    remoteUpdateRef,
    isDataLoaded,
    handleChange,
    handleLiveQuery,
  } = useEditorData(
    ydocRef,
    dsheetId,
    sheetEditorRef,
    setForceSheetRender,
    portalContent,
    isReadOnly,
    handleOnChange,
    syncStatus,
    commentData,
    dataBlockCalcFunction,
    setDataBlockCalcFunction,
    enableLiveQuery,
    liveQueryRefreshRate,
    dataBlockApiKeyHandler,
  );

  // Initialize collaboration
  const { collaborationStatus, activeUsers } = useEditorCollaboration(
    ydocRef.current,
    dsheetId,
    username,
    enableWebrtc,
    portalContent,
  );

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
      forceSheetRender,
      setForceSheetRender,
      activeUsers,
      collaborationStatus,
      syncStatus,
      isCollaborative,
      isAuthorized,
      refreshIndexedDB,
      handleLiveQuery,
    };
  }, [
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
    activeUsers,
    collaborationStatus,
    syncStatus,
    isCollaborative,
    isAuthorized,
    handleLiveQuery,
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
