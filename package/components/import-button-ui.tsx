import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { ChangeEventHandler, useState } from 'react';
import { LucideIcon, IconButton } from '@fileverse/ui';

import './import-button.scss';

export const CustomButton = ({
  setExportDropdownOpen,
  handleCSVUpload,
  handleXLSXUpload,
  handleExportToXLSX,
  handleExportToCSV,
  handleExportToJSON,
}: {
  setExportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleCSVUpload: ChangeEventHandler<HTMLInputElement>;
  handleXLSXUpload: ChangeEventHandler<HTMLInputElement>;
  handleExportToXLSX: () => void;
  handleExportToCSV: () => void;
  handleExportToJSON: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setExportDropdownOpen(open);
      }}
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
        <div
          onClick={() => setIsOpen(false)}
          className="p-2 color-text-default"
        >
          <h1 className="text-helper-text-sm color-text-secondary pl-2">
            Export
          </h1>
          <button
            onClick={() => handleExportToJSON()}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon name="FileExport" className="w-[17px] h-[17px]" />
            <span className="text-body-sm">Export to .json</span>
          </button>

          <button
            onClick={() => handleExportToXLSX()}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon name="FileExport" className="w-[17px] h-[17px]" />
            <span className="text-body-sm">Export to .xlsx</span>
          </button>

          <button
            onClick={() => handleExportToCSV()}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon name="FileExport" className="w-[17px] h-[17px]" />
            <span className="text-body-sm">Export to .csv</span>
          </button>
        </div>
        <div
          onClick={() => setIsOpen(false)}
          className="p-2 color-text-default"
        >
          <h1 className="text-helper-text-sm color-text-secondary pl-2">
            Import
          </h1>
          <div className="btn">
            <button className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition">
              <LucideIcon name="FileImport" />
              <label
                htmlFor="xlsx-upload"
                className="text-body-sm w-full cursor-pointer"
              >
                <p>Import .xlsx</p>
              </label>
            </button>
            <input
              type="file"
              accept=".xlsx"
              id="xlsx-upload"
              onChange={(e) => {
                console.log('handleXLSXUpload');
                handleXLSXUpload(e);
              }}
              style={{ display: 'none' }}
            />
          </div>
          <div className="btn">
            <input
              type="file"
              accept=".csv"
              id="csv-upload"
              onChange={handleCSVUpload}
              style={{ display: 'none' }}
            />
            <button className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition">
              <LucideIcon width={18} height={18} name="FileImport" />
              <label
                htmlFor="csv-upload"
                className="text-body-sm w-full cursor-pointer"
              >
                <p>Import .csv</p>
              </label>
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
