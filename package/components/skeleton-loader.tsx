import { useState, useEffect, useRef } from 'react';

const pulseAnimation = 'animate-[pulse_2s_ease-in-out_infinite]';

// Hook to get container dimensions instead of viewport
const useContainerSize = (containerRef: React.RefObject<HTMLDivElement>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return size;
};

// Calculate grid dimensions based on container size
const useGridDimensions = (containerRef: React.RefObject<HTMLDivElement>) => {
  const { width, height } = useContainerSize(containerRef);

  // Cell dimensions (should match your actual grid cell sizes)
  const CELL_WIDTH = 96; // w-24 = 96px
  const CELL_HEIGHT = 24; // h-6 = 24px
  const HEADER_HEIGHT = 28; // h-7 = 28px
  const TOOLBAR_HEIGHT = 39; // Actual toolbar height
  const FORMULA_BAR_HEIGHT = 28; // Actual formula bar height
  const ROW_HEADER_WIDTH = 64; // w-16 = 64px

  // Calculate available space within the container
  const availableWidth = width - ROW_HEADER_WIDTH;
  const availableHeight =
    height - HEADER_HEIGHT - TOOLBAR_HEIGHT - FORMULA_BAR_HEIGHT;

  // Calculate number of columns and rows that can fit
  const cols = Math.max(1, Math.ceil(availableWidth / CELL_WIDTH));
  const rows = Math.max(1, Math.ceil(availableHeight / CELL_HEIGHT));

  return { cols, rows };
};

// Skeleton formula bar component
export const SkeletonFormulaBar = () => (
  <div
    className={`w-full h-7 px-4 flex items-center bg-gray-50 border-b ${pulseAnimation}`}
  >
    <div className="flex items-center gap-2">
      <div className="h-4 w-32 bg-gray-200 rounded"></div>{' '}
      {/* Formula content */}
    </div>
  </div>
);

// Skeleton toolbar component
export const SkeletonToolbar = ({
  isReadOnly,
}: {
  isReadOnly: boolean | undefined;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Define different toolbar sections based on read-only mode
  const sections = isReadOnly
    ? [
      { items: 1, gap: 0 }, // Filter icon
      { items: 1, gap: 0 }, // Comment icon (if comment permissions)
    ]
    : [
      { items: 1, gap: 0 }, // First group
      { items: 1, gap: 0 }, // Second group
      { items: 2, gap: 0 }, // Third group
      { items: 3, gap: 0 }, // Fourth group
      { items: 3, gap: 0 }, // Fifth group
      { items: 3, gap: 0 }, // Sixth group
      { items: 2, gap: 0 }, // Seventh group
      { items: 3, gap: 0 }, // Eighth group
      { items: 4, gap: 0 }, // Ninth group
      { items: 3, gap: 0 }, // Tenth group
      { items: 4, gap: 0 }, // Eleventh group
    ];

  return (
    <div
      ref={containerRef}
      className={`w-full h-10 px-2 flex items-center border-b ml-5 bg-gray-50 ${pulseAnimation}`}
      style={{ height: '39px' }}
    >
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="flex items-center">
          <div className={`flex gap-${section.gap}`}>
            {[...Array(section.items)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-200"
                style={{
                  height: '30px',
                  width: '30px',
                  opacity: 0.7 + i * 0.1,
                }}
              />
            ))}
          </div>
          {sectionIndex < sections.length - 1 && (
            <div className="mx-3 h-5 w-px bg-gray-200" />
          )}
        </div>
      ))}
    </div>
  );
};

// Skeleton grid component
export const SkeletonGrid = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { cols, rows } = useGridDimensions(containerRef);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {/* Column headers */}
      <div className="flex sticky top-0 z-10 bg-gray-100">
        {[...Array(cols)].map((_, i) => (
          <div
            key={i}
            className={`h-7 w-24 bg-gray-100 flex-shrink-0 ${pulseAnimation} flex items-center justify-center text-gray-500 text-xs font-medium`}
            style={{
              animationDelay: `${i * 50}ms`,
              opacity: 0.9 - i * 0.01,
            }}
          ></div>
        ))}
      </div>

      {/* Row headers and cells */}
      <div className="overflow-hidden flex-1">
        {[...Array(rows)].map((_, rowIndex) => (
          <div key={rowIndex} className="flex whitespace-nowrap">
            <div
              className={`h-6 w-16 bg-gray-100 flex-shrink-0 ${pulseAnimation} flex items-center justify-center text-gray-500 text-xs font-medium`}
              style={{ animationDelay: `${rowIndex * 30}ms` }}
            ></div>
            {[...Array(cols)].map((_, colIndex) => (
              <div
                key={colIndex}
                className={`h-6 w-24 bg-white border border-1 flex-shrink-0 ${pulseAnimation} flex items-center justify-center`}
                style={{
                  animationDelay: `${(rowIndex * 5 + colIndex) * 10}ms`,
                  opacity: Math.max(0.3, 1 - rowIndex * 0.02 - colIndex * 0.01),
                  background: '#ffffff',
                }}
              >
                <div className="w-4 h-1 bg-gray-200 rounded-md"></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Main skeleton loader component
const SkeletonLoader = ({
  isReadOnly,
}: {
  isReadOnly: boolean | undefined;
}) => (
  <div className="w-full h-full flex flex-col">
    <SkeletonToolbar isReadOnly={isReadOnly} />
    <SkeletonFormulaBar />
    <div className="flex-1 overflow-hidden">
      <SkeletonGrid />
    </div>
  </div>
);

export default SkeletonLoader;
