import React, { useState } from 'react';
import { DynamicDropdown, LucideIcon, Button } from '@fileverse/ui';
import {
  CommentThread,
  CommentReply,
  CommentAction,
  CommentActionParams,
} from '../../types/comments';
import { useCommentPermissions } from './use-comment-permissions';

interface CommentActionsDropdownProps {
  comment: CommentThread | CommentReply;
  onAction: (action: CommentActionParams) => void;
  isReply?: boolean;
  parentCommentId?: string;
  ownerAddress?: string;
  currentUserName?: string;
  currentUserAddress?: string;
  isOwner?: boolean;
  dsheetId?: string;
  commentKey?: string;
  row: number;
  col: number;
}

export const CommentActionsDropdown: React.FC<CommentActionsDropdownProps> = ({
  comment,
  onAction,
  isReply = false,
  parentCommentId,
  ownerAddress,
  currentUserName,
  currentUserAddress,
  isOwner,
  dsheetId,
  commentKey,
  row,
  col,
}) => {
  const {
    canDeleteComment,
    canResolveComment,
    canDeleteReply,
    canResolveReply,
  } = useCommentPermissions(
    ownerAddress,
    currentUserName,
    currentUserAddress,
    isOwner,
  );

  const [dropdownKey, setDropdownKey] = useState(0);

  // Calculate permissions synchronously
  const canDelete = isReply
    ? canDeleteReply(comment)
    : canDeleteComment(comment);

  const canResolve = isReply
    ? canResolveReply(comment)
    : canResolveComment(comment);

  // Don't render if user has no permissions
  if (!canDelete && !canResolve) {
    return null;
  }

  const handleAction = (action: CommentAction) => {
    onAction({
      action,
      commentId: comment.id,
      dsheetId: dsheetId || '',
      commentKey: commentKey || '',
      isReply,
      parentCommentId,
      row,
      col,
    });

    // Force dropdown to close by changing key (remounts component)
    setDropdownKey((prev) => prev + 1);
  };

  const dropdownContent = (
    <div className="flex flex-col gap-1 min-w-[180px]">
      {!isReply && canResolve && (
        <Button
          variant="ghost"
          onClick={() =>
            handleAction(
              comment.isResolved
                ? CommentAction.UNRESOLVE
                : CommentAction.RESOLVE,
            )
          }
          className="justify-start w-full gap-2 px-3 py-2 text-sm"
        >
          <LucideIcon name="CircleCheck" size="sm" />
          {comment.isResolved ? 'Unresolve' : 'Resolve thread and hide'}
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          onClick={() => handleAction(CommentAction.DELETE)}
          className="justify-start w-full gap-2 px-3 py-2 text-sm text-red-700"
        >
          <LucideIcon name="Trash2" size="sm" />
          {isReply ? 'Delete' : 'Delete thread'}
        </Button>
      )}
    </div>
  );

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <DynamicDropdown
        key={dropdownKey}
        align="end"
        sideOffset={5}
        className="shadow-lg rounded-lg p-1 border"
        anchorTrigger={
          <button className="p-1 hover:color-bg-default-hover rounded transition-colors">
            <LucideIcon name="Ellipsis" size="sm" className="color-text-secondary" />
          </button>
        }
        content={dropdownContent}
      />
    </div>
  );
};
