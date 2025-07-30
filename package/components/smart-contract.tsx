import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { LucideIcon } from '@fileverse/ui';

import './import-button.scss';
import { useEditor } from '../contexts/editor-context';

export const SmartContractButton = ({
  handleImportSmartContract,
  handleViewSmartContract,
}: {
  handleImportSmartContract: () => void;
  handleViewSmartContract: () => void;
}) => {
  const { isAuthorized } = useEditor();
  return (
    <Popover>
      <PopoverTrigger
        className="hover:bg-red"
        style={{ backgroundColor: 'red!important' }}
      >
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
        className="export-content !w-[235px]"
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
              }}
              style={{ marginBottom: '8px', backgroundColor: '#F8F9FA' }}
              className="w-full flex cursor-pointer rounded-md flex-col p-2"
            >
              <p className=" font-size-2xsm font-medium text-[12px] leading-[16px] color-text-default">
                dSheets account required
              </p>
              <p className="text-helper-text-sm mt-1 color-text-secondary">
                <a className=" inline color-text-link ">Signup/Login </a> to use
                smart contracts lore ipsum dolor sit amet
              </p>
            </div>
          )}
          <button
            onClick={() => isAuthorized && handleImportSmartContract()}
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
            onClick={() => isAuthorized && handleViewSmartContract()}
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
