import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  LucideIcon,
  IconButton,
} from '@fileverse/ui';
import { ChangeEventHandler } from 'react';

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
  return (
    <Popover
      onOpenChange={(open) => {
        setExportDropdownOpen(open);
      }}
    >
      <PopoverTrigger
        onChange={() => {
          console.log('handleXLSXUpload');
        }}
      >
        <IconButton
          className="export-button"
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
          <h1 className="export-label-header pl-2">Export</h1>
          <button
            onClick={() => handleExportToJSON()}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon name="FileExport" className="w-5 h-5" />
            <span className="text-sm">Export to JSON</span>
          </button>

          <button
            onClick={() => handleExportToXLSX()}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon name="FileExport" className="w-5 h-5" />
            <span className="text-sm">Export to XLSX</span>
          </button>

          <button
            onClick={() => handleExportToCSV()}
            className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
          >
            <LucideIcon name="FileExport" className="w-5 h-5" />
            <span className="text-sm">Export to CSV</span>
          </button>
        </div>
        <div className="p-2 color-text-default">
          <h1 className="export-label-header pl-2">Import</h1>
          <div className="btn">
            <button className="hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition">
              <LucideIcon name="FileImport" className="w-5 h-5" />
              <label
                htmlFor="xlsx-upload"
                className="export-label w-full cursor-pointer"
              >
                <p>Import XLSX</p>
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
              <LucideIcon name="FileImport" className="w-5 h-5" />
              <label
                htmlFor="csv-upload"
                className="export-label w-full cursor-pointer"
              >
                <p>Import CSV</p>
              </label>
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
