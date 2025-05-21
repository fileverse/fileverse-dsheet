// customToolbarItems.tsx

import React from 'react';
import { CustomButton } from './../components/import-button-ui';
import { IconButton } from '@fileverse/ui';
// Sheet might not be needed here if not used directly
// import { Sheet } from '@fileverse-dev/fortune-core';

interface GetCustomToolbarItemsProps {
  handleActualCSVUpload: (file: File) => void;
  handleActualXLSXUpload: () => void;
  handleExportToXLSX: () => void;
  handleExportToCSV: () => void;
  handleExportToJSON: () => void;
  setExportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleTemplateSidebar?: () => void;
}

// Define a more flexible type for toolbar items
interface CustomToolbarItem {
  key: string;
  tooltip: string;
  icon: React.ReactNode;
  onClick?: () => void; // Make onClick optional
}

export const getCustomToolbarItems = ({
  handleActualCSVUpload,
  handleActualXLSXUpload,
  handleExportToXLSX,
  handleExportToCSV,
  handleExportToJSON,
  setExportDropdownOpen,
  toggleTemplateSidebar,
}: GetCustomToolbarItemsProps): CustomToolbarItem[] => {
  // Wrapper for CSV upload to match CustomButton's expected signature
  const csvUploadHandler: React.ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleActualCSVUpload(file);
    }
  };

  // Wrapper for XLSX upload to match CustomButton's expected signature
  // and to call our adapter which doesn't need the event.
  const xlsxUploadHandler: React.ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    // The actual file selection is handled by the input within CustomButton,
    // Our useXLSXImportAdapter hook (called by handleActualXLSXUpload) creates its own input.
    // So, here we mainly just trigger the adapted function.
    // If CustomButton's input is essential, useXLSXImportAdapter needs to accept a file.
    // For now, assuming handleActualXLSXUpload internally manages file picking if needed or CustomButton handles it.
    if (event.target.files?.length) {
      // Ensure a file was selected to trigger the action
      handleActualXLSXUpload();
    }
  };

  const items: CustomToolbarItem[] = [
    {
      key: 'import-export',
      tooltip: 'Import/Export',
      icon: (
        <CustomButton
          setExportDropdownOpen={setExportDropdownOpen}
          handleCSVUpload={csvUploadHandler} // Use wrapper
          handleXLSXUpload={xlsxUploadHandler} // Use wrapper
          handleExportToXLSX={handleExportToXLSX} // Direct pass-through
          handleExportToCSV={handleExportToCSV} // Direct pass-through
          handleExportToJSON={handleExportToJSON} // Direct pass-through
        />
      ),
    },
  ];

  if (toggleTemplateSidebar) {
    items.push({
      key: 'templates',
      tooltip: 'Templates',
      icon: (
        <IconButton
          className="template-button"
          icon="LayoutTemplate"
          size="md"
          variant="ghost"
        />
      ),
      onClick: toggleTemplateSidebar,
    });
  }

  return items; // .filter(Boolean) is not strictly necessary if we ensure items are always objects
};
