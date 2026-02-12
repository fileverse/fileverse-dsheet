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
      <PopoverTrigger data-testid="smart-contract-popover-trigger">
        <div role="button" className="dsheet-btn dsheet-btn--smart-contract-trigger p-2 rounded-lg bg-[#fef2ef]" data-testid="smart-contract-trigger">
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
        className="dsheet-smart-contract-popover export-content-popover !w-[235px]"
        elevation={2}
        side="bottom"
        sideOffset={4}
        data-testid="smart-contract-popover-content"
      >
        <div className="p-2 w-full dsheet-smart-contract-actions" data-testid="smart-contract-actions">
          {!isAuthorized && (
            <div
              onClick={() => {
                document.getElementById('triggerAuth')?.click();
                const url = new URL(window.location.href);
                url.searchParams.set('sc', 'true');
                window.history.replaceState({}, '', url.toString());
                setOpen(false);
              }}
              className="dsheet-text-block w-full flex cursor-pointer rounded-md flex-col p-2"
              style={{ marginBottom: '8px', backgroundColor: '#F8F9FA' }}
              data-testid="smart-contract-auth-prompt"
            >
              <p className="dsheet-text dsheet-text--body font-size-2xsm font-medium text-[12px] leading-[16px] color-text-default" data-testid="smart-contract-required-message">
                dSheets account required
              </p>
              <p className="dsheet-text dsheet-text--helper text-helper-text-sm mt-1 color-text-secondary" data-testid="smart-contract-signup-message">
                <a className="inline color-text-link">Signup/Login </a> to be
                able to access smart contracts.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (isAuthorized) {
                handleImportSmartContract();
                setOpen(false);
              }
            }}
            className="dsheet-btn dsheet-btn--import-smart-contract hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
            data-testid="smart-contract-import-button"
          >
            <LucideIcon
              name="FileExport"
              className={`w-[17px] h-[17px] ${!isAuthorized && 'color-text-secondary cursor-not-allowed'}`}
            />
            <span
              className={`dsheet-text dsheet-text--body text-body-sm ${!isAuthorized && 'color-text-secondary cursor-not-allowed'} `}
            >
              Import Smart Contract
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isAuthorized) {
                handleViewSmartContract();
                setOpen(false);
              }
            }}
            className="dsheet-btn dsheet-btn--view-smart-contract hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
            data-testid="smart-contract-view-button"
          >
            <LucideIcon
              name="FileKey2"
              className={`w-[17px] h-[17px] ${!isAuthorized && 'color-text-secondary cursor-not-allowed'}`}
            />
            <span
              className={`dsheet-text dsheet-text--body text-body-sm ${!isAuthorized && 'color-text-secondary cursor-not-allowed'} `}
            >
              My Smart Contract
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
