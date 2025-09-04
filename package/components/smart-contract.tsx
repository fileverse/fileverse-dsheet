import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { LucideIcon } from '@fileverse/ui';

import './import-button.scss';
import { useEditor } from '../contexts/editor-context';
import { useState } from 'react';

export const SmartContractButton = ({
  handleImportSmartContract,
  handleViewSmartContract,
}: {
  handleImportSmartContract: () => void;
  handleViewSmartContract: () => void;
}) => {
  const { isAuthorized } = useEditor();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <div role="button" className="p-2 rounded-lg bg-[#fef2ef]">
          <LucideIcon
            name="FileExport"
            size="md"
            className={'cursor-pointer text-[#F95738]'}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        alignOffset={0}
        className="export-content-popover !w-[235px]"
        elevation={2}
        side="bottom"
        sideOffset={4}
      >
        <div className="p-2 w-full">
          {!isAuthorized && (
            <div
              onClick={() => {
                document.getElementById('triggerAuth')?.click();
                const url = new URL(window.location.href);
                url.searchParams.set('sc', 'true');
                window.history.replaceState({}, '', url.toString());
                setOpen(false);
              }}
              className="w-full flex cursor-pointer rounded-md flex-col p-2"
              style={{ marginBottom: '8px', backgroundColor: '#F8F9FA' }}
            >
              <p className="font-size-2xsm font-medium text-[12px] leading-[16px] color-text-default">
                dSheets account required
              </p>
              <p className="text-helper-text-sm mt-1 color-text-secondary">
                <a className="inline color-text-link">Signup/Login </a> to be
                able to access smart contracts.
              </p>
            </div>
          )}

          <button
            onClick={() => {
              if (isAuthorized) {
                handleImportSmartContract();
                setOpen(false);
              }
            }}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon
              name="FileExport"
              className={`w-[17px] h-[17px] ${!isAuthorized && 'color-text-secondary cursor-not-allowed'}`}
            />
            <span
              className={`text-body-sm ${!isAuthorized && 'color-text-secondary cursor-not-allowed'} `}
            >
              Import Smart Contract
            </span>
          </button>

          <button
            onClick={() => {
              if (isAuthorized) {
                handleViewSmartContract();
                setOpen(false);
              }
            }}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon
              name="FileKey2"
              className={`w-[17px] h-[17px] ${!isAuthorized && 'color-text-secondary cursor-not-allowed'}`}
            />
            <span
              className={`text-body-sm ${!isAuthorized && 'color-text-secondary cursor-not-allowed'} `}
            >
              My Smart Contract
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
