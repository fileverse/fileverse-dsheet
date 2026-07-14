import React, { MutableRefObject } from 'react';
import { SmartContractModalUI } from './smart-contract-modal-ui';
import type { ContractConfig, SupportedChain } from '../../types/smart-contract';
import { Hex } from 'viem';
import { useSmartContractModal } from './use-smart-contract-modal';

interface FetchUrlDataBlockProps {
  showSmartContractModal: boolean;
  setShowSmartContractModal: (show: boolean) => void;
  onSaveContract: (
    address: Hex,
    chain: SupportedChain,
    abi: string,
    smartContractName: string
  ) => Promise<void>;
  registryMapRef: MutableRefObject<Record<string, ContractConfig>>;
}

export const SmartContractModal: React.FC<FetchUrlDataBlockProps> = ({
  showSmartContractModal,
  setShowSmartContractModal,
  onSaveContract,
  registryMapRef,
}) => {
  const {
    inputAddress,
    selectedChain,
    setSelectedChain,
    formStep,
    setFormStep,
    abiCode,
    setAbiCode,
    uploadedFile,
    setUploadedFile,
    uploadProgress,
    isUploading,
    fileInputRef,
    smartContractName,
    setSmartContractName,
    isImportingRef,
    modalDivRef,
    handleFileInputChange,
    handleUploadAreaClick,
    handleRemoveFile,
    handleAddressInputChange,
    onClickProceed,
    isValidAddress,
    errorState,
  } = useSmartContractModal({
    onSaveContract,
    setShowSmartContractModal,
    registryMapRef,
  });

  return (
    <div>
      {showSmartContractModal && (
        <SmartContractModalUI
          abiCode={abiCode}
          setAbiCode={setAbiCode}
          uploadedFile={uploadedFile}
          setUploadedFile={setUploadedFile}
          uploadProgress={uploadProgress}
          isUploading={isUploading}
          handleRemoveFile={handleRemoveFile}
          handleUploadAreaClick={handleUploadAreaClick}
          handleFileInputChange={handleFileInputChange}
          fileInputRef={fileInputRef}
          formStep={formStep}
          smartContractName={smartContractName}
          setSmartContractName={setSmartContractName}
          setFormStep={setFormStep}
          selectedChain={selectedChain}
          setSelectedChain={setSelectedChain}
          inputAddress={inputAddress}
          isValidURL={isValidAddress}
          modalDivRef={modalDivRef}
          onAddressChange={handleAddressInputChange}
          onClickProceed={onClickProceed}
          isImportingRef={isImportingRef}
          registryMapRef={registryMapRef}
          errorState={errorState}
        />
      )}
    </div>
  );
};
