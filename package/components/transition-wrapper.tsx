import { useState, useEffect } from 'react';
import cn from 'classnames';

interface TransitionWrapperProps {
  /** Whether the component should be shown */
  show: boolean;
  /** The content to be rendered with transition */
  children: React.ReactNode;
  /** Optional duration in milliseconds, defaults to 500 */
  duration?: number;
  /** Optional custom transition classes */
  transitionClasses?: string;
}

/**
 * A wrapper component that provides smooth enter/exit transitions for its children
 * using opacity and transform animations.
 */
export const TransitionWrapper = ({
  show,
  children,
  duration = 500,
  transitionClasses,
}: TransitionWrapperProps) => {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready before starting fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for fade out to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 transition-opacity ease-in-out',
        isVisible ? 'opacity-100' : 'opacity-0',
        transitionClasses,
      )}
      style={{
        willChange: 'opacity',
        pointerEvents: isVisible ? 'auto' : 'none',
        transitionDuration: `${duration}ms`,
        transitionProperty: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
};
