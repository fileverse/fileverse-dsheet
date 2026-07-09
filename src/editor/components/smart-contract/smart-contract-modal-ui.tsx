import React, { MutableRefObject, useState } from 'react';
import { Button, LucideIcon } from '@fileverse/ui';
import type { ContractConfig } from '../../types/smart-contract';
import { SupportedChain } from '../../types/smart-contract';
import {
  fetchVerifiedAbi,
  getChainFromChainId,
} from '../../utils/smart-contract/reading-utils';
import { Hex } from 'viem';

import { ModalHeader } from './modal/modal-header';
import { ImportSection } from './modal/import-section';
import { AbiInputSection } from './modal/abi-input-section';
import { FileUploadSection } from './modal/file-upload-section';
import { ContractNameSection } from './modal/contract-name-section';
import { useMediaQuery } from 'usehooks-ts';

interface SmartContractModalUIProps {
  abiCode: string;
  smartContractName: string;
  setSmartContractName: React.Dispatch<React.SetStateAction<string>>;
  setAbiCode: React.Dispatch<React.SetStateAction<string>>;
  uploadedFile: any;
  setUploadedFile: React.Dispatch<React.SetStateAction<any>>;
  uploadProgress: number;
  isUploading: boolean;
  handleRemoveFile: () => void;
  handleUploadAreaClick: () => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  selectedChain: SupportedChain;
  setSelectedChain: React.Dispatch<React.SetStateAction<SupportedChain>>;
  formStep: number;
  setFormStep: React.Dispatch<React.SetStateAction<number>>;
  onClickProceed: (abi?: any) => Promise<void>;
  inputAddress: string;
  isValidURL: boolean;
  modalDivRef: React.RefObject<HTMLDivElement>;
  onAddressChange: (url: string) => void;
  isImportingRef: MutableRefObject<boolean>;
  registryMapRef: MutableRefObject<Record<string, ContractConfig>>;
  errorState: { message: string } | null;
}

export const SmartContractModalUI: React.FC<SmartContractModalUIProps> = ({
  abiCode,
  smartContractName,
  setSmartContractName,
  setAbiCode,
  uploadedFile,
  uploadProgress,
  isUploading,
  handleRemoveFile,
  handleFileInputChange,
  fileInputRef,
  setSelectedChain,
  formStep,
  setFormStep,
  selectedChain,
  inputAddress,
  isValidURL,
  modalDivRef,
  onAddressChange,
  onClickProceed,
  isImportingRef,
  registryMapRef,
  errorState,
}) => {
  const isDev = process.env.NEXT_PUBLIC_NETWORK_NAME === 'sepolia';
  const networks = [
    {
      label: SupportedChain.Ethereum,
      value: SupportedChain.Ethereum,
    },
    {
      label: SupportedChain.Gnosis,
      value: SupportedChain.Gnosis,
    },
    {
      label: SupportedChain.Base,
      value: SupportedChain.Base,
    },
  ];

  isDev &&
    networks.push({
      label: SupportedChain.Sepolia,
      value: SupportedChain.Sepolia,
    });

  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isVerified, setIsVerified] = useState(true);

  const handleImport = async () => {
    setIsImporting(true);
    const chain = getChainFromChainId(selectedChain);
    isImportingRef.current = true;

    const abi = await fetchVerifiedAbi(inputAddress as Hex, chain);
    if (abi) {
      setAbiCode(JSON.stringify(abi));
      setIsImporting(false);
      isImportingRef.current = false;
      setFormStep(2);
    } else {
      isImportingRef.current = false;
      setIsImporting(false);
      setIsVerified(false);
    }
  };

  const isMobile = useMediaQuery('(max-width: 700px)', {
    defaultValue: true,
  });

  return (
    <div
      className="h-screen z-[9999] bg-gray-100 grid place-items-center relative"
      ref={modalDivRef}
    >
      <div
        className={`fixed top-1/4 left-1/2 ${isMobile ? 'max-w-[350px]' : 'w-[500px]'} transform -translate-x-1/2 rounded-xl fetch-url-modal bg-white !p-0 border-0 shadow-[0_8px_32px_0_rgba(0,0,0,0.15)]`}
        style={{ transformOrigin: 'top center' }}
      >
        <div className="w-full">
          {/* Header */}
          <ModalHeader
            inputAddress={inputAddress}
            setFormStep={setFormStep}
            onAddressChange={onAddressChange}
            setSelectedChain={setSelectedChain}
            networks={networks}
            selectedChain={selectedChain}
            showHint={isVerified && formStep === 1}
          />

          {/* Expandable Content */}
          <div>
            <div
              className={`
                ${isValidURL ? `${isVerified ? 'max-h-[300px]' : 'max-h-[400px]'}` : 'max-h-[0px]'}
                transition-all ease-in-out duration-300 overflow-hidden
              `}
            >
              {formStep === 1 ? (
                <>
                  {isVerified ? (
                    <ImportSection
                      isImporting={isImporting}
                      handleImport={handleImport}
                    />
                  ) : (
                    <div className="my-4 mx-3">
                      <div>
                        <AbiInputSection
                          abiCode={abiCode}
                          setAbiCode={setAbiCode}
                          errorState={errorState}
                        />

                        {/* Divider */}
                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500">
                              or
                            </span>
                          </div>
                        </div>

                        <FileUploadSection
                          uploadedFile={uploadedFile}
                          uploadProgress={uploadProgress}
                          isUploading={isUploading}
                          handleRemoveFile={handleRemoveFile}
                          handleFileInputChange={handleFileInputChange}
                          fileInputRef={fileInputRef}
                        />
                      </div>
                      <Button
                        onClick={() => {
                          setFormStep(2);
                        }}
                        size="md"
                        className="w-full"
                        disabled={isLoading || !abiCode || !!errorState}
                      >
                        {isLoading && (
                          <LucideIcon
                            name={'LoaderCircle'}
                            className={'h-4 w-4 mr-3 animate-spin'}
                          />
                        )}
                        <p>Proceed</p>
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <ContractNameSection
                  smartContractName={smartContractName}
                  setSmartContractName={setSmartContractName}
                  registryMap={registryMapRef.current}
                  abiCode={abiCode}
                  isLoading={isLoading}
                  onClickProceed={async () => {
                    setIsLoading(true);
                    await onClickProceed();
                    setIsLoading(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
