import { Button, LucideIcon } from '@fileverse/ui';
import { SMART_CONTRACT_PANEL_ID } from '../../utils/smart-contract/constants';

export const SmartContractReadingErrorToast = ({
  smartContractReadingError,
  setSmartContractReadingError,
  openPanel,
}: {
  smartContractReadingError: {
    hasError: boolean;
    errorMessage: string;
  };
  setSmartContractReadingError: (error: {
    hasError: boolean;
    errorMessage: string;
  }) => void;
  openPanel: (panel: string) => void;
}) => {
  if (!smartContractReadingError.hasError) {
    return null;
  }

  return (
    <div className="fixed bottom-10 left-1/2 z-[9999] -translate-x-1/2 border color-border-danger bg-[#FFF1F2] rounded-lg py-2 px-3 flex items-center justify-between gap-1 lg:!gap-6 flex-col lg:!flex-row">
      <div className="flex items-center gap-2">
        <LucideIcon
          name="TriangleAlert"
          className="color-text-danger flex-shrink-0"
          size="sm"
        />
        <p className="text-helper-text-sm lg:!text-[14px] color-text-danger font-normal">
          {smartContractReadingError.errorMessage}. Please use imported
          contract.
        </p>
      </div>

      <Button
        variant="danger"
        size="sm"
        className="!text-[12px] !py-2 !px-1 !min-w-fit !h-[24px] !rounded"
        onClick={() => {
          openPanel(SMART_CONTRACT_PANEL_ID);
          setSmartContractReadingError({
            hasError: false,
            errorMessage: '',
          });
        }}
      >
        Open my contract
      </Button>
    </div>
  );
};
