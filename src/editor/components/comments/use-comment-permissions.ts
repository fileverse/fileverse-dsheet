import { useMemo } from 'react';

export const useCommentPermissions = (
  ownerAddress?: string,
  currentUserName?: string,
  currentUserAddress?: string,
  isOwner: boolean = false,
) => {
  return useMemo(() => {
    const canModify = (item: { username: string }): boolean => {
      if (isOwner) return true;
      if (currentUserAddress && currentUserAddress === item.username)
        return true;
      if (currentUserName && currentUserName === item.username) return true;
      return false;
    };
    return {
      canDeleteComment: canModify,
      canResolveComment: canModify,
      canDeleteReply: canModify,
      canResolveReply: canModify,
      isOwner,
    };
  }, [isOwner, currentUserAddress, currentUserName]);
};
