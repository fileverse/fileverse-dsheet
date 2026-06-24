import React from 'react';

export interface CommentThread {
  id: string;
  key: string;
  dsheetId: string;
  username: string;
  content: string;
  createdAt: string;
  commentIndex: number;
  cellContent?: string;
  replies: CommentReply[];
  isResolved?: boolean;
  isDeleted?: boolean;
}

export interface CommentReply {
  id: string;
  username: string;
  content: string;
  createdAt: string;
  commentIndex: number;
  isResolved?: boolean;
  isDeleted?: boolean;
}

export enum CommentAction {
  RESOLVE = 'resolve',
  UNRESOLVE = 'unresolve',
  DELETE = 'delete',
}

export interface CommentActionParams {
  action: CommentAction;
  commentId: string;
  dsheetId: string;
  commentKey: string;
  isReply?: boolean;
  parentCommentId?: string;
  row: number;
  col: number;
}

export interface CommentsConfig {
  commentsData: Record<string, CommentThread>; // key: `${sheetId}_${row}_${col}` or `WITHOUT_CELL_n`
  onSendComment: (key: string, textareaId: string) => void;
  onCommentAction: (action: CommentActionParams) => void;
  userName?: string;
  ownerAddress?: string;
  currentUserAddress?: string; // for permission author-match
  isOwner?: boolean; // owner can delete/resolve anything
  isAuthenticated?: boolean; // default true; false → unauthenticatedFallback in the cell popup
  unauthenticatedFallback?: React.ReactNode;
  ensResolutionUrl?: string; // mainnet RPC URL; enables ENS name + verified badge. Omit → raw names.
}

export interface CellPosition {
  row: number;
  col: number;
  sheetId?: string;
}

export interface SheetEditorRef {
  scroll: (o: {
    scrollLeft?: number;
    scrollTop?: number;
    targetRow?: number;
    targetColumn?: number;
  }) => void;
  setSelection: (s: Array<{ row: number[]; column: number[] }>) => void;
}

export interface CommentInputProps {
  id: string;
  onSend: (textareaId: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  backgroundColor?: string;
  inCellComment?: boolean;
  cancelComment?: () => void;
  onBlur?: () => void;
  isStaticButton?: boolean;
  removeCancelButton?: boolean;
  focusTrap?: boolean;
  disabled?: boolean;
}

export interface CommentItemProps {
  comment: CommentThread;
  showAvatar?: boolean;
  avatarSize?: 'sm' | 'md' | 'lg';
  className?: string;
  isHovered?: boolean;
  sheetName?: string;
  cellReference?: string;
  onAction?: (a: CommentActionParams) => void;
  ownerAddress?: string;
  currentUserAddress?: string;
  isOwner?: boolean;
  currentUserName?: string;
  contentClassName?: string;
  isCellPopup?: boolean;
  shouldShowActions?: boolean;
  row?: number;
  col?: number;
}

export interface CommentCellUIProps {
  row: number;
  col: number;
  sheetId: string;
  comment?: CommentThread;
  onSendComment: (commentKey: string, textareaId: string) => void;
  onAction?: (a: CommentActionParams) => void;
  ownerAddress?: string;
  currentUserAddress?: string;
  isOwner?: boolean;
  sheetEditorRef?: React.RefObject<SheetEditorRef>;
  currentUserName?: string;
  removeCommentFromCell: (row: number, col: number) => void;
  dragHandler: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  isHover?: boolean;
}

export interface CommentsContentProps {
  sheetEditorRef: React.RefObject<SheetEditorRef>;
  userName: string | undefined;
  commentsData: Record<string, CommentThread>;
  onSendComment: (commentKey: string, textareaId: string) => void;
  onCommentAction?: (a: CommentActionParams) => void;
  ownerAddress?: string;
  currentUserAddress?: string;
  isOwner?: boolean;
}
