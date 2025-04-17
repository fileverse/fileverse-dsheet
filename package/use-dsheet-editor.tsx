import { useState, useRef, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
// @ts-ignore
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket'
import { Awareness } from 'y-protocols/awareness';
import { IndexeddbPersistence } from 'y-indexeddb';
import { handleFileUploadUtil } from './utils/handleFileImport';
import { isSpreadsheetChanged } from './utils/diffSheet';
import { updateSheetUIToYjs } from './utils/updateSheetUI';
import { DEFAULT_SHEET_DATA } from './constant/shared-constant';
import { fromUint8Array, toUint8Array } from 'js-base64';

import { Sheet } from '@fortune-sheet/core';
import { WorkbookInstance } from '@fortune-sheet/react';

import { DsheetProp } from './types';

export const useDsheetEditor = ({
    initialSheetData,
    enableIndexeddbSync = true,
    dsheetId = 'randomweeopopppsdfi',
    onChange,
    username,
    enableWebrtc = true,
    portalContent,
}: Partial<DsheetProp>) => {
    useEffect(() => {
        if (!portalContent) {
            return
        }
        console.log('package side:', 'portalContent', portalContent, 'dsheetId', dsheetId);
        const newDoc = ydocRef.current as Y.Doc;
        const uint8Array = toUint8Array(portalContent);
        Y.applyUpdate(newDoc, uint8Array);
        const map = newDoc.getArray(dsheetId);
        const newSheetData = Array.from(map) as Sheet[];
        updateSheetUIToYjs({
            sheetEditorRef: sheetEditorRef.current as WorkbookInstance,
            sheetData: newSheetData as Sheet[],
        });
        currentDataRef.current = newSheetData as Sheet[];

    }, [portalContent, dsheetId]);
    const collaborative = true;
    const [loading, setLoading] = useState(true);
    const firstRender = useRef(true);
    const remoteUpdateRef = useRef(false);
    const ydocRef = useRef<Y.Doc | null>(null);
    const awarenessRef = useRef<Awareness | null>(null);
    const persistenceRef = useRef<IndexeddbPersistence | null>(null);
    const webrtcProviderRef = useRef<WebsocketProvider | null>(null);
    const currentDataRef = useRef<Sheet[] | null>(null);
    const sheetEditorRef = useRef<WorkbookInstance>(null);
    const [sheetData, setSheetData] = useState<Sheet[] | null>(null);

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const fileSheetdata = await handleFileUploadUtil(event);
        setSheetData(fileSheetdata);
    };

    useEffect(() => {
        const ydoc = new Y.Doc({
            gc: true,
        });
        ydocRef.current = ydoc;
        if (enableIndexeddbSync && dsheetId) {
            const persistence = new IndexeddbPersistence(dsheetId, ydoc);
            persistenceRef.current = persistence;

            persistence.on('synced', () => {
                initializeWithDefaultData(ydoc);
            });
        } else {
            initializeWithDefaultData(ydoc);
        }

        // Here we are update sheet UI according to the Yjs document update from remote changes.
        // @ts-ignore
        ydoc.on('update', (update, origin) => {
            console.log('Yjs document updated:');
            if (origin === 'self') return;
            onChange?.(
                fromUint8Array(Y.encodeStateAsUpdate(ydocRef.current!)),
                fromUint8Array(update),
            );

            const decodedUpdates = Y.decodeUpdate(update);
            let newData;
            for (const struct of decodedUpdates.structs) {
                if ('content' in struct && Object.keys(struct.content).includes('arr')) {
                    if ('arr' in struct.content) {
                        console.log('Array content:', struct.content.arr);
                        newData = struct.content.arr;
                    }
                }
            }

            if (origin !== null) {
                remoteUpdateRef.current = true;
                if (!isSpreadsheetChanged(currentDataRef.current as Sheet[], newData as Sheet[])) return;
                updateSheetUIToYjs({ sheetEditorRef: sheetEditorRef.current as WorkbookInstance, sheetData: newData as Sheet[] });
                currentDataRef.current = newData as Sheet[];
            }
            // const user = awarenessRef.current?.getStates().get(origin?.awareness?.clientID)?.user;
            // onChange?.(update,)
        });

        return () => {
            if (persistenceRef.current) {
                persistenceRef.current.destroy();
            }
            if (ydocRef.current) {
                ydocRef.current.destroy();
            }
            if (ydoc) {
                ydoc.destroy()
            }
        };
    }, []);


    function initializeWithDefaultData(ydoc: Y.Doc) {
        const sheetArray = ydoc.getArray(dsheetId);
        let localIndexeddbData;
        if (sheetArray && sheetArray.length > 0) {
            localIndexeddbData = Array.from(sheetArray) as Sheet[];
        }
        const newSheetData = localIndexeddbData || initialSheetData || DEFAULT_SHEET_DATA;
        if (!collaborative) {
            ydoc.transact(() => {
                sheetArray.delete(0, sheetArray.length);
                sheetArray.insert(0, newSheetData);
                currentDataRef.current = newSheetData;
            });
        }
        setLoading(false);
    }

    useEffect(() => {
        if (!ydocRef.current || !enableWebrtc || !dsheetId || webrtcProviderRef.current) return
        const ydoc = ydocRef.current
        const awareness = new Awareness(ydoc);
        awareness.setLocalState({
            user: {
                name: username,
                color: "yellow",
                timestamp: new Date().toISOString(),
            }
        });
        awarenessRef.current = awareness;

        if (!webrtcProviderRef.current) {
            const webrtcProvider = new WebsocketProvider(
                'wss://demos.yjs.dev/ws',
                dsheetId,
                ydoc
            )
            webrtcProviderRef.current = webrtcProvider;
            webrtcProviderRef.current.on('status', event => {
                const sheetArray = ydoc.getArray(dsheetId);
                const data = Array.from(sheetArray) as Sheet[];
                console.log('WebRTC connection status:', event, "value", data);
            });

            // webrtcProviderRef.current.on('peers', error => {
            //     console.error('WebRTC connection peers:', error);
            // });

            webrtcProviderRef.current.on('sync', (synced) => {
                const sheetArray = ydoc.getArray(dsheetId);
                const data = Array.from(sheetArray) as Sheet[];
                console.log('WebRTC connection Synced status changed:', synced, "value", data);
                updateSheetUIToYjs({ sheetEditorRef: sheetEditorRef.current as WorkbookInstance, sheetData: data as Sheet[] });
            });
        }

        return () => {
            if (webrtcProviderRef.current) {
                webrtcProviderRef.current.disconnect();
                webrtcProviderRef.current.destroy();
                webrtcProviderRef.current = null;
            }
        };
    }, [enableWebrtc, ydocRef.current]);

    const handleChange = useCallback((data: Sheet[]) => {
        console.log('handleChange:', data, firstRender.current, remoteUpdateRef.current);
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        if (remoteUpdateRef.current) {
            remoteUpdateRef.current = false;
            return
        }
        if (ydocRef.current) {
            const ydoc = ydocRef.current;
            const sheetArray = ydoc.getArray(dsheetId);
            // Compare data with current array content
            // const currentArray = Array.from(sheetArray);
            //if (JSON.stringify(currentArray) !== JSON.stringify(data)) {

            // This need better diffing algorithm for better performance with large datasets
            // For this simplified version, we'll still replace the array
            // but we only do it when there's an actual change
            const sheetFormatCellData = data.map((sheet: Sheet) => {
                const sheetCellData = sheet['data'];
                if (!sheetCellData) {
                    return sheet;
                }
                const transformedData = sheetCellData.flatMap((row, rowIndex) =>
                    row.map((cellValue, colIndex) => ({
                        r: rowIndex,
                        c: colIndex,
                        v: cellValue,
                    })),
                );
                const newSheetdata = { ...sheet, celldata: transformedData };
                delete newSheetdata.data;
                return newSheetdata;
            });
            console.log('sheetFormatCellData:', sheetFormatCellData, Array.from(sheetArray) as Sheet[]);
            currentDataRef.current = sheetFormatCellData
            if (isSpreadsheetChanged(Array.from(sheetArray) as Sheet[], sheetFormatCellData)) {
                ydoc.transact(() => {
                    sheetArray.delete(0, sheetArray.length);
                    sheetArray.insert(0, sheetFormatCellData);
                });
            }
        }
    }, [])

    return {
        sheetEditorRef,
        handleChange,
        currentDataRef,
        sheetData,
        loading,
        setSheetData,
        handleFileUpload,
    };
};
