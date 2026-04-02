import cn from 'classnames';
import React, { forwardRef } from 'react';
import { LucideIcons } from './Icon';

export const UltimateIcons = { ...LucideIcons };

export type ButtonSize = 'sm' | 'md' | 'lg';

interface SvgProps extends React.SVGProps<SVGSVGElement> {
  fill?: string;
  stroke?: string;
}

export interface LucideIconProps extends SvgProps {
  name: keyof typeof UltimateIcons;
  className?: string;
  size?: ButtonSize;
  strokeWidth?: number;
}

export const LucideIcon = forwardRef<SVGSVGElement, LucideIconProps>(
  ({ name, className, strokeWidth, size, fill, stroke, ...props }, ref) => {
    const buttonSize =
      size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';

    const IconComponent = UltimateIcons[name];

    if (!IconComponent) {
      return null;
    }

    return (
      <IconComponent
        name={name}
        ref={ref}
        className={cn(buttonSize, className)}
        strokeWidth={strokeWidth || 2}
        fill={fill || 'none'}
        stroke={stroke || 'currentColor'}
        {...props}
      />
    );
  },
);

LucideIcon.displayName = 'LucideIcon';
