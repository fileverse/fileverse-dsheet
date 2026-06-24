import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { cn, IconButton, LucideIcon, Tag, TextField } from '@fileverse/ui';
import { Template, TemplateCard } from './template-ui';

interface TemplatesProps {
  setSelectedTemplate: (template: string) => void;
  setHoveredTemplate: React.Dispatch<React.SetStateAction<Template | null>>;
}

const getTemplateCategories = (templates: Template[]) => {
  const uniqueCategories = Array.from(
    new Set(
      templates
        .map((template) => template.category?.trim())
        .filter((category): category is string => Boolean(category))
    )
  );

  return [
    { name: 'ALL', value: 'all' },
    ...uniqueCategories.map((category) => ({
      name: category,
      value: category.toLowerCase(),
    })),
  ];
};

export const Templates = ({
  setSelectedTemplate,
  setHoveredTemplate,
}: TemplatesProps) => {
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAllCategories, setShowAllCategories] = useState(false);

  useEffect(() => {
    let isMounted = true;

    import('@fileverse-dev/dsheets-templates/template-metadata-list').then(
      (module) => {
        if (isMounted) {
          setAllTemplates(module.TEMPLATES as Template[]);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(
    () => getTemplateCategories(allTemplates),
    [allTemplates]
  );

  const handleCategorySelect = useCallback(
    (category: string) => {
      setSelectedCategory(category === selectedCategory ? 'all' : category);
    },
    [selectedCategory]
  );

  const handleShowAllCategories = useCallback(() => {
    setShowAllCategories((prev) => !prev);
  }, []);

  const displayedCategories = useMemo(() => {
    return showAllCategories ? categories : categories.slice(0, 3);
  }, [categories, showAllCategories]);

  const handleMouseEnter = useCallback((id: string) => {
    setHoveredImage(id);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredImage(null);
  }, []);

  const handleTemplateSelect = useCallback(
    (slug: string) => {
      setSelectedTemplate(slug);
    },
    [setSelectedTemplate]
  );

  const filteredTemplates = useMemo(() => {
    const searchLower = search.toLowerCase();
    const categoryLower = selectedCategory.toLowerCase();

    return allTemplates.filter((template) => {
      const matchesSearch =
        template.title?.toLowerCase().includes(searchLower) ||
        template.description?.toLowerCase().includes(searchLower);

      const templateCategory = template.category?.toLowerCase() ?? '';
      const matchesCategory =
        selectedCategory === 'all' ||
        !selectedCategory ||
        templateCategory === categoryLower;

      return matchesSearch && matchesCategory;
    });
  }, [allTemplates, search, selectedCategory]);

  const hoveredTemplate = hoveredImage
    ? allTemplates.find((template) => template.slug === hoveredImage)
    : null;

  useEffect(() => {
    if (hoveredTemplate) {
      // @ts-ignore
      setHoveredTemplate(hoveredTemplate);
    } else {
      setHoveredTemplate(null);
    }
  }, [hoveredTemplate, setHoveredTemplate]);

  return (
    <div
      className="flex-1 min-h-0 m-4 flex flex-col gap-4 overflow-hidden"
      role="region"
      aria-label="Template selection"
    >
      {/* <h2 className="text-heading-xsm mb-2 pl-[3px] force-font">
        Start with pre-builded templates
      </h2>
      <h3 className="text-body-sm mb-5 pl-[3px] text-[#363B3F] force-font">
        Includes smart contract analysis, real time coins price and much more
        for blockchain analytics
      </h3> */}
      <TextField
        placeholder="Search templates"
        className="w-full rounded color-text-secondary !pl-10"
        leftIcon={
          <LucideIcon
            name="Search"
            width={16}
            height={16}
            className="color-icon-secondary"
          />
        }
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flex justify-between">
        <div className="flex gap-1 items-center flex-wrap">
          {displayedCategories.map((category) => (
            <Tag
              key={category.value}
              className={cn(
                'bg-transparent px-2 py-2 rounded-lg text-helper-text-sm border-[#E8EBEC] color-border-default hover:cursor-pointer',
                selectedCategory === category.value &&
                  '!bg-[#000] !text-[#fff] border-none'
              )}
              onClick={() => handleCategorySelect(category.value)}
            >
              {category.name}
            </Tag>
          ))}
        </div>
        <IconButton
          icon="ChevronDown"
          variant="ghost"
          className={cn(
            'hover:cursor-pointer transition-transform !bg-transparent',
            showAllCategories && 'rotate-180'
          )}
          onClick={handleShowAllCategories}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
        {filteredTemplates.length === 0 ? (
          <div className="flex items-center justify-center h-full text-helper-text-sm color-text-secondary">
            No templates found
          </div>
        ) : (
          filteredTemplates.map((template, index) => (
            <TemplateCard
              key={template.slug || index}
              template={template as Template}
              onMouseEnter={() => handleMouseEnter(template.slug)}
              onMouseLeave={handleMouseLeave}
              onSelect={() => handleTemplateSelect(template.slug)}
            />
          ))
        )}
      </div>
    </div>
  );
};
