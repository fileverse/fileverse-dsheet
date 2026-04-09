import React, { useState, useEffect, useRef } from 'react';
import './duneChartsInputModal.css';
import { Button, LucideIcon } from '@fileverse/ui';
import { sanitizeDuneUrl } from '@sheet-engine/core';
import SVGIcon from '../SVGIcon';

interface DuneChartsInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  submitText?: string;
  placeholder?: string;
}

const DuneChartsInputModal = ({
  isOpen,
  onClose,
  onSubmit,
  submitText = 'Submit',
  placeholder = 'Enter a value...',
}: DuneChartsInputModalProps) => {
  const [url, setUrl] = useState<string>('');
  const [showError, setShowError] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (trimmed && sanitizeDuneUrl(trimmed)) {
      onSubmit(trimmed);
      setUrl('');
      setShowError(false);
      onClose();
    } else {
      setShowError(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="custom-overlay" onClick={onClose}>
      <div
        className="input-modal w-3/4 md:w-full"
        style={{ transformOrigin: 'top center' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <LucideIcon name="DuneChart" />
          <input
            ref={inputRef}
            className="modal-input"
            type="text"
            placeholder={placeholder}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setShowError(false);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        {showError && (
          <div className="modal-error-message">
            <SVGIcon
              style={{ width: '14px', height: '14px' }}
              name="circle-alert"
            />
            <span>Please add a valid valid Dune chart URL</span>
          </div>
        )}
        {url.length > 0 && !showError && (
          <div className="modal-footer">
            <Button onClick={handleSubmit} className="modal-button">
              {submitText}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuneChartsInputModal;
