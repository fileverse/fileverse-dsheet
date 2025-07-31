import { Sheet } from '@fileverse-dev/fortune-react';
import { RefObject } from 'react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { Cell } from '@fileverse-dev/fortune-react';
import { ERROR_MESSAGES_FLAG } from './constants/shared-constants';
import { SmartContractQueryHandler } from './utils/after-update-cell';

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
  setShowSmartContractModal?: React.Dispatch<React.SetStateAction<boolean>>;
  getDocumentTitle?: () => string;
  updateDocumentTitle?: (title: string) => void;
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
  sheetEditorRef?: RefObject<
    WorkbookInstance & { refreshIndexedDB: () => Promise<void> }
  >;
  storeApiKey?: (apiKeyName: string) => void;
  allowComments?: boolean;
  onDataBlockApiResponse?: (dataBlockName: string) => void;
  onDuneChartEmbed?: () => void;
  onSheetCountChange?: (sheetCount: number) => void;
  editorStateRef?: React.MutableRefObject<{
    refreshIndexedDB: () => Promise<void>;
  } | null>;
  handleSmartContractQuery?: SmartContractQueryHandler;
}
export type BaseError = {
  message: string;
  functionName?: string;
  type: (typeof ERROR_MESSAGES_FLAG)[keyof typeof ERROR_MESSAGES_FLAG];
};

export type CustomError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.CUSTOM;
  reason: string;
};

export type InvalidParamError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.INVALID_PARAM;
};

export type MissingKeyError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.MISSING_KEY;
};

export type EnsResolveError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.ENS;
};

export type InvalidApiKeyError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.INVALID_API_KEY;
  apiKeyName?: string;
};

export type RateLimitError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.RATE_LIMIT;
  apiKeyName?: string;
};

export type NetworkError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.NETWORK_ERROR;
  apiKeyName?: string;
};

export type DefaultError = BaseError & {
  type: typeof ERROR_MESSAGES_FLAG.DEFAULT;
  reason: string;
};

export type ErrorMessageHandlerReturnType =
  | InvalidParamError
  | MissingKeyError
  | RateLimitError
  | NetworkError
  | EnsResolveError
  | InvalidApiKeyError
  | CustomError
  | DefaultError;
