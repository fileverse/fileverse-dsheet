import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { LucideIcon, IconButton } from '@fileverse/ui';

import './import-button.scss';

export const SmartContractButton = ({
  // setSmartContractDropdownOpen,
  handleImportSmartContract,
  handleViewSmartContract,
}: {
  // setSmartContractDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleImportSmartContract: () => void;
  handleViewSmartContract: () => void;
}) => {
  return (
    <Popover
    // onOpenChange={(open) => {
    //   setSmartContractDropdownOpen(open);
    // }}
    >
      <PopoverTrigger
        className="hover:bg-red"
        style={{ backgroundColor: 'red!important' }}
      >
        {/* export-button is used in use xocument style */}
        <IconButton
          className="export-button hover:bg-red"
          icon="FileExport"
          variant="ghost"
          size="md"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        alignOffset={0}
        className="w-72 export-content"
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
