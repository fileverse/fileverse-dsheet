import React from 'react';
import { Tag } from '@fileverse/ui';

export interface Template {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  fullImage: string;
  category?: string;
  isProTemplate: boolean;
  techStack: { name: string; image: string }[];
}

export const TemplateCard = ({
  template,
  onMouseEnter,
  onMouseLeave,
  onSelect,
}: {
  template: Template;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onSelect: () => void;
}) => (
  <div
    className="flex flex-col flex-shrink-0 gap-3 p-3 rounded-lg border color-bg-default hover:color-bg-default-hover hover:shadow-xl shadow-[rgba(0,0,0,0.3)] color-border-default cursor-pointer transition-all max-h-[245px]"
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onClick={onSelect}
    role="button"
    tabIndex={0}
    aria-label={`Select ${template.title} template`}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        onSelect();
      }
    }}
  >
    <div className="relative max-h-[142px]">
      <img
        width={300}
        height={200}
        src={template.thumbnail}
        alt={template.title}
        className="object-cover min-h-[80px] rounded max-h-[142px]"
      />
      {template.isProTemplate && (
        <div className="absolute top-1 right-1">
          <Tag className="!h-[20px] flex items-center justify-center text-xs font-normal leading-4 rounded-full">
            Pro template
          </Tag>
        </div>
      )}
    </div>

    <div className="flex justify-between items-center">
      <div className="flex flex-col gap-[2px]">
        <p className="color-text-default text-heading-xsm">{template.title}</p>
        <p className="text-helper-text-sm color-text-secondary">
          {template.category}
        </p>
      </div>
    </div>
  </div>
);

export const TemplatePreview = ({ template }: { template: Template }) => (
  <div
    className="fixed z-50 pointer-events-none"
    style={{
      right: '340px',
      top: '50%',
      transform: 'translateY(-50%)',
      animation: 'float 3s ease-in-out infinite',
    }}
  >
    <div className="color-bg-default rounded-lg shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-2 border color-border-default w-[750px] h-[500px] relative transition-all duration-300 ease-in-out">
      <img
        src={template.fullImage}
        alt={`${template.title} preview`}
        className="object-contain p-2 absolute inset-0 w-full h-full"
      />
      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary/10 rounded-full blur-md"></div>
      <div className="absolute -top-2 -left-2 w-6 h-6 bg-primary/10 rounded-full blur-md"></div>
    </div>
  </div>
);
