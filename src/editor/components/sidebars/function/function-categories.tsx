import React from 'react';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@fileverse/ui';

const FunctionCategories = ({
  onCategorySelection,
  categories,
  categoryName,
}: {
  onCategorySelection: (value: string) => void;
  categoryName: string;
  categories: string[];
}) => {
  return (
    <>
      <Select onValueChange={onCategorySelection}>
        <SelectTrigger className="h-[32px]">
          <SelectValue placeholder={categoryName} />
        </SelectTrigger>

        <SelectContent>
          {categories.map((categoryKey) => (
            <SelectItem
              key={categoryKey}
              value={categoryKey}
              className="h-[32px]"
            >
              {categoryKey}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
};

export default FunctionCategories;
