export const useCommentCell = ({
  onSendComment,
  cellKey,
}: {
  onSendComment: (commentKey: string, textareaId: string) => void;
  cellKey: string;
}) => {
  const textareaId = 'comment-edit';

  const handleSend = (textareaId: string) => {
    onSendComment(cellKey, textareaId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleScroll = (e: React.UIEvent) => {
    e.stopPropagation();
  };

  const hasParentWithId = (target: HTMLElement | null, id: string): boolean => {
    let current = target;

    while (current) {
      if (current.id === id) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  const handler = (e: WheelEvent) => {
    if (hasParentWithId(e.target as HTMLElement, 'comment-scroll')) {
      e.preventDefault();
    }
  };

  return {
    cellKey,
    textareaId,
    handleSend,
    handleKeyDown,
    handleDoubleClick,
    handleScroll,
    handler,
  };
};
