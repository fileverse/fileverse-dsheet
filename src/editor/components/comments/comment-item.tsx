// components/CommentItem.tsx
import React, { memo, useState } from 'react';
import { Avatar, Button, LucideIcon, cn } from '@fileverse/ui';
import {
  CommentItemProps,
  CommentActionParams,
  CommentAction,
} from '../../types/comments';
import { formatCommentDateTime } from '../../utils/comment-key-utils';
import { useEnsStatus } from './ens/use-ens-status';
import { CommentActionsDropdown } from './comment-actions-dropdown';

// Helper component for replies with ENS
const ReplyWithENS: React.FC<{
  reply: any;
  isLast: boolean;
  isHovered: boolean;
  onAction?: (action: CommentActionParams) => void;
  parentCommentId?: string;
  ownerAddress?: string;
  currentUserName?: string;
  currentUserAddress?: string;
  isOwner?: boolean;
  dsheetId?: string;
  commentKey?: string;
  contentClassName?: string;
  isCellPopup?: boolean;
  row: number;
  col: number;
}> = ({
  reply,
  isLast,
  isHovered,
  onAction,
  parentCommentId,
  ownerAddress,
  currentUserName,
  currentUserAddress,
  isOwner,
  dsheetId,
  commentKey,
  contentClassName,
  isCellPopup = false,
  row,
  col,
}) => {
  const { name: displayName, isEns } = useEnsStatus(reply.username);
  const [isCommentHovered, setIsCommentHovered] = useState(false);

  return (
    <div
      className={cn('flex gap-2xsm flex-col', reply.isResolved && 'opacity-50')}
    >
      <div className="flex justify-start items-center">
        <div className="w-3 h-[10px] rounded-bl-lg custom-border mr-2 border-l border-b"></div>
        <div className="h-[40px] flex mr-2 items-center justify-center w-6">
          <Avatar
            key={displayName}
            size="md"
            content="text"
            alt={displayName}
          />
        </div>
        <div
          onMouseOver={() => setIsCommentHovered(true)}
          onMouseOut={() => setIsCommentHovered(false)}
          className="flex flex-col gap-3xsm flex-1"
        >
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <span className="text-body-sm-bold inline-flex items-center gap-1 force-font">
                {displayName}
                {isEns && (
                  <div title="Verified ENS name" className="flex items-center">
                    <LucideIcon
                      name="BadgeCheck"
                      size="sm"
                      className="text-blue-500"
                    />
                  </div>
                )}
              </span>
              {/* Reply Sync Status */}
              {/* <div
                className="flex items-center"
                title={getSyncStatusTooltip(reply.syncStatus)}
              >
                {getSyncStatusIcon(reply.syncStatus)}
              </div> */}
            </div>
            {/* Actions Dropdown for Reply */}
            <div className="min-h-[26px]">
              {onAction && isCommentHovered && (
                <CommentActionsDropdown
                  comment={reply}
                  onAction={onAction}
                  isReply={true}
                  parentCommentId={parentCommentId}
                  ownerAddress={ownerAddress}
                  currentUserName={currentUserName}
                  currentUserAddress={currentUserAddress}
                  isOwner={isOwner}
                  dsheetId={dsheetId}
                  commentKey={commentKey}
                  row={row}
                  col={col}
                />
              )}
            </div>
          </div>
          <span className="text-helper-text-sm color-text-secondary inline-flex items-center gap-1">
            {formatCommentDateTime(reply.createdAt)}
          </span>
        </div>
      </div>
      <div className="flex">
        {isLast && (
          <div
            className={cn(
              'relative  bottom-[27px] h-auto w-[0px] border-l',
              isHovered && !isCellPopup ? 'border-[#F8F9FA]' : 'border-white',
            )}
          ></div>
        )}
        <div className="ml-[53px]">
          <p
            className={`text-body-sm text-[#363B3F] force-font whitespace-pre-wrap break-words ${contentClassName}`}
          >
            {reply.content}
          </p>
        </div>
      </div>
    </div>
  );
};

export const CommentItem: React.FC<CommentItemProps> = memo(
  ({
    comment,
    className = '',
    isHovered = false,
    sheetName,
    cellReference,
    onAction,
    ownerAddress,
    currentUserAddress,
    isOwner,
    currentUserName,
    contentClassName = '',
    isCellPopup = false,
    shouldShowActions = true,
    row,
    col,
  }) => {
    const { name: displayName, isEns } = useEnsStatus(comment.username);

    const [pendingDelete, setPendingDelete] =
      useState<CommentActionParams | null>(null);

    const handleActionWithConfirm = (params: CommentActionParams) => {
      if (!params.isReply && params.action === CommentAction.DELETE) {
        setPendingDelete(params);
        return;
      }
      onAction?.(params);
    };

    // Build metadata line: "time • date • sheet • cell"
    const getMetadataLine = () => {
      const dateTime = formatCommentDateTime(
        comment?.createdAt?.toString() ?? '',
      );
      const parts = [dateTime];

      if (sheetName) {
        parts.push(sheetName);
      }

      if (cellReference) {
        parts.push(cellReference);
      }

      return parts.join(' • ');
    };

    return (
      <div className={cn('relative', pendingDelete && 'z-50', className)}>
        <div
          className={cn(
            'flex flex-col select-text items-start',
            comment.isResolved && 'opacity-50',
          )}
        >
          <div className="w-full flex justify-start items-center gap-xsm">
            <div className="h-[40px] flex items-center justify-center w-6">
              <Avatar
                key={displayName}
                size="md"
                content="text"
                alt={displayName}
                className="!drop-shadow-none"
              />
            </div>

            <div className="flex justify-between w-full items-center flex-1">
              <div className="flex w-full flex-col gap-3xsm">
                <div className="flex justify-between w-full items-center">
                  <span className="text-body-sm-bold inline-flex items-center gap-1 force-font">
                    {displayName}
                    {isEns && (
                      <div
                        title="Verified ENS name"
                        className="flex items-center"
                      >
                        <LucideIcon
                          name="BadgeCheck"
                          size="sm"
                          className="text-blue-500"
                        />
                      </div>
                    )}
                  </span>
                  {/* Comment Sync Status */}
                  {/* <div
                  className="flex items-center"
                  title={getSyncStatusTooltip(comment.syncStatus)}
                >
                  {getSyncStatusIcon(comment.syncStatus)}
                </div> */}
                  <div className="min-h-[26px]">
                    {onAction && shouldShowActions && isHovered && (
                      <CommentActionsDropdown
                        comment={comment}
                        onAction={handleActionWithConfirm}
                        isReply={false}
                        ownerAddress={ownerAddress}
                        currentUserName={currentUserName}
                        currentUserAddress={currentUserAddress}
                        isOwner={isOwner}
                        dsheetId={comment.dsheetId}
                        commentKey={comment.key}
                        row={row || -1}
                        col={col || -1}
                      />
                    )}
                  </div>
                </div>
                <span className="text-helper-text-sm color-text-secondary inline-flex items-center gap-1">
                  {getMetadataLine()}
                </span>
              </div>
            </div>
          </div>
          <p
            className={`text-body-sm font-helvetica color-text-default pl-[32px] force-font whitespace-pre-wrap break-words ${contentClassName}`}
          >
            {comment.content}
          </p>

          {/* Replies */}
          {comment.replies?.length > 0 && (
            <div className="flex-1 w-full">
              <div className="flex w-full">
                <div
                  style={{ marginTop: '20px' }}
                  className={cn(
                    'relative h-auto w-[1px] rounded-bl-lg left-[11.9px] bottom-[61px] custom-border border-l color-border-default',
                  )}
                ></div>
                <div className="pl-[11px] w-full">
                  <div className="flex flex-col">
                    {comment.replies
                      .filter((reply) => !reply.isDeleted)
                      .map((reply, index) => (
                        <ReplyWithENS
                          key={reply.id || index}
                          reply={reply}
                          isLast={
                            index ===
                            comment.replies.filter((r) => !r.isDeleted).length -
                              1
                          }
                          isHovered={isHovered}
                          onAction={onAction}
                          parentCommentId={comment.id}
                          ownerAddress={ownerAddress}
                          currentUserName={currentUserName}
                          currentUserAddress={currentUserAddress}
                          isOwner={isOwner}
                          dsheetId={comment.dsheetId}
                          commentKey={comment.key}
                          contentClassName={contentClassName}
                          isCellPopup={isCellPopup}
                          row={row || -1}
                          col={col || -1}
                        />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {pendingDelete && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-white/70 rounded-md" />
            <div className="relative bg-white border color-border-default rounded-lg shadow-lg p-3 flex flex-col gap-2 min-w-[220px]">
              <p className="text-body-sm-bold text-center force-font">
                Delete this comment thread?
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setPendingDelete(null)}
                  className="px-3 py-1 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    onAction?.(pendingDelete);
                    setPendingDelete(null);
                  }}
                  className="px-3 py-1 !text-sm !text-[#FB3449]"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

CommentItem.displayName = 'CommentItem';
