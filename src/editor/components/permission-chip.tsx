import React from "react";
import { LucideIcon } from "@fileverse/ui";
import type { DSheetPermissionMode } from "../types";
import { getPermissionChipConfig } from "./permission-chip-model";

interface PermissionChipProps {
  mode: DSheetPermissionMode;
}

export const PermissionChip: React.FC<PermissionChipProps> = ({ mode }) => {
  const { icon, label, modifier } = getPermissionChipConfig(mode);

  return (
    <div
      className={`dsheet-chip dsheet-chip--${modifier} inline-flex items-center py-1 gap-1 px-2 bg-yellow-100 rounded-full`}
      data-testid="permission-chip"
      role="status"
    >
      <LucideIcon name={icon} className="w-4 h-4 color-text-default" />
      <span
        className="dsheet-text dsheet-text--chip text-xs color-text-default"
        data-testid="permission-chip-label"
      >
        {label}
      </span>
    </div>
  );
};
