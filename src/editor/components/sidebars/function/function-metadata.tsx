import {
  Button,
  LucideIcon,
  TextField,
  Tooltip,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@fileverse/ui';
import { SpreadsheetFunction } from './types';
import { useEffect, useState } from 'react';
import { API_KEY_PLACEHOLDER } from '../../../../sheet-engine/react/constants';
import {
  getApiKey,
  saveApiKey,
  DATABLOCK_API_KEYS,
} from '../../../utils/api-keys-local-storage';

const FunctionMetadata = ({
  selectedFunction,
  onInsert,
}: {
  selectedFunction: SpreadsheetFunction;
  onInsert: () => void;
}) => {
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [appliedApiKey, setAppliedApiKey] = useState(false);
  const [isProxyHovered, setIsProxyHoverd] = useState(false);

  // Check if this function is supported by proxy
  const isProxySupported =
    process.env.NEXT_PUBLIC_PROXY_MODE === 'true' &&
    selectedFunction.API_KEY &&
    DATABLOCK_API_KEYS.includes(selectedFunction.API_KEY);

  // Check if API key is required
  const isApiKeyRequired = selectedFunction.API_KEY && !isProxySupported;

  useEffect(() => {
    setApiKeyValue(getApiKey(selectedFunction.API_KEY));
  }, [selectedFunction.API_KEY]);

  // const [isLimited, setIsLimited] = useState(false);

  const isDatablock = selectedFunction.t === 20;
  return (
    <div className="w-full mt-[4px]">
      <div className="flex w-full justify-between items-center">
        <div className="grow">
          <div className="flex flex-wrap  gap-1 items-center">
            <p className="text-heading-sm">{selectedFunction.n}</p>
            {isDatablock && (
              <div className="flex gap-1 items-center">
                <div className="color-bg-brand px-[4px] font-bold text-[8px] rounded-[4px] py-[2px]">
                  DATABLOCK
                </div>

                {isProxySupported && (
                  <Popover
                    open={isProxyHovered}
                    onOpenChange={setIsProxyHoverd}
                  >
                    <PopoverTrigger className="w-full">
                      <div
                        className="bg-green-100 text-green-800 px-[4px] font-bold text-[8px] rounded-[4px] py-[2px]"
                        onMouseEnter={() => setIsProxyHoverd(true)}
                        onMouseLeave={() => setIsProxyHoverd(false)}
                      >
                        PROXY
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      align="center"
                      className=""
                      elevation={2}
                      side="bottom"
                      sideOffset={20}
                      style={{ maxWidth: '322px', marginLeft: '40px' }}
                    >
                      <div className="bg-green-50 border border-green-200 rounded-md p-3 group-hover:block">
                        <div className="flex items-center gap-2">
                          <LucideIcon
                            name="Zap"
                            className="text-green-600 w-4 h-4"
                          />
                          <p className="text-sm text-green-800 font-medium">
                            Quick Start Mode
                          </p>
                        </div>
                        <p className="text-xs text-green-700 mt-1">
                          No API key needed! We&apos;re using our proxy server
                          so you can test this function immediately.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* API key indicator - only show if required */}
                {isApiKeyRequired && (
                  <Tooltip
                    text={
                      localStorage.getItem(selectedFunction.API_KEY)
                        ? API_KEY_PLACEHOLDER[selectedFunction.API_KEY]
                        : 'API key required'
                    }
                  >
                    <div
                      className={`flex h-[16px] rounded-[4px]  w-[16px] justify-center ${localStorage.getItem(selectedFunction.API_KEY) ? 'bg-[#177E23]' : 'bg-[#e8ebec]'}`}
                    >
                      <LucideIcon
                        name="Key"
                        className={`${localStorage.getItem(selectedFunction.API_KEY) ? 'text-white' : 'text-[#77818A]'} w-[12px] h-[12px]`}
                      />
                    </div>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </div>

        <Button onClick={onInsert} className="min-w-[80px] !h-[30px]">
          Insert
        </Button>
      </div>
      <div className="flex flex-col mt-4 border-t border-dashed pt-4 w-full gap-[12px]">
        <p className="text-body-sm">{selectedFunction.d}</p>

        <div className="w-full mb-[4px]">
          <p className="mb-[8px] font-helvetica text-[hsl(var(--color-text-secondary))] font-sans text-xs font-medium leading-4">
            Syntax
          </p>
          <div className=" bg-[#F2F4F5] break-words w-full leading-[16px] font-medium text-[12px] px-3 py-2 rounded-[4px] border border-[hsl(var(--color-border-default,#E8EBEC))]">
            <code className="">
              <span className="font-medium">={selectedFunction.n}</span>
              <span className="">(</span>
              <span className="">
                {selectedFunction.p.map((param: any, i: number) => (
                  <span
                    key={param.name}
                    className="text-[hsl(var(--color-text-success))]"
                    dir="auto"
                  >
                    {param.example}
                    {i !== selectedFunction.p.length - 1 && ', '}
                  </span>
                ))}
              </span>
              <span className="">)</span>
            </code>
          </div>
        </div>

        <div>
          <p className="mb-2 font-helvetica text-[hsl(var(--color-text-secondary))] font-sans text-xs font-medium leading-4">
            Description
          </p>
          <div className="flex flex-col gap-[12px]">
            {selectedFunction.p.map((data) => {
              return (
                <div key={data.name}>
                  <p className="text-body-sm">
                    <code className="text-[hsl(var(--color-text-default)] font-mono text-sm font-bold leading-5">
                      {data.name}
                      {data.require === 'o' && (
                        <code className="!text-[hsl(var(--color-text-secondary))]">
                          {' '}
                          [optional]
                        </code>
                      )}
                      {': '}
                    </code>

                    {data.detail}
                  </p>
                </div>
              );
            })}
          </div>
          {(selectedFunction.n.includes('SMARTCONTRACT') ||
            selectedFunction.n.includes('smartcontract')) && (
            <div
              className="flex items-center gap-1 color-text-link cursor-pointer text-helper-text-sm mt-3"
              onClick={() => {
                document.getElementById('smartcontract-button')?.click();
              }}
            >
              <div className="">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-circle-question-mark-icon lucide-circle-question-mark"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </div>
              <span className="font-normal text-xs text-[#5c0aff]">
                How to use imported contract?
              </span>
            </div>
          )}
        </div>

        {isDatablock && (
          <div className="flex flex-col w-full border-t mt-[3px] pt-[12px] gap-3">
            <p className="font-medium text-xs text-[#77818a]">Examples</p>
            {selectedFunction?.examples?.map(
              (
                example: {
                  title: string;
                  argumentString: string;
                  description: string;
                },
                index: number
              ) => {
                return (
                  <div className="flex flex-col gap-[4px]" key={index}>
                    <div className="flex items-center gap-[4px] self-stretch bg-[#f8f9fa] p-2 rounded border border-solid border-[#e8ebec] break-all">
                      <code>
                        <span className="font-medium text-xs">
                          ={example.title}(
                          <span className="text-[hsl(var(--color-text-success))]">
                            {example.argumentString}
                          </span>
                          )
                        </span>
                      </code>
                    </div>
                    <p className="text-xs">{example.description}</p>
                  </div>
                );
              }
            )}
          </div>
        )}

        {isDatablock && (
          <div className="w-full border-t mt-[3px] pt-[5px] border-b !pb-[16px]">
            <h1 className="text-body-sm-bold color-text-default mt-2">
              What is Datablock ?
            </h1>
            <p className="text-helper-text-sm color-text-secondary mt-2">
              A datablock is a native data structure allowing dSheets to read
              and structure any data coming from smart contracts or APIs. Anyone
              can contribute to datablocks to make new data sources supported on{' '}
              <a
                href="https://github.com/fileverse/formulajs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--color-text-link))]"
              >
                GitHub
              </a>
              .
            </p>
          </div>
        )}

        {/* API key section */}
        {selectedFunction.API_KEY && (
          <div id={'api-input'}>
            <div className="flex justify-between mb-3 items-center">
              <p className="text-heading-xsm ">
                API key{' '}
                {isApiKeyRequired && <span className=" text-red-500">*</span>}
              </p>
            </div>
            <div className="flex w-full items-center rounded-md border color-border-default hover:color-border-hover bg-transparent">
              <TextField
                className="border-none"
                onChange={(e) => {
                  setApiKeyValue(e.target.value);
                  saveApiKey(selectedFunction.API_KEY, e.target.value);
                }}
                onBlur={() => {
                  setAppliedApiKey(true);
                  setTimeout(() => {
                    setAppliedApiKey(false);
                  }, 5000);
                }}
                value={apiKeyValue}
                placeholder={API_KEY_PLACEHOLDER[selectedFunction.API_KEY]}
              />
              {appliedApiKey && (
                <p className="color-text-success text-helper-text-sm mr-3">
                  Applied!
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default FunctionMetadata;
