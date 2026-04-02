"use client";

import React, { useEffect, useState, useRef } from "react";

import { cn } from "@fileverse/ui";

interface DraggableDivProps {
  children?: React.ReactNode;
  className?: string;
  initialTop?: any;
  dragHasMoved?: any;
}

export const DraggableDiv = ({
  children,
  className,
  initialTop,
  dragHasMoved,
}: DraggableDivProps) => {
  const initialX = 0;
  const initialY = initialTop;
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialWindowPos, setInitialWindowPos] = useState({ x: 0, y: 0 });
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divRef.current) {
      const rect = divRef.current.getBoundingClientRect();
      const left = rect.left + window.scrollX;
      const top = rect.top + window.scrollY;
      setInitialWindowPos({ x: left, y: top });
    }
  }, []);

  useEffect(() => {
    setPosition({ x: position.x, y: initialTop });
  }, [initialTop]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // @ts-ignore
    if (!e.target.closest("#luckysheet-formula-help-title")) return;
    setIsDragging(true);

    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // @ts-ignore
    if (!e.target.closest("#luckysheet-formula-help-title")) return;
    setIsDragging(true);

    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    e.preventDefault();
    dragHasMoved.current = true;

    setPosition((current) => {
      // Calculate new position using current offset
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      // Get element dimensions for boundary calculation
      const elementWidth = divRef.current?.offsetWidth || 0;
      const elementHeight = divRef.current?.offsetHeight || 0;

      // Apply boundaries for right and bottom
      if (newX + initialWindowPos.x + 320 > window.innerWidth - elementWidth) {
        newX = current.x;
      }

      if (
        newY + initialWindowPos.y + 275 >
        window.innerHeight - elementHeight
      ) {
        newY = current.y;
      }

      // Apply boundaries for left and top
      if (newX + initialWindowPos.x - 35 < 0) {
        newX = current.x;
      }

      if (newY + initialWindowPos.y - 120 < 0) {
        newY = current.y;
      }

      return {
        x: newX,
        y: newY,
      };
    });
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;

    e.preventDefault();
    dragHasMoved.current = true;

    const touch = e.touches[0];
    setPosition((current) => {
      // Calculate new position using current offset
      let newX = touch.clientX - dragOffset.x;
      let newY = touch.clientY - dragOffset.y;

      // Get element dimensions for boundary calculation
      const elementWidth = divRef.current?.offsetWidth || 0;
      const elementHeight = divRef.current?.offsetHeight || 0;

      // Apply boundaries for right and bottom
      if (newX + initialWindowPos.x + 250 > window.innerWidth - elementWidth) {
        newX = current.x;
      }

      if (
        newY + initialWindowPos.y + 220 >
        window.innerHeight - elementHeight
      ) {
        newY = current.y;
      }

      // Apply boundaries for left and top
      if (newX + initialWindowPos.x - 10 < 0) {
        newX = current.x;
      }

      if (newY + initialWindowPos.y - 40 < 0) {
        newY = current.y;
      }

      return {
        x: newX,
        y: newY,
      };
    });
  };
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const element = document.getElementById("luckysheet-formula-help-c");
    if (element) {
      element.style.userSelect = "auto";
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isDragging,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ]);

  return (
    <div
      ref={divRef}
      className={cn(
        "absolute select-none touch-none",
        isDragging
          ? "cursor-grabbing shadow-2xl z-50"
          : "cursor-grab shadow-lg",
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        height: "0px",
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
};
