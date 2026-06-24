import type { WorkbookInstance } from '@sheet-engine/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SpreadsheetFunction } from './types';
import {
  CategoryKey,
  getFunctionCategoryKey,
  groupFunctionsByCategory,
} from './function-categories-logic';

const useFunctions = (
  sheetEditorRef: React.RefObject<WorkbookInstance>,
  shouldHandleSuggestionFromCell: number
) => {
  const [localeContext, setLocaleContext] = useState<any | null>(null);

  const handleLearnMoreFromSuggestion = useCallback(() => {
    const workbook = sheetEditorRef.current?.getWorkbookContext();

    if (!workbook) return;
    const fn =
      workbook.formulaCache.functionlistMap[
        // @ts-ignore
        workbook.functionHint
      ];
    if (fn) setSearchText(fn.n);
  }, [sheetEditorRef]);

  useEffect(() => {
    if (shouldHandleSuggestionFromCell) {
      handleLearnMoreFromSuggestion();
    }
  }, [handleLearnMoreFromSuggestion, shouldHandleSuggestionFromCell]);
  useEffect(() => {
    const initialiseFunctionState = () => {
      const locale = sheetEditorRef.current?.getLocaleContext?.();
      if (!locale) return false;
      handleLearnMoreFromSuggestion();
      setLocaleContext(locale);
      return true;
    };
    if (initialiseFunctionState()) return;
    const interval = setInterval(() => {
      if (initialiseFunctionState()) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [handleLearnMoreFromSuggestion, sheetEditorRef]);
  const allFunctions = useMemo<SpreadsheetFunction[]>(() => {
    return localeContext?.functionlist || [];
  }, [localeContext]);

  const groupedFunctions = useMemo(() => {
    return groupFunctionsByCategory(allFunctions);
  }, [allFunctions]);

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('All');

  const [selectedFunction, setSelectedFunction] =
    useState<SpreadsheetFunction | null>(null);
  const [functionIndex, setFunctionIndex] = useState(0);
  const [searchText, setSearchText] = useState('');

  const filteredFunctionList = useMemo(() => {
    const query = searchText.trim();
    const queryUpper = query.toUpperCase();

    const matches = (fn: SpreadsheetFunction) => {
      if (!queryUpper) return true;
      return String(fn?.n || '')
        .toUpperCase()
        .includes(queryUpper);
    };

    // No search: keep category filtering behavior.
    if (!queryUpper) {
      return groupedFunctions.byCategory.get(selectedCategory) ?? [];
    }

    // Searching: search is global, but sort to show selected category results first.
    const list = allFunctions.filter(matches);

    return list.slice().sort((a, b) => {
      const aKey = getFunctionCategoryKey(String(a?.n || ''), Number(a?.t));
      const bKey = getFunctionCategoryKey(String(b?.n || ''), Number(b?.t));
      const aInSelected = aKey === selectedCategory;
      const bInSelected = bKey === selectedCategory;
      if (aInSelected !== bInSelected) return aInSelected ? -1 : 1;

      return String(a.n || '').localeCompare(String(b.n || ''), undefined, {
        sensitivity: 'base',
      });
    });
  }, [allFunctions, groupedFunctions.byCategory, searchText, selectedCategory]);

  // Keep selection + index stable as the list changes.
  useEffect(() => {
    if (!filteredFunctionList.length) {
      setSelectedFunction(null);
      setFunctionIndex(0);
      return;
    }

    if (!selectedFunction) {
      setSelectedFunction(filteredFunctionList[0]);
      setFunctionIndex(0);
      return;
    }

    const idx = filteredFunctionList.findIndex(
      (fn) => fn.n === selectedFunction.n
    );
    if (idx === -1) {
      setSelectedFunction(filteredFunctionList[0]);
      setFunctionIndex(0);
      return;
    }

    setFunctionIndex(idx);
  }, [filteredFunctionList, selectedFunction]);

  const selectedCategoryName = useMemo(() => {
    return selectedCategory;
  }, [selectedCategory]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dune')) setSearchText('dune');
    else if (params.get('lq')) setSearchText('coingecko');
    else if (params.get('price')) setSearchText('price');
  }, []);
  return {
    filteredFunctionList,
    functionIndex,
    setFunctionIndex,
    setSearchText,
    selectedFunction,
    groupedFunctions,
    setSelectedCategory,
    setSelectedFunction,
    searchText,
    selectedCategoryName,
  };
};

export default useFunctions;
