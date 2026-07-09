import React from 'react';
import { TextField, LucideIcon, Button } from '@fileverse/ui';
import type { ContractConfig } from '../../../types/smart-contract';

interface ContractNameSectionProps {
  smartContractName: string;
  setSmartContractName: (name: string) => void;
  registryMap: Record<string, ContractConfig>;
  abiCode: string;
  isLoading: boolean;
  onClickProceed: () => Promise<void>;
}

export const ContractNameSection: React.FC<ContractNameSectionProps> = ({
  smartContractName,
  setSmartContractName,
  registryMap,
  abiCode,
  isLoading,
  onClickProceed,
}) => (
  <div className="my-4 mx-3">
    <p className="text-heading-xsm mb-1">Smart contract name</p>
    <div className="w-full">
      <TextField
        isValid
        placeholder="Name your smart contract to use it later"
        className="w-[100%]"
        onChange={(c) => {
          setSmartContractName(c.target.value);
        }}
      />
      {registryMap[smartContractName] && (
        <p className="color-text-danger text-helper-text-sm mt-1">
          Contract name already exists
        </p>
      )}
    </div>
    <div className="color-bg-secondary mt-2 rounded-lg p-3">
      <div className="flex mb-1 gap-1 items-center">
        <LucideIcon className="text-[#77818A] h-4 w-4" name={'Info'} />
        <p className=" font-medium text-[12px] leading-[16px] font-size-2xsm  color-text-secondary">
          Usage tip
        </p>
      </div>
      <p className="text-helper-text-sm  color-text-secondary">
        To use your newly added smart contract, you can invoke the onchain
        function &quot;=SMARTCONTRACT&quot; on any cell.
      </p>
    </div>
    <hr className="w-full color-border-default my-3" />
    <Button
      onClick={() => {
        onClickProceed();
      }}
      size="md"
      className="w-full"
      disabled={
        isLoading ||
        !abiCode ||
        !smartContractName ||
        !!registryMap[smartContractName]
      }
    >
      {isLoading && (
        <LucideIcon
          name={'LoaderCircle'}
          className={'h-4 w-4 mr-3 animate-spin'}
        />
      )}
      Save smart contract
    </Button>
  </div>
);
