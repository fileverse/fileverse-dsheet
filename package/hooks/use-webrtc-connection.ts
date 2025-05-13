import { useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';

export const useWebRTCConnection = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  username: string,
  enableWebrtc: boolean,
  portalContent: string,
) => {
  const webrtcProviderRef = useRef<WebsocketProvider | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);

  useEffect(() => {
    if (!ydoc || !enableWebrtc || !dsheetId || webrtcProviderRef.current)
      return;

    const awareness = new Awareness(ydoc);
    awareness.setLocalState({
      user: {
        name: username,
        color: 'yellow',
        timestamp: new Date().toISOString(),
      },
    });
    awarenessRef.current = awareness;

    if (portalContent?.length) {
      const webrtcProvider = new WebsocketProvider(
        'wss://demos.yjs.dev/ws',
        dsheetId,
        ydoc,
      );
      webrtcProviderRef.current = webrtcProvider;

      webrtcProvider.on('status', (event) => {
        console.log('WebRTC connection status:', event);
      });

      webrtcProvider.on('sync', (synced) => {
        console.log('WebRTC connection Synced status changed:', synced);
      });
    }

    return () => {
      webrtcProviderRef.current?.disconnect();
      webrtcProviderRef.current?.destroy();
      webrtcProviderRef.current = null;
    };
  }, [ydoc, dsheetId, username, enableWebrtc, portalContent]);

  return { webrtcProviderRef, awarenessRef };
};
