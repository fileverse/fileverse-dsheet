// customToolbarItems.tsx

import React, { ChangeEvent } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { CustomButton } from './../components/import-button-ui';
import { SmartContractButton } from '../components/smart-contract';

import { IconButton } from '@fileverse/ui';

export const getCustomToolbarItems = ({
  setShowSmartContractModal,
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
  getDocumentTitle,
  updateDocumentTitle,
  // setShowFetchURLModal,
}: {
  setShowSmartContractModal?: React.Dispatch<React.SetStateAction<boolean>>;
  getDocumentTitle?: () => string;
  updateDocumentTitle?: (title: string) => void;
  // setShowFetchURLModal: React.Dispatch<React.SetStateAction<boolean>>;
  setExportDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleCSVUpload: (
    event: ChangeEvent<HTMLInputElement>,
    ydocRef: Y.Doc | null,
    setForceSheetRender: React.Dispatch<React.SetStateAction<number>>,
    dsheetId: string,
    currentDataRef: React.MutableRefObject<object | null>,
    sheetEditorRef: React.RefObject<WorkbookInstance | null>,
    updateDocumentTitle?: (title: string) => void,
  ) => void;
  handleXLSXUpload: React.ChangeEventHandler<HTMLInputElement>;
  handleExportToXLSX: (
    sheetEditorRef: React.RefObject<WorkbookInstance | null>,
    ydocRef: React.RefObject<Y.Doc | null>,
    dsheetId: string,
    getDocumentTitle?: () => string,
  ) => void;
  handleExportToCSV: (
    sheetEditorRef: React.RefObject<WorkbookInstance | null>,
    ydocRef: React.RefObject<Y.Doc | null>,
    dsheetId: string,
  ) => void;
  handleExportToJSON: (
    sheetEditorRef: React.RefObject<WorkbookInstance | null>,
    ydocRef: React.RefObject<Y.Doc | null>,
    dsheetId: string,
  ) => void;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<object | null>;
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>;
  toggleTemplateSidebar: (() => void) | undefined;
  setShowFetchURLModal:
    | React.Dispatch<React.SetStateAction<boolean>>
    | undefined;
}) => [
  {
    key: 'Smart Contract',
    tooltip: 'Smart Contract',
    icon: (
      <SmartContractButton
        handleImportSmartContract={() =>
          setShowSmartContractModal?.((prev: boolean) => {
            return !prev;
          })
        }
        handleViewSmartContract={() =>
          document.getElementById('view-smart-contract')?.click()
        }
      />
    ),
  },
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
            sheetEditorRef,
            updateDocumentTitle,
          )
        }
        handleXLSXUpload={handleXLSXUpload}
        handleExportToXLSX={() =>
          handleExportToXLSX(
            sheetEditorRef,
            ydocRef,
            dsheetId,
            getDocumentTitle,
          )
        }
        handleExportToCSV={() =>
          handleExportToCSV(sheetEditorRef, ydocRef, dsheetId)
        }
        handleExportToJSON={() =>
          handleExportToJSON(sheetEditorRef, ydocRef, dsheetId)
        }
      />
    ),
  },
  {
    /*template-button is used in use xocument style */
    key: 'fetch-url',
    tooltip: 'Fetch data: Coming soon',
    icon: (
      <IconButton
        className="cursor-not-allowed fetch-url-button !min-w-[30px] w-[30px] h-[30px] !px-0 bg-[#1977E42E] hover:!bg-[#1977E42E] rounded-lg"
        icon="FetchData"
        size="md"
        variant="ghost"
        color="blue"
      />
    ),
    onClick: () => {
      return;
      // const selection = sheetEditorRef.current?.getSelection();
      // setShowFetchURLModal?.((prev) => {
      //   if (selection && !prev) {
      //     return true;
      //   } else {
      //     return false;
      //   }
      // });
    },
  },
  {
    /*template-button is used in use xocument style */
    key: 'templates',
    tooltip: 'Templates',
    icon: (
      <IconButton
        className="!min-w-[30px] w-[30px] h-[30px] !px-0 template-button text-[#CF1C82] bg-[#CF1C821F] rounded-lg hover:!bg-[#CF1C821F] "
        icon="LayoutTemplate"
        size="md"
        variant="ghost"
      />
    ),
    onClick: toggleTemplateSidebar,
  },
];
