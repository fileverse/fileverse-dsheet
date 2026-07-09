import React from 'react';
import { Button, LucideIcon, cn } from '@fileverse/ui';

interface FileUploadSectionProps {
  uploadedFile: any;
  uploadProgress: number;
  isUploading: boolean;
  handleRemoveFile: () => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  uploadedFile,
  uploadProgress,
  isUploading,
  handleRemoveFile,
  handleFileInputChange,
  fileInputRef,
}) => (
  <div>
    <h2 className="mb-2 text-heading-xsm">Upload ABI .json file</h2>
    {!uploadedFile ? (
      <div className={''}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".json,application/json"
          onChange={handleFileInputChange}
        />
        <Button
          onClick={() => {
            fileInputRef.current?.click();
          }}
          className="flex gap-4 justify-center w-full"
          variant={'secondary'}
        >
          <div className="flex items-center gap-3">
            <LucideIcon name={'Upload'} />
            <p>Upload</p>
          </div>
        </Button>
      </div>
    ) : (
      <div className="flex items-center h-[64px] justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <LucideIcon
            name="FileKey2"
            size="md"
            className={cn('color-icon-secondary')}
          />
          <div>
            <h3 className="text-heading-xsm">{uploadedFile.name}</h3>
            <p className="text-xs text-gray-500">{uploadedFile.size}</p>
          </div>
        </div>
        {uploadProgress === 100 ? (
          <div className="flex gap-4 items-center">
            <div className="text-helper-text-sm color-bg-success-light w-[69px] p-2 rounded-md  color-text-success">
              {' '}
              Uploaded{' '}
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              disabled={isUploading}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  uploadProgress === 100 ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            {isUploading && (
              <span className="text-xs text-gray-500">{uploadProgress}%</span>
            )}
            <button
              onClick={handleRemoveFile}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              disabled={isUploading}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
        )}
      </div>
    )}
    <hr className="w-full color-border-default my-4" />
  </div>
);
