// customToolbarItems.tsx

import React, { ChangeEvent } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { CustomButton } from './../components/import-button-ui';

import {
  IconButton,
} from '@fileverse/ui';

export const getCustomToolbarItems = ({
  setExportDropdownOpen,
  handleCSVUpload,
  handleXLSXUpload,
  handleExportToXLSX,
  handleExportToCSV,
  handleExportToJSON,
  sheetEditorRef,
  ydocRef,
  dsheetId,
  currentDataRef,
  setForceSheetRender,
  toggleTemplateSidebar,
}: {
  setExportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleCSVUpload: (
    event: ChangeEvent<HTMLInputElement>,
    ydocRef: Y.Doc | null,
    setForceSheetRender: React.Dispatch<React.SetStateAction<number>>,
    dsheetId: string,
    currentDataRef: React.MutableRefObject<object | null>,
  ) => void;
  handleXLSXUpload: React.ChangeEventHandler<HTMLInputElement>;
  handleExportToXLSX: (
    sheetEditorRef: React.RefObject<WorkbookInstance | null>,
    ydocRef: React.RefObject<Y.Doc | null>,
    dsheetId: string,
  ) => void;
  handleExportToCSV: (
    sheetEditorRef: React.RefObject<WorkbookInstance | null>,
    ydocRef: React.RefObject<Y.Doc | null>,
    dsheetId: string,
  ) => void;
  handleExportToJSON: (
    sheetEditorRef: React.RefObject<WorkbookInstance | null>,
  ) => void;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<object | null>;
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>;
  toggleTemplateSidebar: (() => void) | undefined;
}) => [
    {
      key: 'import-export',
      tooltip: 'Import/Export',
      onClick: () => {
        setExportDropdownOpen((prev) => !prev);
      },
      icon: (
        <CustomButton
          setExportDropdownOpen={setExportDropdownOpen}
          handleCSVUpload={(event) =>
            handleCSVUpload(
              event,
              ydocRef.current,
              setForceSheetRender,
              dsheetId,
              currentDataRef,
            )
          }
          handleXLSXUpload={handleXLSXUpload}
          handleExportToXLSX={() =>
            handleExportToXLSX(sheetEditorRef, ydocRef, dsheetId)
          }
          handleExportToCSV={() =>
            handleExportToCSV(sheetEditorRef, ydocRef, dsheetId)
          }
          handleExportToJSON={() => handleExportToJSON(sheetEditorRef)}
        />
      ),
    },
    {
      key: 'templates',
      tooltip: 'Templates',
      icon: (
        <IconButton
          className='template-button'
          icon="LayoutTemplate"
          size="md"
          variant="ghost"
        />
      ),
      onClick: toggleTemplateSidebar,
    },
  ];
