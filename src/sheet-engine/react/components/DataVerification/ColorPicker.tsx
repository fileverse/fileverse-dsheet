import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  IconButton,
} from '@fileverse/ui';

export const TEXT_COLORS = [
  { name: 'Light Gray', value: '228, 232, 237' },
  { name: 'White', value: '219, 233, 236' },
  { name: 'Pink', value: '244, 217, 227' },
  { name: 'Peach', value: '247, 229, 207' },
  { name: 'Blue', value: '217, 234, 244' },
  { name: 'Green', value: '222, 239, 222' },
  { name: 'Light Green', value: '239, 239, 239' },
  { name: 'Rose', value: '244, 230, 230' },
  { name: 'Yellow', value: '247, 239, 217' },
  { name: 'Purple', value: '230, 230, 244' },
  { name: 'Cyan', value: '217, 244, 244' },
  { name: 'Cream', value: '244, 239, 234' },
];

export const ColorSection = ({
  onPick,
  trigerColor,
}: {
  onPick: (color: string) => void;
  trigerColor: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
      }}
    >
      <PopoverTrigger
        className="hover:bg-red"
        style={{ backgroundColor: 'red!important' }}
      >
        <div
          className="flex items-center justify-between  color-picker rounded transition-all cursor-pointer border border-gray-300"
          style={{
            padding: '7px',
            border:
              'var(--border-width-md, 1px) solid hsl(var(--color-border-default, #E8EBEC))',
            borderRadius: 'var(--border-radius-sm, 4px)',
          }}
        >
          <div className="flex items-center gap-3 color-text-secondary">
            <div
              className="w-5 h-5 rounded-full"
              style={{
                backgroundColor: `rgb(${trigerColor})`,
              }}
            />
            <ChevronDown
              size={18}
              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        alignOffset={0}
        className="color-picker-container"
        elevation={2}
        side="bottom"
        sideOffset={4}
      >
        <div className="transition-all p-2 duration-200 w-full">
          <div className="flex gap-2 flex-wrap w-full">
            {TEXT_COLORS.map((color) => (
              <div
                key={color.value}
                className="w-7 h-7 rounded-full transition-all hover:scale-110 hover:shadow-md"
                style={{
                  border:
                    `${color.value}` === trigerColor
                      ? `2px solid rgb(${color.value})`
                      : 'none',
                  padding: '2px',
                }}
              >
                {/* eslint-disable-next-line  jsx-a11y/control-has-associated-label */}
                <button
                  type="button"
                  key={color.value}
                  onClick={() => {
                    onPick(color.value);
                    setIsOpen(false);
                  }}
                  className="w-full h-full rounded-full transition-all hover:scale-110 hover:shadow-md"
                  style={
                    {
                      backgroundColor: `rgb(${color.value})`,
                    } as React.CSSProperties
                  }
                  title={color.name}
                />
              </div>
            ))}
            <div
              className="w-full flex justify-center color-picker-reset-btn"
              onClick={() => {
                onPick('228, 232, 237');
                setIsOpen(false);
              }}
            >
              <IconButton
                icon="DropletOff"
                size="sm"
                variant="ghost"
                className="color-picker-icon"
              />
              <Button size="md" variant="ghost" className="color-picker-reset">
                Reset
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
