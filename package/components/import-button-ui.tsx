import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { ChangeEventHandler, useState } from 'react';
import { LucideIcon, IconButton, DynamicModal, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@fileverse/ui';

import './import-button.scss';
const MAX_FILE_SIZE = 4 * 1024 * 1024;

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
        className="dsheet-btn dsheet-export-trigger hover:bg-red"
        style={{ backgroundColor: 'red!important' }}
        data-testid="export-popover-trigger"
      >
        {/* export-button is used in use xocument style */}
        <IconButton
          className="export-button dsheet-btn-icon hover:bg-red"
          icon="FileExport"
          variant="ghost"
          size="md"
          data-testid="export-dropdown-button"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        alignOffset={0}
        className="w-72 export-content-popover dsheet-export-popover"
        elevation={2}
        side="bottom"
        sideOffset={4}
        data-testid="export-import-popover-content"
      >
        <div
          onClick={() => setIsOpen(false)}
          className="p-2 color-text-default dsheet-export-section"
          data-testid="export-section"
        >
          <h2 className="dsheet-heading dsheet-heading--section text-helper-text-sm color-text-secondary pl-2" data-testid="export-heading">
            Export
          </h2>
          <button
            type="button"
            onClick={() => handleExportToJSON()}
            className="dsheet-btn dsheet-btn--export-json hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
            data-testid="export-json-button"
          >
            <LucideIcon name="FileExport" className="w-[17px] h-[17px]" />
            <span className="dsheet-text dsheet-text--body text-body-sm">Export to .json</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportToXLSX()}
            className="dsheet-btn dsheet-btn--export-xlsx hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
            data-testid="export-xlsx-button"
          >
            <LucideIcon name="FileExport" className="w-[17px] h-[17px]" />
            <span className="dsheet-text dsheet-text--body text-body-sm">Export to .xlsx</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportToCSV()}
            className="dsheet-btn dsheet-btn--export-csv hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition"
            data-testid="export-csv-button"
          >
            <LucideIcon name="FileExport" className="w-[17px] h-[17px]" />
            <span className="dsheet-text dsheet-text--body text-body-sm">Export to .csv</span>
          </button>
        </div>
        <div
          className="p-2 color-text-default dsheet-import-section"
          data-testid="import-section"
        // onClick={() => setIsOpen(false)}
        >
          <h2 className="dsheet-heading dsheet-heading--section text-helper-text-sm color-text-secondary pl-2" data-testid="import-heading">
            Import
          </h2>
          <div className="btn dsheet-import-actions">
            <button type="button" className="dsheet-btn dsheet-btn--import-xlsx hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition" data-testid="import-xlsx-button">
              <LucideIcon name="FileImport" />
              <label
                htmlFor="xlsx-upload"
                className="dsheet-label text-body-sm w-full cursor-pointer"
              >
                <span className="dsheet-text dsheet-text--body">Import .xlsx</span>
              </label>
            </button>
            <input
              type="file"
              accept=".xlsx"
              id="xlsx-upload"
              data-testid="import-xlsx-input"
              onChange={(e) => {
                setExtension('xlsx');
                setFile(e.target.files?.[0]);
                setOpenImportTypeModal(true);
                setIsOpen(false);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
          </div>
          <div className="btn dsheet-import-actions">
            <input
              type="file"
              accept=".csv"
              id="csv-upload"
              data-testid="import-csv-input"
              onChange={(e) => {
                setExtension('csv');
                setFile(e.target.files?.[0]);
                setOpenImportTypeModal(true);
                setIsOpen(false);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <button type="button" className="dsheet-btn dsheet-btn--import-csv hover:color-bg-default-hover h-8 rounded p-2 w-full text-left flex items-center justify-start space-x-2 transition" data-testid="import-csv-button">
              <LucideIcon width={18} height={18} name="FileImport" />
              <label
                htmlFor="csv-upload"
                className="dsheet-label text-body-sm w-full cursor-pointer"
              >
                <span className="dsheet-text dsheet-text--body">Import .csv</span>
              </label>
            </button>
          </div>
        </div>
      </PopoverContent>
      <DynamicModal
        hasCloseIcon
        open={openImportTypeModal}
        onOpenChange={setOpenImportTypeModal}
        className="dsheet-modal dsheet-modal--import rounded-lg max-w-[420px]"
        contentClassName="!pt-4 px-6"
        title={
          <div className="dsheet-heading dsheet-heading--modal font-medium text-lg leading-6" data-testid="import-modal-title">Import file</div>
        }
        content={
          <div className="dsheet-modal-content flex flex-col gap-4 font-normal text-sm leading-5" data-testid="import-modal-content">
            <div className="dsheet-modal-field" data-testid="import-modal-filename-field">
              <div className="dsheet-label dsheet-label--heading text-heading-xsm mb-[4px]">File name</div>
              <div className="dsheet-input-wrap h-[36px] p-2 border border-gray-200 rounded color-bg-disabled flex items-center">
                <p className="dsheet-text dsheet-text--body text-body-sm color-text-disabled truncate-text" data-testid="import-modal-filename">{file?.name}</p>
              </div>
              {file?.size > MAX_FILE_SIZE && (
                <p className="dsheet-text dsheet-text--error text-[hsla(var(--color-text-danger))] font-[`Helvetica_Neue`] text-[14px] font-normal mt-[4px] leading-[20px]" data-testid="import-modal-file-size-error">
                  Can't import this file right now. Try again later.
                </p>
              )}
            </div>

            <div className="dsheet-modal-field" data-testid="import-modal-location-field">
              <div className="dsheet-label dsheet-label--heading text-heading-xsm mb-[4px]">Import location</div>

              <Select onValueChange={(value) => {
                setImportType(value);
              }}>
                <SelectTrigger data-testid="import-location-trigger">
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
            </div>
            <div className="dsheet-modal-actions flex justify-end items-center gap-2" data-testid="import-modal-actions">
              <Button
                className="dsheet-btn dsheet-btn--secondary font-medium text-sm leading-5 px-3 py-2 w-20 min-w-[80px] h-10 h-[36px] max-h-10 rounded"
                size="md"
                variant="secondary"
                onClick={() => setOpenImportTypeModal(false)}
                data-testid="import-modal-cancel-button"
              >
                Cancel
              </Button>
              <Button
                disabled={!file || file?.size > MAX_FILE_SIZE}
                className="dsheet-btn dsheet-btn--primary font-medium text-sm leading-5 px-3 py-2 w-20 min-w-[100px] h-10 h-[36px] max-h-10 rounded"
                size="md"
                onClick={handleApplyData}
                data-testid="import-modal-submit-button"
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
