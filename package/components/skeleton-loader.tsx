const pulseAnimation = 'animate-[pulse_2s_ease-in-out_infinite]';

// Skeleton toolbar component
export const SkeletonToolbar = () => (
  <div
    className={`w-full px-1 py-2 flex justify-center border-b gap-2 bg-gray-50 ${pulseAnimation}`}
  >
    {[...Array(30)].map((_, i) => (
      <div
        key={i}
        className="h-8 w-10 bg-gray-200 rounded-md"
        style={{ opacity: i % 3 === 0 ? 1 : i % 3 === 1 ? 0.8 : 0.6 }}
      ></div>
    ))}
  </div>
);

// Skeleton grid component
export const SkeletonGrid = () => (
  <div className="w-full h-full flex flex-col">
    {/* Column headers */}
    <div className="flex sticky top-0 z-10 bg-gray-100">
      {[...Array(20)].map((_, i) => (
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
    <div className="overflow-auto flex-1">
      {[...Array(28)].map((_, rowIndex) => (
        <div key={rowIndex} className="flex whitespace-nowrap">
          <div
            className={`h-6 w-16 bg-gray-100 flex-shrink-0 ${pulseAnimation} flex items-center justify-center text-gray-500 text-xs font-medium`}
            style={{ animationDelay: `${rowIndex * 30}ms` }}
          ></div>
          {[...Array(15)].map((_, colIndex) => (
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

// Main skeleton loader component
const SkeletonLoader = ({
  isReadOnly,
}: {
  isReadOnly: boolean | undefined;
}) => (
  <div className="w-full h-full flex flex-col">
    {!isReadOnly && <SkeletonToolbar />}
    <div className="flex-1 overflow-hidden">
      <SkeletonGrid />
    </div>
  </div>
);

export default SkeletonLoader;
