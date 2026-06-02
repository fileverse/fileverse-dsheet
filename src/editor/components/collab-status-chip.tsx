import React from 'react';
import type { CollabState } from '../../sync-local/types';

interface Props {
  state: CollabState;
}

export const CollabStatusChip: React.FC<Props> = ({ state }) => {
  if (state.status === 'idle' || state.status === 'terminated') return null;

  const configs: Record<string, { dot: string; label: string }> = {
    connecting: { dot: 'bg-yellow-400', label: 'Connecting...' },
    syncing: { dot: 'bg-yellow-400', label: 'Syncing...' },
    ready: { dot: 'bg-green-500', label: 'Live' },
    reconnecting: {
      dot: 'bg-yellow-400',
      label:
        state.status === 'reconnecting'
          ? `Reconnecting (${state.attempt}/${state.maxAttempts})`
          : 'Reconnecting...',
    },
    error: {
      dot: 'bg-red-500',
      label: state.status === 'error' ? state.error.message : 'Error',
    },
  };

  const cfg = configs[state.status];
  if (!cfg) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 select-none">
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <span>{cfg.label}</span>
    </div>
  );
};
