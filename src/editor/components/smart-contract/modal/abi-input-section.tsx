import React from 'react';

interface AbiInputSectionProps {
  abiCode: string;
  setAbiCode: (value: string) => void;
  errorState: { message: string } | null;
}

export const AbiInputSection: React.FC<AbiInputSectionProps> = ({
  abiCode,
  setAbiCode,
  errorState,
}) => (
  <>
    <h1 className="mb-1 text-heading-xsm">Paste your ABI .json code</h1>

    <textarea
      value={abiCode}
      onChange={(e) => setAbiCode(e.target.value)}
      placeholder="ABI .json code"
      className="w-full h-[100px] p-3 border  color-border-default color-text-secondary  rounded-lg text-body-text-sm resize-y focus:outline-none transition-colors"
    />
    {errorState?.message && (
      <p className="color-text-danger text-helper-text-sm mt-1">
        {errorState.message}
      </p>
    )}
  </>
);
