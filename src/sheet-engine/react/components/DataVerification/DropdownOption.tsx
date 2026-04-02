"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, cn, TextField, IconButton } from "@fileverse/ui";
import { ColorSection as ColorPicker } from "./ColorPicker";

type Item = { id: string; value: string; color?: string | null };

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const DynamicInputList = ({
  optionItems,
  setOptionItems,
}: {
  optionItems: Item[];
  setOptionItems: React.Dispatch<React.SetStateAction<Item[]>>;
}) => {
  // Drag state
  const dragFromIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overPosition, setOverPosition] = useState<"before" | "after" | null>(
    null
  );
  const dragPreviewRef = useRef<HTMLElement | null>(null);

  const handleAdd = () => {
    const nextNum = optionItems.length + 1;
    setOptionItems((prev) => [
      ...prev,
      { id: createId(), value: `Option ${nextNum}`, color: "228, 232, 237" },
    ]);
  };

  useEffect(() => {
    if (optionItems.length === 0) {
      const nextNum = 1;
      setOptionItems((prev) => [
        ...prev,
        { id: createId(), value: `Option ${nextNum}`, color: "228, 232, 237" },
        {
          id: createId(),
          value: `Option ${nextNum + 1}`,
          color: "228, 232, 237",
        },
      ]);
    }
  }, []);

  const handleRemove = (index: number) => {
    setOptionItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, v: string) => {
    setOptionItems((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], value: v };
      return next;
    });
  };

  // Helper to build a nicer drag preview (shadowed clone)
  function createDragPreview(node: HTMLElement, cursorX = 20, cursorY = 10) {
    const rect = node.getBoundingClientRect();
    const clone = node.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.top = `${rect.top}px`;
    clone.style.left = `${rect.left}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "9999";
    clone.style.transform = "scale(0.98)";
    clone.style.borderRadius = "12px";
    clone.style.background =
      getComputedStyle(document.documentElement).getPropertyValue(
        "--color-card"
      ) || "white";
    clone.style.boxShadow =
      "0 8px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08)";
    clone.style.opacity = "0.95";
    document.body.appendChild(clone);
    return { clone, offsetX: cursorX, offsetY: cursorY };
  }

  const onDragStart = (index: number, e: React.DragEvent) => {
    dragFromIndexRef.current = index;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));

    const handle = e.currentTarget as HTMLElement;
    const row = handle.closest("li") as HTMLElement | null;
    if (row) {
      const preview = createDragPreview(row);
      dragPreviewRef.current = preview.clone;
      try {
        e.dataTransfer.setDragImage(
          preview.clone,
          preview.offsetX,
          preview.offsetY
        );
      } catch {
        // Some environments may block setDragImage; ignore gracefully
      }
    }
  };

  const onDragEnd = () => {
    if (dragPreviewRef.current && dragPreviewRef.current.parentNode) {
      dragPreviewRef.current.parentNode.removeChild(dragPreviewRef.current);
    }
    dragPreviewRef.current = null;
    setDraggingIndex(null);
    setOverPosition(null);
    dragFromIndexRef.current = null;
  };

  const onDragOverRow = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const halfway = rect.top + rect.height / 2;
    const pos = e.clientY < halfway ? "before" : "after";
    setOverPosition(pos);
  };

  const onDragLeaveRow = () => {
    // we keep the overIndex visible until entering another item to avoid flicker
  };

  function move<T>(list: T[], from: number, to: number) {
    const result = list.slice();
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }

  const onDropRow = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    const fromText = e.dataTransfer.getData("text/plain");
    const fromIndex = Number.isNaN(Number(fromText))
      ? dragFromIndexRef.current
      : Number(fromText);

    if (fromIndex == null) {
      setOverPosition(null);
      return;
    }

    // Determine destination index
    let dest = index;
    if (overPosition === "after") {
      dest = index + 1;
    }

    // If dragging from above and dropping after, account for index shift
    const adjustedDest = fromIndex < dest ? dest - 1 : dest;

    if (fromIndex !== adjustedDest) {
      setOptionItems((prev) =>
        move(prev, fromIndex, Math.max(0, Math.min(prev.length, adjustedDest)))
      );
    }

    setOverPosition(null);
    dragFromIndexRef.current = null;
    setDraggingIndex(null);

    if (dragPreviewRef.current && dragPreviewRef.current.parentNode) {
      dragPreviewRef.current.parentNode.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
  };

  const handleColorChange = (index: number, color: string | null) => {
    setOptionItems((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], color };
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <ul className="flex flex-col">
        {optionItems.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "relative flex optionItems-center gap-2 transition mb-4",
              draggingIndex === index &&
                "scale-[0.99] opacity-80 shadow-lg rounded-xl"
            )}
            onDragOver={(e) => onDragOverRow(index, e)}
            onDragLeave={onDragLeaveRow}
            onDrop={(e) => onDropRow(index, e)}
          >
            {/* Drag handle */}
            <div
              className="cursor-grab p-2 text-muted-foreground hover:text-foreground active:cursor-grabbing"
              draggable
              onDragStart={(e) => onDragStart(index, e)}
              onDragEnd={onDragEnd}
              aria-label={`Drag handle for row ${index + 1}`}
              title="Drag to reorder"
              style={{ cursor: "grab" }}
            >
              {/* 6-dots icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="20"
                viewBox="0 0 16 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="4" cy="5" r="1.5" />
                <circle cx="4" cy="10" r="1.5" />
                <circle cx="4" cy="15" r="1.5" />
                <circle cx="10" cy="5" r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="10" cy="15" r="1.5" />
              </svg>
            </div>

            {/* Uses shadcn dropdown menu with a grid of color swatches and a Reset row */}
            <div className="flex optionItems-center">
              <ColorPicker
                onPick={(c: any) => handleColorChange(index, c)}
                trigerColor={item.color as string}
              />
            </div>

            <div className="flex flex-1 optionItems-center transition">
              <TextField
                type="text"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  (e.target as HTMLInputElement).focus();
                }}
                key={item.id}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                className="w-full"
                placeholder={`Option ${index + 1}`}
                value={item.value}
                onChange={(e) => {
                  e.stopPropagation();
                  handleChange(index, e.target.value);
                  (e.target as HTMLInputElement).focus();
                }}
                aria-label={`Option ${index + 1}`}
              />
            </div>

            {/* Delete button */}
            {optionItems.length > 1 && (
              <IconButton
                icon="Trash2"
                type="button"
                variant="ghost"
                onClick={() => handleRemove(index)}
                className=""
                aria-label={`Delete row ${index + 1}`}
                title="Delete"
              />
            )}
          </li>
        ))}
      </ul>

      <div className="">
        <Button
          variant="secondary"
          onClick={handleAdd}
          size="sm"
          style={{ fontWeight: 500 }}
        >
          Add another item
        </Button>
      </div>

      {/* Expose the array variable of typed values */}
      {/* <div className="mt-6">
        <p id="values-label" className="sr-only">
          Current values
        </p>
        <pre aria-labelledby="values-label" className="rounded-lg bg-muted p-3 text-sm">
          {JSON.stringify(values, null, 2)}
        </pre>
        <pre aria-labelledby="values-label" className="rounded-lg bg-muted p-3 text-sm">
          {JSON.stringify(colors, null, 2)}
        </pre>
      </div> */}
    </div>
  );
};

export default DynamicInputList;
