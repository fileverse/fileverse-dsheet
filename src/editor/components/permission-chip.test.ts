import { describe, expect, it } from "vitest";

import {
  canShowEditElevation,
  getPermissionChipConfig,
  resolvePermissionChipMode,
} from "./permission-chip-model";

describe("PermissionChip", () => {
  it("defines the package-owned edit presentation", () => {
    expect(getPermissionChipConfig("edit")).toEqual({
      icon: "Pencil",
      label: "Edit",
      modifier: "edit",
    });
  });

  it.each(["view", "comment"] as const)(
    "offers edit elevation from %s when the host supplies a callback",
    (mode) => {
      expect(canShowEditElevation({ mode, onEnterEdit: () => {} })).toBe(true);
    },
  );

  it("keeps the chip static without elevation or when already editing", () => {
    expect(canShowEditElevation({ mode: "view" })).toBe(false);
    expect(canShowEditElevation({ mode: "edit", onEnterEdit: () => {} })).toBe(
      false,
    );
  });

  it.each([
    {
      name: "explicit edit while RTC temporarily gates writes",
      input: {
        allowComments: true,
        isReadOnly: true,
        permissionMode: "edit" as const,
      },
      expected: "edit",
    },
    {
      name: "explicit edit after RTC enables writes",
      input: {
        allowComments: true,
        isReadOnly: false,
        permissionMode: "edit" as const,
      },
      expected: "edit",
    },
    {
      name: "legacy read-only commenter",
      input: { allowComments: true, isReadOnly: true },
      expected: "comment",
    },
    {
      name: "legacy read-only viewer",
      input: { allowComments: false, isReadOnly: true },
      expected: "view",
    },
    {
      name: "legacy writable owner",
      input: { allowComments: true, isReadOnly: false },
      expected: null,
    },
  ])("resolves $name", ({ input, expected }) => {
    expect(resolvePermissionChipMode(input)).toBe(expected);
  });
});
