import React from 'react';
import { TextField, LucideIcon } from '@fileverse/ui';
import FunctionMetadata from './function/function-metadata';
import FunctionCategories from './function/function-categories';
import FunctionList from './function/functionList';
import type { WorkbookInstance } from '@sheet-engine/react';
import useFunctions from './function/use-functions';
import type { CategoryKey } from './function/function-categories-logic';
const FunctionContent = ({
  sheetEditorRef,
  shouldHandleSuggestionFromCell,
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance>;
  shouldHandleSuggestionFromCell: number;
}) => {
  const {
    setSearchText,
    groupedFunctions,
    setSelectedCategory,
    selectedFunction,
    setFunctionIndex,
    filteredFunctionList,
    setSelectedFunction,
    functionIndex,
    searchText,
    selectedCategoryName,
  } = useFunctions(sheetEditorRef, shouldHandleSuggestionFromCell);

  return (
    <div className="h-[calc(100vh-200px)] overflow-y-auto no-scrollbar">
      <div className="p-[12px] flex  flex-col gap-[10px]">
        <TextField
          value={searchText}
          className="!pl-10 h-[32px]"
          leftIcon={<LucideIcon name="Search" size={'sm'} />}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by function name or description"
        />
        <FunctionCategories
          categories={groupedFunctions.categories}
          onCategorySelection={(value) => {
            setSelectedCategory(value as CategoryKey);
          }}
          categoryName={selectedCategoryName}
        />

        <FunctionList
          selectedFunction={selectedFunction}
          list={filteredFunctionList}
          onFunctionSelection={(data, functionIndex) => {
            setSelectedFunction(data);
            setFunctionIndex(functionIndex);
          }}
        />

        {selectedFunction && (
          <FunctionMetadata
            selectedFunction={selectedFunction}
            onInsert={() => {
              if (!sheetEditorRef) return;
              sheetEditorRef.current?.insertFunction(
                functionIndex,
                filteredFunctionList
              );
            }}
          />
        )}
      </div>
    </div>
  );
};

export default FunctionContent;
