import { RefObject, useContext, useEffect } from "react";
import { removeEditingComment, mouseRender } from "@sheet-engine/core";
import WorkbookContext from "../../context";

export const useSmoothScroll = (
  scrollContainerRef: RefObject<HTMLDivElement | null>
) => {
  const { context, refs, setContext } = useContext(WorkbookContext);

  function handleScroll(
    scrollContainer: HTMLElement,
    moveScrollBy: (deltaX: number, deltaY: number) => void,
    getPixelScale: () => number = () => window.devicePixelRatio || 1
  ) {
    let queuedXPixels = 0;
    let queuedYPixels = 0;
    let animationFrameId = 0;

    const MAX_PIXEL_DELTA_PER_FRAME = 1200;

    function applyQueuedScroll() {
      animationFrameId = 0;

      if (Math.abs(queuedXPixels) < 0.5 && Math.abs(queuedYPixels) < 0.5) {
        queuedXPixels = 0;
        queuedYPixels = 0;
        return;
      }

      const xPixels = Math.max(
        -MAX_PIXEL_DELTA_PER_FRAME,
        Math.min(MAX_PIXEL_DELTA_PER_FRAME, queuedXPixels)
      );
      const yPixels = Math.max(
        -MAX_PIXEL_DELTA_PER_FRAME,
        Math.min(MAX_PIXEL_DELTA_PER_FRAME, queuedYPixels)
      );

      moveScrollBy(xPixels, yPixels);

      queuedXPixels = 0;
      queuedYPixels = 0;
    }

    function scrollHandler(x: number, y: number) {
      queuedXPixels += x;
      queuedYPixels += y;
      if (!animationFrameId)
        animationFrameId = requestAnimationFrame(applyQueuedScroll);
    }

    function handleWheelEvent(event: WheelEvent) {
      setContext((ctx) => {
        removeEditingComment(ctx, refs.globalCache);
      });
      const isPointerInSearchDialog =
        !!refs?.globalCache?.searchDialog?.mouseEnter;
      const hasFilterContextMenuOpen = context.filterContextMenu != null;

      const functionDetailAvailable = (event.target as Element).closest(
        ".luckysheet-formula-help-content"
      );
      const formulaSearchAvailable = (event.target as Element).closest(
        ".luckysheet-formula-search-c-p"
      );

      if (
        isPointerInSearchDialog ||
        hasFilterContextMenuOpen ||
        !!functionDetailAvailable ||
        !!formulaSearchAvailable
      ) {
        return;
      }
      event.preventDefault();
      const scaleFactor = getPixelScale();
      scrollHandler(event.deltaX * scaleFactor, event.deltaY * scaleFactor);
    }

    scrollContainer.addEventListener("wheel", handleWheelEvent, {
      passive: false,
    });
    return {
      scrollHandler,
      detach() {
        scrollContainer.removeEventListener("wheel", handleWheelEvent);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      },
    };
  }

  // NEW: Add mouse drag scrolling handler with continuous auto-scroll (Y-axis only)
  function handleMouseDragScroll(
    containerEl: HTMLElement,
    scrollHandler: (x: number, y: number) => void,
    getPixelScale: () => number
  ) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let autoScrollAnimationId = 0;
    let lastMoveTime = 0;
    let scrollDirection: "horizontal" | "vertical" | "none" = "none";

    const VELOCITY_SMOOTHING = 0.3; // Smoothing factor for velocity changes
    const MIN_DRAG_THRESHOLD = 5; // Minimum pixels to start dragging
    const ACCELERATION_FACTOR = 1.02; // Multiply velocity by this each frame (1.02 = 2% increase per frame)
    const MAX_VELOCITY = 50; // Maximum velocity cap to prevent it from getting too fast
    const DIRECTION_LOCK_THRESHOLD = 1.5; // Ratio threshold for direction locking
    const EDGE_SCROLL_ZONE = 10; // Pixels from edge to trigger auto-scroll

    function stopAutoScroll() {
      if (autoScrollAnimationId) {
        cancelAnimationFrame(autoScrollAnimationId);
        autoScrollAnimationId = 0;
      }
      velocityX = 0;
      velocityY = 0;
    }

    function autoScroll() {
      if (!isDragging) {
        stopAutoScroll();
        return;
      }

      // Accelerate velocity over time for both axes in both directions
      if (Math.abs(velocityX) > 0.1) {
        velocityX *= ACCELERATION_FACTOR;
        // Cap at maximum velocity
        velocityX = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocityX));
      }

      if (Math.abs(velocityY) > 0.1) {
        velocityY *= ACCELERATION_FACTOR;
        // Cap at maximum velocity
        velocityY = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocityY));
      }

      const scale = getPixelScale();
      scrollHandler(velocityX * scale, velocityY * scale);

      // Update selection every frame while auto-scrolling (mouse held at edge)
      setContext((draftCtx) => {
        const scrollXEl = refs.scrollbarX.current;
        const scrollYEl = refs.scrollbarY.current;
        const cellInputEl = refs.cellInput.current;
        const containerElCtx = refs.cellArea.current;
        const fxInputEl = refs.fxInput.current;
        if (scrollXEl && scrollYEl && cellInputEl && containerElCtx) {
          const syntheticEvent = new MouseEvent("mousemove", {
            bubbles: true,
            clientX: lastX,
            clientY: lastY,
            view: window,
          });
          mouseRender(
            draftCtx,
            refs.globalCache,
            syntheticEvent,
            cellInputEl,
            scrollXEl,
            scrollYEl,
            containerElCtx,
            fxInputEl ?? null
          );
        }
      });

      autoScrollAnimationId = requestAnimationFrame(autoScroll);
    }

    function onMouseDown(e: MouseEvent) {
      if (context.luckysheetCellUpdate.length > 0) return;

      // Only handle primary mouse button (left click)
      if (e.button !== 0) return;

      // Don't interfere with interactive elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "BUTTON" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("button") ||
        target.closest("input")
      ) {
        return;
      }

      isDragging = true;
      scrollDirection = "none"; // Reset scroll direction
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveTime = performance.now();
      velocityX = 0;
      velocityY = 0;

      containerEl.style.cursor = "grabbing";
      e.preventDefault();
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDragging) return;

      const currentTime = performance.now();
      const deltaTime = Math.max(1, currentTime - lastMoveTime);

      // Calculate delta - positive when dragging right/down, negative when dragging left/up
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;

      // Calculate total movement from start
      const totalMovedX = e.clientX - startX;
      const totalMovedY = e.clientY - startY;
      const absMovedX = Math.abs(totalMovedX);
      const absMovedY = Math.abs(totalMovedY);

      // Get container bounds for edge detection
      const containerRect = containerEl.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;

      // Check if mouse is near edges
      const isNearLeftEdge = mouseX < EDGE_SCROLL_ZONE;
      const isNearRightEdge = mouseX > containerRect.width - EDGE_SCROLL_ZONE;
      const isNearTopEdge = mouseY < EDGE_SCROLL_ZONE;
      const isNearBottomEdge = mouseY > containerRect.height - EDGE_SCROLL_ZONE;

      // Determine scroll direction if not set yet
      if (
        scrollDirection === "none" &&
        (absMovedX > MIN_DRAG_THRESHOLD || absMovedY > MIN_DRAG_THRESHOLD)
      ) {
        if (absMovedX > absMovedY * DIRECTION_LOCK_THRESHOLD) {
          scrollDirection = "horizontal";
        } else if (absMovedY > absMovedX * DIRECTION_LOCK_THRESHOLD) {
          scrollDirection = "vertical";
        } else {
          scrollDirection = "none"; // Allow both if movement is diagonal
        }
      }

      // Handle X-axis (horizontal) with direction locking AND edge detection
      if (scrollDirection === "horizontal" || scrollDirection === "none") {
        if (absMovedX > MIN_DRAG_THRESHOLD) {
          // Only trigger auto-scroll if near left or right edge
          if (isNearLeftEdge || isNearRightEdge) {
            // Only update velocity if mouse is actually moving
            if (Math.abs(deltaX) > 0.1) {
              const instantVelocityX = (deltaX / deltaTime) * 16;
              velocityX =
                velocityX * (1 - VELOCITY_SMOOTHING) +
                instantVelocityX * VELOCITY_SMOOTHING;
            }
            // If mouse stops moving, velocity stays at last value

            // Start auto-scroll animation if not already running
            if (!autoScrollAnimationId) {
              autoScrollAnimationId = requestAnimationFrame(autoScroll);
            }
          } else {
            // Not near edge, reset horizontal velocity
            velocityX = 0;
          }
        }
      } else {
        // If locked to vertical, reset horizontal velocity
        velocityX = 0;
      }

      // Handle Y-axis (vertical) with direction locking AND edge detection
      if (scrollDirection === "vertical" || scrollDirection === "none") {
        if (absMovedY > MIN_DRAG_THRESHOLD) {
          // Only trigger auto-scroll if near top or bottom edge
          if (isNearTopEdge || isNearBottomEdge) {
            // Update velocity if mouse is actually moving
            if (Math.abs(deltaY) > 0.1) {
              // Calculate instantaneous velocity (pixels per frame at 60fps)
              const instantVelocityY = (deltaY / deltaTime) * 16;

              // Smooth velocity changes to avoid jitter
              velocityY =
                velocityY * (1 - VELOCITY_SMOOTHING) +
                instantVelocityY * VELOCITY_SMOOTHING;
            }
            // If mouse stops moving, velocity stays at last value

            // Start auto-scroll animation if not already running
            if (!autoScrollAnimationId) {
              autoScrollAnimationId = requestAnimationFrame(autoScroll);
            }
          } else {
            // Not near edge, reset vertical velocity
            velocityY = 0;
          }
        }
      } else {
        // If locked to horizontal, reset vertical velocity
        velocityY = 0;
      }

      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveTime = currentTime;

      e.preventDefault();
    }

    function onMouseUp() {
      if (!isDragging) return;

      isDragging = false;
      stopAutoScroll();
      containerEl.style.cursor = "";
    }

    // Attach event listeners
    containerEl.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      stopAutoScroll();
      containerEl.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }

  function handleMobileScroll(
    containerEl: HTMLElement,
    scrollHandler: (x: number, y: number) => void,
    getPixelScale: () => number
  ) {
    let isScrolling = false;
    let gestureStartClientX = 0;
    let gestureStartClientY = 0;
    let lastPointerClientX = 0;
    let lastPointerClientY = 0;
    let lastMoveTime = 0;
    let velocityX = 0;
    let velocityY = 0;
    let momentumAnimationId = 0;
    let scrollDirection: "horizontal" | "vertical" | "none" = "none";

    const PAN_DISTANCE_THRESHOLD_PX = 8;
    const FRICTION = 0.95; // Deceleration factor (higher = longer momentum)
    const MIN_VELOCITY = 0.5; // Stop momentum below this threshold
    const VELOCITY_MULTIPLIER = 2.55;
    const DIRECTION_LOCK_THRESHOLD = 1.5;

    function stopMomentum() {
      if (momentumAnimationId) {
        cancelAnimationFrame(momentumAnimationId);
        momentumAnimationId = 0;
      }
      velocityX = 0;
      velocityY = 0;
    }

    function applyMomentum() {
      if (
        Math.abs(velocityX) < MIN_VELOCITY &&
        Math.abs(velocityY) < MIN_VELOCITY
      ) {
        stopMomentum();
        return;
      }

      const scale = getPixelScale();

      // Apply direction locking to momentum as well
      let momentumX = -velocityX * scale;
      let momentumY = -velocityY * scale;

      if (scrollDirection === "vertical") {
        momentumX = 0;
      } else if (scrollDirection === "horizontal") {
        momentumY = 0;
      }

      scrollHandler(momentumX, momentumY);

      velocityX *= FRICTION;
      velocityY *= FRICTION;

      momentumAnimationId = requestAnimationFrame(applyMomentum);
    }

    function onPointerDown(pointerEvent: PointerEvent) {
      if (
        pointerEvent.pointerType !== "touch" &&
        pointerEvent.pointerType !== "pen"
      )
        return;

      stopMomentum(); // Stop any ongoing momentum

      isScrolling = false;
      scrollDirection = "none"; // Reset scroll direction
      gestureStartClientX = pointerEvent.clientX;
      lastPointerClientX = pointerEvent.clientX;
      gestureStartClientY = pointerEvent.clientY;
      lastPointerClientY = pointerEvent.clientY;
      lastMoveTime = performance.now();
      velocityX = 0;
      velocityY = 0;

      containerEl.setPointerCapture(pointerEvent.pointerId);
    }

    function onPointerMove(pointerEvent: PointerEvent) {
      if (
        pointerEvent.pointerType !== "touch" &&
        pointerEvent.pointerType !== "pen"
      )
        return;

      const currentTime = performance.now();
      const deltaTime = Math.max(1, currentTime - lastMoveTime);

      const deltaXSinceLastMove = pointerEvent.clientX - lastPointerClientX;
      const deltaYSinceLastMove = pointerEvent.clientY - lastPointerClientY;

      // Calculate velocity for momentum (pixels per millisecond)
      velocityX = (deltaXSinceLastMove / deltaTime) * 16; // Normalize to 60fps
      velocityY = (deltaYSinceLastMove / deltaTime) * 16;

      lastPointerClientX = pointerEvent.clientX;
      lastPointerClientY = pointerEvent.clientY;
      lastMoveTime = currentTime;

      if (!isScrolling) {
        const totalXFromGestureStart = lastPointerClientX - gestureStartClientX;
        const totalYFromGestureStart = lastPointerClientY - gestureStartClientY;
        if (
          totalXFromGestureStart * totalXFromGestureStart +
            totalYFromGestureStart * totalYFromGestureStart <
          PAN_DISTANCE_THRESHOLD_PX * PAN_DISTANCE_THRESHOLD_PX
        ) {
          return; // still a tap – do nothing
        }

        // Determine primary scroll direction based on initial movement
        const absX = Math.abs(totalXFromGestureStart);
        const absY = Math.abs(totalYFromGestureStart);

        if (absX > absY * DIRECTION_LOCK_THRESHOLD) {
          scrollDirection = "horizontal";
        } else if (absY > absX * DIRECTION_LOCK_THRESHOLD) {
          scrollDirection = "vertical";
        } else {
          scrollDirection = "none"; // Allow both if movement is diagonal
        }

        isScrolling = true;
      }

      // now we're panning: prevent page scroll, move sheet
      pointerEvent.preventDefault();
      const scale = getPixelScale();

      // Apply direction locking
      let scrollX = -deltaXSinceLastMove * scale * VELOCITY_MULTIPLIER;
      let scrollY = -deltaYSinceLastMove * scale * VELOCITY_MULTIPLIER;

      if (scrollDirection === "vertical") {
        scrollX = 0; // Lock horizontal movement
      } else if (scrollDirection === "horizontal") {
        scrollY = 0; // Lock vertical movement
      }

      scrollHandler(scrollX, scrollY);
    }

    function onPointerUp(e: PointerEvent) {
      try {
        containerEl.releasePointerCapture(e.pointerId);
      } catch {}

      if (isScrolling) {
        // Start momentum scroll based on final velocity
        if (
          Math.abs(velocityX) > MIN_VELOCITY ||
          Math.abs(velocityY) > MIN_VELOCITY
        ) {
          momentumAnimationId = requestAnimationFrame(applyMomentum);
        }
      }

      isScrolling = false;
    }

    containerEl.addEventListener("pointerdown", onPointerDown, {
      passive: false,
    });
    containerEl.addEventListener("pointermove", onPointerMove, {
      passive: false,
    });
    containerEl.addEventListener("pointerup", onPointerUp);
    containerEl.addEventListener("pointercancel", onPointerUp);

    return () => {
      stopMomentum();
      containerEl.removeEventListener("pointerdown", onPointerDown as any);
      containerEl.removeEventListener("pointermove", onPointerMove as any);
      containerEl.removeEventListener("pointerup", onPointerUp as any);
      containerEl.removeEventListener("pointercancel", onPointerUp as any);
    };
  }

  const makeScrollableAreaMoveByPixels = (
    horizontalScrollbarEl: HTMLDivElement,
    verticalScrollbarEl: HTMLDivElement
  ) => {
    return (xPixels: number, yPixels: number) => {
      const maxScrollLeft =
        horizontalScrollbarEl.scrollWidth - horizontalScrollbarEl.clientWidth;
      const maxScrollTop =
        verticalScrollbarEl.scrollHeight - verticalScrollbarEl.clientHeight;

      const targetScrollLeft = Math.max(
        0,
        Math.min(maxScrollLeft, horizontalScrollbarEl.scrollLeft + xPixels)
      );
      const targetScrollTop = Math.max(
        0,
        Math.min(maxScrollTop, verticalScrollbarEl.scrollTop + yPixels)
      );

      const didScrollX = targetScrollLeft !== horizontalScrollbarEl.scrollLeft;
      const didScrollY = targetScrollTop !== verticalScrollbarEl.scrollTop;

      if (didScrollX) {
        horizontalScrollbarEl.scrollLeft = targetScrollLeft;
      }
      if (didScrollY) {
        verticalScrollbarEl.scrollTop = targetScrollTop;
      }
    };
  };

  function mountScrollEventHandlers(
    scrollContainerEl: HTMLElement,
    horizontalScrollbarEl: HTMLDivElement,
    verticalScrollbarEl: HTMLDivElement
  ) {
    const moveScrollableAreaByPixels = makeScrollableAreaMoveByPixels(
      horizontalScrollbarEl,
      verticalScrollbarEl
    );
    const { scrollHandler, detach: unmountScrollHandler } = handleScroll(
      scrollContainerEl,
      moveScrollableAreaByPixels,
      () => (window.devicePixelRatio || 1) * context.zoomRatio
    );
    const unmountMobileScrollHandler = handleMobileScroll(
      scrollContainerEl,
      scrollHandler,
      () => (window.devicePixelRatio || 1) * context.zoomRatio
    );
    // NEW: Add mouse drag scrolling
    const unmountMouseDragHandler = handleMouseDragScroll(
      scrollContainerEl,
      scrollHandler,
      () => (window.devicePixelRatio || 1) * context.zoomRatio
    );

    return () => {
      unmountScrollHandler();
      unmountMobileScrollHandler();
      unmountMouseDragHandler(); // Clean up mouse drag handler
    };
  }

  useEffect(() => {
    const scrollContainerEl = scrollContainerRef.current;
    const horizontalScrollbarEl = refs.scrollbarX.current;
    const verticalScrollbarEl = refs.scrollbarY.current;
    if (!scrollContainerEl || !horizontalScrollbarEl || !verticalScrollbarEl)
      return () => {};

    const unmountScrollEventHandlers = mountScrollEventHandlers(
      scrollContainerEl,
      horizontalScrollbarEl,
      verticalScrollbarEl
    );

    return unmountScrollEventHandlers;
  }, [context.zoomRatio, context.luckysheetCellUpdate]);
};
