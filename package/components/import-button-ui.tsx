import { Popover, PopoverContent, PopoverTrigger } from '@fileverse/ui';
import { ChangeEventHandler } from 'react';
import icon from '../assets/icon.svg';
import './import-button.scss';

export const CustomButton = ({
  handleCSVUpload,
  handleXLSXUpload,
  handleExportToXLSX,
  handleExportToCSV,
  handleExportToJSON,
}: {
  handleCSVUpload: ChangeEventHandler<HTMLInputElement>;
  handleXLSXUpload: ChangeEventHandler<HTMLInputElement>;
  handleExportToXLSX: Function;
  handleExportToCSV: Function;
  handleExportToJSON: Function;
}) => {
  return (
    <Popover>
      <PopoverTrigger>
        <div className="fortune-toolbar-custom-btn file-icon">
          <img
            src={icon}
            alt="Icon"
            style={{ width: '20px', height: '20px' }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        alignOffset={0}
        className="w-72 p-2"
        elevation={2}
        side="bottom"
        sideOffset={4}
      >
        <div className="p-2 color-text-default">
          <h1 className="export-text">Export</h1>
          <div onClick={() => handleExportToJSON()} className="btn">
            <p className="text-body-sm mt-2 btn">Export as .json</p>
          </div>
          <div onClick={() => handleExportToXLSX()} className="btn">
            <p className="text-body-sm mt-2 btn">Export as .xlsx</p>
          </div>
          <div onClick={() => handleExportToCSV()} className="btn">
            <p className="text-body-sm mt-2 btn">Export as .csv</p>
          </div>
        </div>
        <div className="p-2 color-text-default">
          <h1 className="export-text">Import</h1>
          <div className="btn">
            <label htmlFor="xlsx-upload" className="text-body-sm mt-2 btn">
              Import .xlsx
            </label>
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
            <label htmlFor="csv-upload">
              <p className="text-body-sm mt-2 btn">Import .csv</p>
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
