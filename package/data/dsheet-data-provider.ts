import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';
import { Sheet } from '@fileverse-dev/fortune-core';
import { toUint8Array, fromUint8Array } from 'js-base64';

export class DSheetDataProvider {
  private doc: Y.Doc;
  private persistence: IndexeddbPersistence | null = null;
  private webrtcProvider: WebsocketProvider | null = null;
  private sheetId: string;
  private updateListeners: Array<(data: Sheet[]) => void> = [];
  private isReadOnly: boolean;

  constructor(options: {
    sheetId: string;
    enablePersistence: boolean;
    isReadOnly: boolean;
    webrtcConfig?: {
      enabled: boolean;
      username: string;
      serverUrl: string;
    };
  }) {
    this.sheetId = options.sheetId;
    this.isReadOnly = options.isReadOnly;
    this.doc = new Y.Doc({ gc: true });

    // Initialize document structure
    this.doc.getArray(this.sheetId);
    this.doc.getMap(`${this.sheetId}-metadata`);

    // Setup persistence if enabled and not in read-only mode
    if (options.enablePersistence && !options.isReadOnly) {
      this.setupPersistence();
    }

    // Setup WebRTC if enabled
    if (options.webrtcConfig?.enabled) {
      this.setupWebRTC(options.webrtcConfig);
    }

    // Listen for updates
    this.doc.on('update', this.handleDocUpdate);
  }

  private setupPersistence() {
    const dbName = `dsheet-${this.sheetId}`;
    this.persistence = new IndexeddbPersistence(dbName, this.doc);

    this.persistence.once('synced', () => {
      // Initial sync completed, notify listeners with current data
      const currentData = this.getData();
      if (currentData.length > 0) {
        this.notifyListeners(currentData);
      }
    });
  }

  private setupWebRTC(config: { username: string; serverUrl: string }) {
    const awareness = new Awareness(this.doc);
    awareness.setLocalState({
      user: {
        name: config.username,
        color: this.getRandomColor(),
        timestamp: new Date().toISOString(),
      },
    });

    this.webrtcProvider = new WebsocketProvider(
      config.serverUrl,
      this.sheetId,
      this.doc,
      { awareness },
    );
  }

  private getRandomColor(): string {
    const colors = [
      '#ffadad',
      '#ffd6a5',
      '#fdffb6',
      '#caffbf',
      '#9bf6ff',
      '#a0c4ff',
      '#bdb2ff',
      '#ffc6ff',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Skip if the update was triggered by us (origin is not null)
    if (origin !== null) return;

    // Get current data and notify listeners
    const currentData = this.getData();
    this.notifyListeners(currentData);
  };

  private notifyListeners(data: Sheet[]) {
    this.updateListeners.forEach((listener) => listener(data));
  }

  // Public API

  public getData(): Sheet[] {
    const array = this.doc.getArray(this.sheetId);
    const rawDataFromYjs = Array.from(array);
    console.log(
      '[DSheetDataProvider.getData] Raw data from Yjs doc:',
      JSON.parse(JSON.stringify(rawDataFromYjs)),
    );
    // Check if celldata is present on the first item, if any
    if (rawDataFromYjs.length > 0 && rawDataFromYjs[0]) {
      const firstSheetRaw = rawDataFromYjs[0] as any; // Cast to any for checking property
      console.log(
        '[DSheetDataProvider.getData] First sheet raw object from Yjs has celldata:',
        Object.prototype.hasOwnProperty.call(firstSheetRaw, 'celldata'),
      );
      if (Object.prototype.hasOwnProperty.call(firstSheetRaw, 'celldata')) {
        console.log(
          '[DSheetDataProvider.getData] First sheet raw celldata value:',
          firstSheetRaw.celldata,
        );
      }
    }
    return rawDataFromYjs as Sheet[];
  }

  public updateData(data: Sheet[]): void {
    if (this.isReadOnly) return;

    console.log(
      '[DSheetDataProvider.updateData] Data received to update Yjs doc:',
      JSON.parse(JSON.stringify(data)),
    );
    if (data.length > 0 && data[0]) {
      const firstSheet = data[0] as any; // Cast to any for checking property
      console.log(
        '[DSheetDataProvider.updateData] First sheet in received data has celldata:',
        Object.prototype.hasOwnProperty.call(firstSheet, 'celldata'),
      );
      if (Object.prototype.hasOwnProperty.call(firstSheet, 'celldata')) {
        console.log(
          '[DSheetDataProvider.updateData] First sheet received celldata value:',
          firstSheet.celldata,
        );
      }
    }

    this.doc.transact(() => {
      const array = this.doc.getArray(this.sheetId);
      array.delete(0, array.length);
      array.insert(0, data);
    });
  }

  public importFromBase64(encodedData: string): Sheet[] {
    try {
      const uint8Array = toUint8Array(encodedData);

      // Apply the update to the document
      Y.applyUpdate(this.doc, uint8Array);

      // Return the updated data
      return this.getData();
    } catch (error) {
      console.error('Error importing data:', error);
      throw new Error('Failed to import data');
    }
  }

  public exportToBase64(): string {
    const update = Y.encodeStateAsUpdate(this.doc);
    return fromUint8Array(update);
  }

  public subscribe(listener: (data: Sheet[]) => void): () => void {
    this.updateListeners.push(listener);
    return () => {
      this.updateListeners = this.updateListeners.filter((l) => l !== listener);
    };
  }

  public destroy(): void {
    if (this.webrtcProvider) {
      this.webrtcProvider.disconnect();
      this.webrtcProvider.destroy();
    }
    if (this.persistence) {
      this.persistence.destroy();
    }
    this.doc.destroy();
  }
}
