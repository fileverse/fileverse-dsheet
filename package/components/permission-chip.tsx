import React from 'react';
import { LucideIcon } from '@fileverse/ui';

interface PermissionChipProps {
  allowComments: boolean;
}

export const PermissionChip: React.FC<PermissionChipProps> = ({
  allowComments,
}) => {
  if (allowComments) {
    return (
      <div
        className="dsheet-chip dsheet-chip--comment inline-flex items-center py-1 gap-1 px-2 bg-yellow-100 rounded-full"
        data-testid="permission-chip"
        role="status"
      >
        <LucideIcon
          name="MessageSquareText"
          className="w-4 h-4 text-gray-800"
        />
        <span className="dsheet-text dsheet-text--chip text-xs text-black" data-testid="permission-chip-label">View and comment</span>
      </div>
    );
  }

  return (
    <div
      className="dsheet-chip dsheet-chip--view-only inline-flex items-center py-1 gap-1 px-2 bg-yellow-100 rounded-full"
      data-testid="permission-chip"
      role="status"
    >
      <LucideIcon name="Eye" className="w-4 h-4 text-gray-800" />
      <span className="dsheet-text dsheet-text--chip text-xs text-black" data-testid="permission-chip-label">View only</span>
    </div>
  );
};
