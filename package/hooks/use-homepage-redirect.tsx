import { useEffect } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';


export const usehandleHomepageRedirect = ({
  setSelectedTemplate,
  handleXLSXUpload,
  handleCSVUpload,
  ydocRef,
  dsheetId,
  currentDataRef,
  setForceSheetRender,
  sheetEditorRef,
  updateDocumentTitle
}: {
  setSelectedTemplate?: React.Dispatch<React.SetStateAction<string>>;
  handleXLSXUpload: any;
  handleCSVUpload: any
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<object | null>;
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  updateDocumentTitle: any
}) => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get("xlsx");

    if (fileUrl) {
      fetch(fileUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "import.xlsx");
          if (file) {
            handleXLSXUpload(undefined, file);
          }
          // Call handler with file
        })
        .finally(() => {
          // Remove 'file' param from the URL without reloading
          params.delete("xlsx");
          window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
        });
    }

    const csvFileUrl = params.get("csv");

    if (csvFileUrl) {
      fetch(csvFileUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "import.csv");
          if (file) {
            handleCSVUpload(undefined, ydocRef.current, setForceSheetRender, dsheetId, currentDataRef, sheetEditorRef, updateDocumentTitle, file);
          }
          // Call handler with file
        })
        .finally(() => {
          // Remove 'file' param from the URL without reloading
          params.delete("csv");
          window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
        });
    }

    const templateSlug = params.get("template");
    if (templateSlug) {
      setSelectedTemplate?.(templateSlug);
      params.delete("template");
      window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
    }

  }, []);
}
