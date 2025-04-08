import { useState, useRef, useEffect } from 'react';
import * as Y from 'yjs';
// @ts-ignore
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket'
import { Awareness } from 'y-protocols/awareness';
import { IndexeddbPersistence } from 'y-indexeddb';
import { handleFileUploadUtil } from './utils/handleFileImport';
import { isSpreadsheetChanged } from './utils/diffSheet';
import { DEFAULT_SHEET_DATA } from './constant/shared-constant';

import { Sheet } from '@fortune-sheet/core';
import { WorkbookInstance } from '@fortune-sheet/react';

import { DsheetProp } from './types';

export const useDsheetEditor = ({
    initialSheetData,
    //For now will remove later on, testing sync
    enableIndexeddbSync = true,
    dsheetId = 'randomweeopopppFQrt',
    // onChange,
    username,
    enableWebrtc = true,
}: Partial<DsheetProp>) => {
    const [loading, setLoading] = useState(true);
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
        console.log('Yjs document createdoinnn:', ydoc);
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
        // @ts-ignore
        ydoc.on('update', (update, origin) => {
            if (origin !== null) {
                const sheetArray = ydoc.getArray('SheetData');
                const data = Array.from(sheetArray) as Sheet[];
                data.map((singleSheet) => {
                    singleSheet.celldata?.map((singleCellData, index) => {
                        const row = Math.floor(index / (singleSheet.column ?? 1));
                        const col = index % (singleSheet.column ?? 1);

                        if (singleCellData !== null && singleCellData.v !== null && singleCellData.v.v) {
                            sheetEditorRef.current?.setCellValue(row, col, singleCellData.v)
                        } else if (singleCellData !== null && singleCellData.v !== null) {
                            sheetEditorRef.current?.setCellValue(row, col, null)
                        }
                    })
                })
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
        const sheetArray = ydoc.getArray('SheetData');
        let localIndexeddbData;
        if (sheetArray && sheetArray.length > 0) {
            localIndexeddbData = Array.from(sheetArray) as Sheet[];
        }
        const newSheetData = localIndexeddbData || initialSheetData || DEFAULT_SHEET_DATA;
        ydoc.transact(() => {
            sheetArray.delete(0, sheetArray.length);
            sheetArray.insert(0, newSheetData);
        });
        currentDataRef.current = newSheetData;
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
                const sheetArray = ydoc.getArray('SheetData');
                const data = Array.from(sheetArray) as Sheet[];
                console.log('WebRTC connection status:', event, "value", data);
            });

            // webrtcProviderRef.current.on('peers', error => {
            //     console.error('WebRTC connection peers:', error);
            // });

            webrtcProviderRef.current.on('sync', (synced) => {
                const sheetArray = ydoc.getArray('SheetData');
                const data = Array.from(sheetArray) as Sheet[];
                console.log('WebRTC connection Synced status changed:', synced, "value", data);
            });

            // webrtcProvider.on('error', (error) => {
            //     console.error('WebRTC error:', error);
            // });
        }

        return () => {
            if (webrtcProviderRef.current) {
                webrtcProviderRef.current.disconnect();
                webrtcProviderRef.current.destroy();
                webrtcProviderRef.current = null;
            }
        };
    }, [enableWebrtc, ydocRef.current]);

    const handleChange = (data: Sheet[]) => {
        if (ydocRef.current) {
            const ydoc = ydocRef.current;
            const sheetArray = ydoc.getArray('SheetData');
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
            if (isSpreadsheetChanged(Array.from(sheetArray) as Sheet[], sheetFormatCellData)) {
                ydoc.transact(() => {
                    sheetArray.delete(0, sheetArray.length);
                    sheetArray.insert(0, sheetFormatCellData);
                });
                currentDataRef.current = sheetFormatCellData;
            }
        }
    };

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
