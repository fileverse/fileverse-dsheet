import React from 'react';
import {
  LucideIcon,
  TextField,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@fileverse/ui';
import { SupportedChain } from '../../../types/smart-contract';
import { useMediaQuery } from 'usehooks-ts';

interface ModalHeaderProps {
  inputAddress: string;
  setFormStep: (step: number) => void;
  onAddressChange: (url: string) => void;
  setSelectedChain: (chain: SupportedChain) => void;
  networks: { label: string; value: SupportedChain }[];
  selectedChain: SupportedChain;
  showHint: boolean;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  inputAddress,
  setFormStep,
  onAddressChange,
  setSelectedChain,
  selectedChain,
  networks,
  showHint,
}) => {
  const isMobile = useMediaQuery('(max-width: 700px)', {
    defaultValue: true,
  });
  return (
    <>
      <div className="flex gap-2 items-center p-3  border-b h-[52px]">
        <div className="flex">
          <LucideIcon name="FileKey2" className={'w-[16.67px] h-[18.33px]'} />
        </div>
        <TextField
          autoFocus
          className={cn(
            'border-none !p-0 text-body-sm focus:outline-none select-text disabled:opacity-100',
            isMobile ? 'w-[170px]' : 'w-[331px]'
          )}
          placeholder="Enter a Contract address"
          value={inputAddress}
          onChange={(e) => {
            setFormStep(1);
            onAddressChange(e.target.value);
          }}
        />
        <div className="h-[52px] border-l pl-3 flex items-center">
          <Select
            onValueChange={(value) => {
              setSelectedChain(value as SupportedChain);
            }}
          >
            <SelectTrigger
              className="gap-3"
              style={{ border: '0px', padding: '0px' }}
            >
              <SelectValue placeholder={selectedChain} />
            </SelectTrigger>
            <SelectContent>
              {networks.map((network) => (
                <SelectItem key={network.value} value={network.value}>
                  <p className="text-body-text-sm">{network.label}</p>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {showHint && (
        <p className="text-helper-text-sm color-text-secondary p-3">
          <b>Hint:</b> Use =SMARTCONTRACT(&quot;contract_address&quot;,
          &quot;chain&quot;) directly in a cell to call a smart contract on the
          Gnosis, Ethereum, or Base chains.
        </p>
      )}
    </>
  );
};
