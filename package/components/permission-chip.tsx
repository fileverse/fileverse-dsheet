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
      <div className="inline-flex items-center py-1 gap-1 px-2 bg-yellow-100 rounded-full">
        <LucideIcon
          name="MessageSquareText"
          className="w-4 h-4 text-gray-800"
        />
        <span className="text-xs text-black">View and comment</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center py-1 gap-1 px-2 bg-yellow-100 rounded-full">
      <LucideIcon name="Eye" className="w-4 h-4 text-gray-800" />
      <span className="text-xs text-black">View only</span>
    </div>
  );
};
