import React, { useState } from "react";
import { Button, DynamicModal, TextField } from "@fileverse/ui";

/**
 * ApiKeyModal component
 * 
 * A modal dialog that prompts users to name their document before sharing it
 */
export const ApiKeyModal = ({
  openApiKeyModal,
  setOpenApiKeyModal,
  openApiKeyModalRef,
  contextApiKeyName
}: {
  openApiKeyModal: boolean;
  setOpenApiKeyModal: React.Dispatch<React.SetStateAction<boolean>>;
  openApiKeyModalRef: React.MutableRefObject<boolean>;
  contextApiKeyName: React.MutableRefObject<string | null>;
}) => {
  // State to track the user's input value
  const [localStorageValue, setLocalStorageValue] = useState<null | string>(null);

  /**
   * Handles closing the modal
   */
  const handleClose = () => {
    setOpenApiKeyModal(false);
    openApiKeyModalRef.current = false;
  };

  /**
   * Handles saving the value to localStorage
   */
  const handleSave = () => {
    if (contextApiKeyName.current && localStorageValue)
      window.localStorage.setItem(contextApiKeyName.current, localStorageValue);
    contextApiKeyName.current = null;
    handleClose();
  };

  return (
    <div>
      <DynamicModal
        open={openApiKeyModal}
        onOpenChange={() => {
          setOpenApiKeyModal((prev) => !prev);
          openApiKeyModalRef.current = false;
        }}
        className="rounded-lg"
        contentClassName="!pt-4 px-6"
        title={
          <div className="font-medium text-lg leading-6">
            Setup
          </div>
        }
        content={
          <div className="flex flex-col gap-4 font-normal text-sm leading-5">
            {/* Modal header text */}
            <div>
              {`Provide ${contextApiKeyName.current} to proceed:`}
            </div>

            {/* Text input field */}
            <TextField
              autoFocus
              type="text"
              maxLength={50}
              className="font-normal text-sm leading-5 px-3 py-2 h-10 min-h-10 bg-white border border-gray-200 rounded"
              onChange={(e) => {
                setLocalStorageValue(e.target.value);
              }}
            />

            {/* Action buttons */}
            <div className="flex justify-end items-center gap-2">
              {/* Skip button */}
              <Button
                className="font-medium text-sm leading-5 px-3 py-2 w-20 min-w-[80px] h-10 min-h-10 max-h-10 rounded"
                size="lg"
                variant="ghost"
                onClick={handleClose}
              >
                Skip
              </Button>

              {/* Save button */}
              <Button
                className="font-medium text-sm leading-5 px-3 py-2 w-20 min-w-[80px] h-10 min-h-10 max-h-10 rounded"
                size="lg"
                disabled={localStorageValue === ""}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
};