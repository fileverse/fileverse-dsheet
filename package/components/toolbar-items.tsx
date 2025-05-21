import React from 'react';
import { IconButton } from '@fileverse/ui';

interface ToolbarItemsProps {
  setExportDropdownOpen: (open: boolean) => void;
  handleCSVUpload: (file: File) => void;
  handleXLSXUpload: () => void;
  handleExportToXLSX: () => void;
  handleExportToCSV: () => void;
  handleExportToJSON: () => void;
  toggleTemplateSidebar?: () => void;
}

/**
 * Creates toolbar items in the format expected by the fortune-react Workbook component
 */
export const createToolbarItems = ({
  setExportDropdownOpen,
  handleCSVUpload,
  handleXLSXUpload,
  handleExportToXLSX,
  handleExportToCSV,
  handleExportToJSON,
  toggleTemplateSidebar,
}: ToolbarItemsProps) => {
  const items = [];

  // Import menu
  items.push({
    key: 'import',
    tooltip: 'Import',
    icon: <IconButton icon="Import" size="sm" variant="ghost" />,
    children: [
      {
        key: 'import-csv',
        tooltip: 'CSV',
        onClick: () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.csv';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              handleCSVUpload(file);
            }
          };
          input.click();
        },
      },
      {
        key: 'import-xlsx',
        tooltip: 'XLSX',
        onClick: handleXLSXUpload,
      },
    ],
  });

  // Export menu
  items.push({
    key: 'export',
    tooltip: 'Export',
    icon: <IconButton icon="Export" size="sm" variant="ghost" />,
    onClick: () => setExportDropdownOpen(true),
    children: [
      {
        key: 'export-xlsx',
        tooltip: 'XLSX',
        onClick: handleExportToXLSX,
      },
      {
        key: 'export-csv',
        tooltip: 'CSV',
        onClick: handleExportToCSV,
      },
      {
        key: 'export-json',
        tooltip: 'JSON',
        onClick: handleExportToJSON,
      },
    ],
  });

  // Template menu (if available)
  if (toggleTemplateSidebar) {
    items.push({
      key: 'templates',
      tooltip: 'Templates',
      icon: <IconButton icon="LayoutTemplate" size="sm" variant="ghost" />,
      onClick: toggleTemplateSidebar,
    });
  }

  return items;
};
