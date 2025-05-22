import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

/**
 * Hook for setting up WebRTC-based collaboration
 * Handles real-time synchronization between peers
 */
export const useEditorCollaboration = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  username = 'Anonymous',
  enableWebrtc = true,
  signalData = '',
) => {
  const [collaborationStatus, setCollaborationStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [activeUsers, setActiveUsers] = useState<string[]>([]);

  // Set up WebRTC collaboration
  useEffect(() => {
    if (!ydoc || !dsheetId || !enableWebrtc) {
      return;
    }

    let provider: WebrtcProvider | null = null;

    try {
      setCollaborationStatus('connecting');

      // Create WebRTC provider with unique room name based on dsheetId
      provider = new WebrtcProvider(dsheetId, ydoc, {
        signaling: ['wss://demos.yjs.dev/ws'],
        password: signalData || undefined,
        peerOpts: {},
        maxConns: 20,
      });

      // Set user name for awareness
      provider.awareness.setLocalStateField('user', {
        name: username,
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
      });

      // Handle awareness updates (track active users)
      const handleAwarenessUpdate = () => {
        const states = provider?.awareness.getStates() || new Map();
        const users: string[] = [];

        states.forEach((state) => {
          if (state.user && state.user.name) {
            users.push(state.user.name);
          }
        });

        setActiveUsers([...new Set(users)]);
      };

      provider.awareness.on('update', handleAwarenessUpdate);
      setCollaborationStatus('connected');

      // Clean up on unmount
      return () => {
        provider?.awareness.off('update', handleAwarenessUpdate);
        provider?.destroy();
        setCollaborationStatus('disconnected');
      };
    } catch (error) {
      console.error('Error setting up WebRTC collaboration:', error);
      setCollaborationStatus('error');
      return undefined;
    }
  }, [ydoc, dsheetId, username, enableWebrtc, signalData]);

  return { collaborationStatus, activeUsers };
};
