import { useState, useEffect, useRef } from 'react';
import { Sheet } from '@fileverse-dev/fortune-core';
import { DSheetDataProvider } from '../data/dsheet-data-provider';
import { DEFAULT_SHEET_DATA } from '../constants/shared-constants';
import { SheetUpdateData } from '../types';

export function useDSheetData(options: {
  sheetId: string;
  enablePersistence: boolean;
  isReadOnly: boolean;
  portalContent?: string;
  username?: string;
  enableWebrtc?: boolean;
  webrtcServerUrl?: string;
  onChange?: (data: SheetUpdateData, encodedUpdate?: string) => void;
}) {
  const [data, setData] = useState<Sheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const providerRef = useRef<DSheetDataProvider | null>(null);

  useEffect(() => {
    // Create data provider
    const provider = new DSheetDataProvider({
      sheetId: options.sheetId,
      enablePersistence: options.enablePersistence,
      isReadOnly: options.isReadOnly,
      webrtcConfig: options.enableWebrtc
        ? {
            enabled: true,
            username: options.username || 'Anonymous',
            serverUrl: options.webrtcServerUrl || 'wss://demos.yjs.dev/ws',
          }
        : undefined,
    });

    providerRef.current = provider;

    // Load initial data
    let initialData: Sheet[] = [];

    try {
      // If we have portal content, import it
      if (options.portalContent) {
        initialData = provider.importFromBase64(options.portalContent);
      } else {
        // Otherwise get data from provider (which may be empty)
        initialData = provider.getData();
      }

      // If no data is available, use default data
      if (initialData.length === 0) {
        initialData = DEFAULT_SHEET_DATA;
        if (!options.isReadOnly) {
          provider.updateData(initialData);
        }
      }

      setData(initialData);
    } catch (err) {
      console.error('Error initializing data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Fall back to default data
      initialData = DEFAULT_SHEET_DATA;
      setData(initialData);
    } finally {
      setIsLoading(false);
    }

    // Subscribe to changes
    const unsubscribe = provider.subscribe((newData) => {
      setData(newData);
      if (options.onChange) {
        const updateData: SheetUpdateData = { data: newData };
        options.onChange(updateData, provider.exportToBase64());
      }
    });

    return () => {
      unsubscribe();
      provider.destroy();
    };
  }, [
    options.sheetId,
    options.enablePersistence,
    options.isReadOnly,
    options.portalContent,
  ]);

  const updateData = (newData: Sheet[]) => {
    if (providerRef.current && !options.isReadOnly) {
      providerRef.current.updateData(newData);
      setData(newData);
    }
  };

  const exportData = (): string => {
    if (!providerRef.current) throw new Error('Data provider not initialized');
    return providerRef.current.exportToBase64();
  };

  return {
    data,
    isLoading,
    error,
    updateData,
    exportData,
  };
}
