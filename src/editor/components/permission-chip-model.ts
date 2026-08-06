import type { DSheetPermissionMode } from "../types";

const CHIP_CONFIG = {
  view: { icon: "Eye", label: "View only", modifier: "view-only" },
  comment: {
    icon: "MessageSquareText",
    label: "View and comment",
    modifier: "comment",
  },
  edit: { icon: "Pencil", label: "Edit", modifier: "edit" },
} as const satisfies Record<
  DSheetPermissionMode,
  { icon: string; label: string; modifier: string }
>;

export const getPermissionChipConfig = (mode: DSheetPermissionMode) =>
  CHIP_CONFIG[mode];

export const resolvePermissionChipMode = ({
  allowComments,
  isReadOnly,
  permissionMode,
}: {
  allowComments: boolean;
  isReadOnly: boolean;
  permissionMode?: DSheetPermissionMode;
}): DSheetPermissionMode | null =>
  permissionMode ?? (isReadOnly ? (allowComments ? "comment" : "view") : null);
