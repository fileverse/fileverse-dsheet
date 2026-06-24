import React from 'react';
import { SpreadsheetFunction } from './types';
import { LucideIcon, Tooltip } from '@fileverse/ui';
import { API_KEY_PLACEHOLDER } from '../../../../sheet-engine/react/constants';
import { getFunctionCategoryKey } from './function-categories-logic';

const FunctionList = ({
  list,
  onFunctionSelection,
  selectedFunction,
}: {
  list: SpreadsheetFunction[];
  onFunctionSelection: (
    data: SpreadsheetFunction,
    functionIndex: number
  ) => void;
  selectedFunction: SpreadsheetFunction | null;
}) => {
  return (
    <div className="max-h-[224px] overflow-scroll [scrollbar-width:none] rounded-md border w-full">
      {list.map((data, index) => (
        <div
          key={data.n}
          onClick={() => onFunctionSelection(data, index)}
          className={`h-[28px] w-full flex px-3 items-center py-2 justify-between hover:bg-[#F2F4F5] ${selectedFunction?.n === data.n ? 'bg-[#F2F4F5]' : ''}`}
        >
          <p className="text-body-sm">{data.n}</p>
          <div className="flex items-center gap-1">
            <p className="text-helper-text-sm">
              {getFunctionCategoryKey(String(data?.n || ''), Number(data?.t))}
            </p>

            {data.API_KEY && (
              <Tooltip
                text={
                  localStorage.getItem(data.API_KEY)
                    ? API_KEY_PLACEHOLDER[data.API_KEY]
                    : 'API key required'
                }
              >
                <div
                  className={`flex h-[16px] rounded-[4px]  w-[16px] justify-center ${localStorage.getItem(data.API_KEY) ? 'bg-[#177E23]' : 'bg-[#e8ebec]'}`}
                >
                  <LucideIcon
                    name="Key"
                    className={`${localStorage.getItem(data.API_KEY) ? 'text-white' : 'text-[#77818A]'} w-[12px] h-[12px]`}
                  />
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FunctionList;
