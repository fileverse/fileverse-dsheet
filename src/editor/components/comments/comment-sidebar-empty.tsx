import { Button } from '@fileverse/ui';

import emptyCommentSvg from '../../assets/empty-comment.svg';

const CommentSidebarEmpty = ({
  setShowComment,
}: {
  setShowComment: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <div className="flex flex-col justify-center gap-md items-center h-[calc(100vh-192px)]">
      <img
        width={188}
        height={160}
        src={emptyCommentSvg}
        alt=""
        className="object-contain"
      />
      <div className="flex flex-col gap-2xsm justify-center items-center">
        <div className=" text-heading-ssm">
          {/* <LucideIcon name="Users" className="w-6 h-6" /> */}
          No comments yet
        </div>
        <div className=" text-body-sm color-text-secondary flex items-center">
          Add a comment on a cell or in this window
        </div>
      </div>

      {/* Content */}
      <div className="w-full justify-center flex">
        <div className="text-center w-[124px]">
          <Button size={'md'} onClick={() => setShowComment(true)} className="">
            Add Comment
          </Button>
        </div>
      </div>
    </div>
  );
};

export { CommentSidebarEmpty };
