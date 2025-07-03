import { Sheet } from '@fileverse-dev/fortune-core';
import { RefObject } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { Cell } from '@fileverse-dev/fortune-core';
// @ts-ignore
import { ERROR_MESSAGES_FLAG } from '@fileverse-dev/formulajs/crypto-constants';

export interface SheetUpdateData {
  data: Sheet[];
}

export interface EditorValues {
  sheetEditorRef: RefObject<WorkbookInstance>;
  currentDataRef: React.MutableRefObject<Sheet[] | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
}

// Define the onboarding handler type
export type OnboardingHandlerType = (params: {
  row: number;
  column: number;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
}) => { row: number; column: number };

// Define the data block API key handler type
export type DataBlockApiKeyHandlerType = (params: {
  data: ErrorMessageHandlerReturnType;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  executeStringFunction: (functionCallString: string) => Promise<unknown>;
  row: number;
  column: number;
  newValue: Cell;
  formulaResponseUiSync: (params: {
    row: number;
    column: number;
    newValue: Record<string, string>;
    apiData: Array<Record<string, object>>;
    sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  }) => void;
}) => void;

export interface DsheetProps {
  isAuthorized: boolean;
  setShowFetchURLModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setFetchingURLData?: (fetching: boolean) => void;
  setInputFetchURLDataBlock?: React.Dispatch<React.SetStateAction<string>>;
  renderNavbar?: (editorValues?: EditorValues) => JSX.Element;
  enableIndexeddbSync?: boolean;
  dsheetId: string;
  onChange?: (updateData: SheetUpdateData, encodedUpdate?: string) => void;
  username?: string;
  enableWebrtc?: boolean;
  portalContent?: string;
  isReadOnly?: boolean;
  isTemplateOpen?: boolean;
  isCollaborative?: boolean;
  selectedTemplate?: string;
  onboardingComplete?: boolean;
  onboardingHandler?: OnboardingHandlerType;
  dataBlockApiKeyHandler?: DataBlockApiKeyHandlerType;
  setForceSheetRender?: React.Dispatch<React.SetStateAction<number>>;
  getCommentCellUI?: (row: number, column: number) => void;
  // eslint-disable-next-line @typescript-eslint/ban-types
  commentData?: Object;
  toggleTemplateSidebar?: () => void;
  sheetEditorRef?: RefObject<WorkbookInstance>;
  storeApiKey?: (apiKeyName: string) => void;
  allowComments?: boolean;
  onDataBlockApiResponse?: (dataBlockName: string) => void;
  onDuneChartEmbed?: () => void;
  onSheetCountChange?: (sheetCount: number) => void;
}
type BaseError = {
  message: string;
  functionName?: string;
  type: string;
};

type CustomError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.CUSTOM;
  reason: string;
};

type NetworkError = BaseError & {
  type:
    | typeof ERROR_MESSAGES_FLAG.NETWORK_ERROR
    | typeof ERROR_MESSAGES_FLAG.RATE_LIMIT;
};

type DefaultError = BaseError & {
  reason: any;
};

export type ErrorMessageHandlerReturnType =
  | BaseError
  | CustomError
  | NetworkError
  | DefaultError;
