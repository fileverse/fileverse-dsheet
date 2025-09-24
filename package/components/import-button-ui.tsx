import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { ChangeEventHandler, useState } from 'react';
import { LucideIcon, IconButton, DynamicModal, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@fileverse/ui';

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
  handleCSVUpload:
  (event: ChangeEventHandler<HTMLInputElement> | undefined, file: any, importType: string) => void;
  handleXLSXUpload: (event: ChangeEventHandler<HTMLInputElement> | undefined, file: any, importType: string) => void;
  handleExportToXLSX: () => void;
  handleExportToCSV: () => void;
  handleExportToJSON: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openImportTypeModal, setOpenImportTypeModal] = useState(false);
  const [importType, setImportType] = useState('new-dsheet');
  const [file, setFile] = useState<any>(null);
  const [extension, setExtension] = useState('');

  const handleApplyData = () => {
    if (extension === 'xlsx') {
      if (file && importType === 'new-dsheet') {
        const url = URL.createObjectURL(file);
        setTimeout(() => {
          window.open(
            `/sheet/create?xlsx=${encodeURIComponent(url)}`,
            '_blank'
          );
        }, 0);
      } else {
        handleXLSXUpload(undefined, file, importType);
      }
    } else {
      if (file && importType === 'new-dsheet') {
        const url = URL.createObjectURL(file);
        setTimeout(() => {
          window.open(
            `/sheet/create?csv=${encodeURIComponent(url)}`,
            '_blank'
          );
        }, 0);
      } else {
        handleCSVUpload(undefined, file, importType);
      }
    }
    setOpenImportTypeModal(false);
  }

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
        className="w-72 export-content-popover"
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
                setExtension('xlsx');
                setFile(e.target.files?.[0]);
                setOpenImportTypeModal(true);
                setIsOpen(false);
              }}
              style={{ display: 'none' }}
            />
          </div>
          <div className="btn">
            <input
              type="file"
              accept=".csv"
              id="csv-upload"
              onChange={(e) => {
                setExtension('csv');
                setFile(e.target.files?.[0]);
                setOpenImportTypeModal(true);
                setIsOpen(false);
              }}
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
      <DynamicModal
        open={openImportTypeModal}
        onOpenChange={setOpenImportTypeModal}
        className="rounded-lg"
        contentClassName="!pt-4 px-6"
        title={
          <div className="font-medium text-lg leading-6">Import file</div>
        }
        content={
          <div className="flex flex-col gap-4 font-normal text-sm leading-5">
            <div>
              <div className='text-heading-xsm mb-[4px]'>File name</div>
              <div className='h-[36px] p-2 border border-gray-200 rounded color-bg-disabled flex items-center'>
                <p className='text-body-sm'>{file?.name}</p>
              </div>
            </div>

            <Select onValueChange={(value) => {
              setImportType(value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Create new dSheet" />
              </SelectTrigger>
              <SelectContent id="publish-category">
                {[{ id: 'new-dsheet', label: 'Create new dSheet' }, { id: 'merge-current-dsheet', label: 'Insert new sheet(s)' }, { id: 'new-current-dsheet', label: 'Replace sheet(s)' }].map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end items-center gap-2">
              <Button
                className="font-medium text-sm leading-5 px-3 py-2 w-20 min-w-[80px] h-10 min-h-10 max-h-10 rounded"
                size="lg"
                variant="secondary"
                onClick={() => setOpenImportTypeModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="font-medium text-sm leading-5 px-3 py-2 w-20 min-w-[100px] h-10 min-h-10 max-h-10 rounded"
                size="lg"
                onClick={handleApplyData}
              >
                Import data
              </Button>
            </div>
          </div>
        }
      />
    </Popover>
  );
};
