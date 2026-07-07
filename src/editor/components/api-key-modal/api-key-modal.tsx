import React, { useState } from 'react';
import { DynamicModal } from '@fileverse/ui';
import anime from '../../assets/anime.svg';
import { RateLimitInfo } from './rate-limit-info';
import { ApiKeyInput } from './api-key-input';

export interface ApiKeyModalProps {
  open: boolean;
  apiKeyName: string;
  onSave: (key: string) => void;
  onClose: () => void;
}

export const ApiKeyModal = ({
  open,
  apiKeyName,
  onSave,
  onClose,
}: ApiKeyModalProps) => {
  const [showRateLimitInput, setShowRateLimitInput] = useState(false);

  const handleSave = (key: string) => {
    if (key) {
      onSave(key);
      setShowRateLimitInput(false);
    }
  };

  const handleClose = () => {
    setShowRateLimitInput(false);
    onClose();
  };

  return (
    <DynamicModal
      hasCloseIcon={true}
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
      className="rounded-lg !max-w-[394px]"
      contentClassName="rounded-lg"
      content={
        <div>
          <div className="h-[296px] flex justify-center items-center color-bg-brand-light ">
            <img alt="anime" src={anime} />
          </div>

          {showRateLimitInput ? (
            <ApiKeyInput
              onCancel={handleClose}
              onSave={handleSave}
              name={apiKeyName}
            />
          ) : (
            <RateLimitInfo
              name={apiKeyName}
              onInsertKey={() => setShowRateLimitInput(true)}
            />
          )}
        </div>
      }
    />
  );
};
