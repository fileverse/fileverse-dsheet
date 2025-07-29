import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { LucideIcon } from '@fileverse/ui';

import './import-button.scss';

export const SmartContractButton = ({
  handleImportSmartContract,
  handleViewSmartContract,
}: {
  handleImportSmartContract: () => void;
  handleViewSmartContract: () => void;
}) => {
  return (
    <Popover>
      <PopoverTrigger
        className="hover:bg-red"
        style={{ backgroundColor: 'red!important' }}
      >
        <div role="button" className="p-2 rounded-md hover:bg-[#fef2ef]">
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
        className="!w-[220px] export-content"
        elevation={2}
        side="bottom"
        sideOffset={4}
      >
        <div className="p-2 color-text-default">
          <button
            onClick={() => handleImportSmartContract()}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon name="FileExport" className="w-[17px] h-[17px]" />
            <span className="text-body-sm">Import Smart Contract</span>
          </button>

          <button
            onClick={() => handleViewSmartContract()}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon name="FileExport" className="w-[17px] h-[17px]" />
            <span className="text-body-sm">My Smart Contract</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
