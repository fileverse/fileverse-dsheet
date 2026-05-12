import { useCallback, useState } from 'react';
import type {
  ChangeEvent,
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';
import type * as Y from 'yjs';
import type { WorkbookInstance } from '@sheet-engine/react';

type ImportType = 'new-dsheet' | 'merge-current-dsheet' | 'new-current-dsheet';

/**
 * XLSX import: keeps ~100k+ LOC (SSF, hyperlink helpers, exceljs/luckyexcel orchestration)
 * in a separate chunk until the user actually imports a file.
 */
export const useXLSXImport = ({
  sheetEditorRef,
  ydocRef,
  setForceSheetRender,
  dsheetId,
  currentDataRef,
  updateDocumentTitle,
}: {
  sheetEditorRef: RefObject<WorkbookInstance | null>;
  ydocRef: RefObject<Y.Doc | null>;
  setForceSheetRender: Dispatch<SetStateAction<number>>;
  dsheetId: string;
  currentDataRef: MutableRefObject<object | null>;
  updateDocumentTitle?: (title: string) => void;
}) => {
  const [filterToastShown, setFilterToastShown] = useState(false);

  const handleXLSXUpload = useCallback(
    async (
      event: ChangeEvent<HTMLInputElement> | undefined,
      fileArg: File,
      importType?: ImportType,
    ): Promise<void> => {
      const { runXlsxFileUpload } = await import('./use-xlsx-import-impl');
      return runXlsxFileUpload(
        {
          sheetEditorRef,
          ydocRef,
          setForceSheetRender,
          dsheetId,
          currentDataRef,
          updateDocumentTitle,
          filterToastShown,
          setFilterToastShown,
        },
        event,
        fileArg,
        importType,
      );
    },
    [
      sheetEditorRef,
      ydocRef,
      setForceSheetRender,
      dsheetId,
      currentDataRef,
      updateDocumentTitle,
      filterToastShown,
    ],
  );

  return { handleXLSXUpload };
};
