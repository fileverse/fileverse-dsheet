import {
  IconButton,
  LucideIcon,
  TextField,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Tooltip,
} from '@fileverse/ui';
import React, { useEffect, useState } from 'react';
import { SmartContractListItem } from './smart-contract-list-item';
import type {
  ContractConfig,
  SmartContractListViewProps,
  MyContractsProps,
  PopularContractsProps,
  CodeBlockProps,
  ParameterDescriptionProps,
} from '../../types/smart-contract';
import { POPULAR_CONTRACTS_MAP } from '../../utils/smart-contract/constants';
import './index.css';

// Constants
const COPY_ICON_SVG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-copy-icon lucide-copy"
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

// Utility Components
const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  if (copied) {
    return (
      <div className="w-6 h-6 flex justify-center items-center gap-3 p-2 rounded cursor-pointer">
        <Tooltip open={true} text="Copied" position={'bottom'}>
          <LucideIcon name="Check" className="w-4 h-4" />
        </Tooltip>
      </div>
    );
  }
  return (
    <Tooltip text={'Copy'}>
      <div
        className="w-6 h-6 flex justify-center items-center gap-3 p-2 rounded cursor-pointer active:bg-gray-300 active:scale-95"
        onClick={() => {
          navigator.clipboard.writeText(textToCopy);
          setCopied(true);
        }}
      >
        <div className="w-4 h-4">{COPY_ICON_SVG}</div>
      </div>
    </Tooltip>
  );
};

const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  copyText,
}: CodeBlockProps) => (
  <div className="flex justify-center items-center gap-2 self-stretch bg-[hsl(var(--color-bg-default))] p-2 rounded border border-solid border-[#e8ebec] mt-2">
    <code className="break-all">
      <span className="font-medium text-xs">{code}</span>
    </code>
    <CopyButton textToCopy={copyText} />
  </div>
);

const ParameterDescription: React.FC<ParameterDescriptionProps> = ({
  paramName,
  description,
  optional = false,
}) => (
  <div className="flex flex-col justify-center gap-1 self-stretch py-1 rounded">
    <p className="text-body-sm">
      <code className="text-[hsl(var(--color-text-default)] font-mono text-sm font-bold leading-5">
        {paramName}
        {optional && (
          <code className="!text-[hsl(var(--color-text-secondary))]">
            {' '}
            [optional]
          </code>
        )}
        {': '}
      </code>
      {description}
    </p>
  </div>
);

// Documentation Components
const NonImportedContractDocs: React.FC = () => (
  <Accordion
    type="single"
    collapsible
    defaultValue="item-a"
    className="w-full accordin"
  >
    <AccordionItem value="item-a" className="border-none">
      <AccordionTrigger className="!pl-[0px] hover:!bg-[#f8f9fa] !text-left">
        <span className="font-medium text-sm text-[#363b3f]">
          How to use smart contract function with not imported contracts?
        </span>
      </AccordionTrigger>
      <AccordionContent className="!pb-[0px]">
        <ol className="flex flex-col gap-2 self-stretch list-decimal pl-4">
          <li className="font-normal text-sm text-[#363b3f]">
            Type =SMARTCONTRACT in cell.
          </li>
          <li>
            <span className="font-normal text-sm text-[#363b3f]">
              Follow next syntax
            </span>
            <div className="flex flex-col gap-2 self-stretch">
              <div className="flex justify-center items-center gap-2 self-stretch bg-[hsl(var(--color-bg-default))] p-2 rounded border border-solid border-[#e8ebec] h-[48px] mt-2">
                <code className="break-all">
                  <span className="font-medium text-xs">
                    =SMARTCONTRACT(
                    <span className="text-[hsl(var(--color-text-success))]">
                      &quot;Contract_address&quot;,&quot;Chain&quot;
                    </span>
                    )
                  </span>
                </code>
                <CopyButton textToCopy='=SMARTCONTRACT("myContractName", "functionName", "arguments")' />
              </div>
              <div className="flex flex-col gap-1 self-stretch">
                <span className="font-medium text-xs text-[#77818a]">
                  Description
                </span>
                <div className="flex flex-col gap-1 self-stretch">
                  <ParameterDescription
                    paramName="contractAddress"
                    description="Address of the contract you want to query"
                  />
                  <ParameterDescription
                    paramName="Chain"
                    description='Blockchain network(s) to query. Supported values: "ethereum", "gnosis", "base". Accepts comma-separated values.'
                  />
                </div>
              </div>
            </div>
          </li>
          <li className="font-normal text-sm text-[#363b3f]">
            Get a response with list of available functions and arguments for
            this contract address.
          </li>
          <li className="font-normal text-sm text-[#363b3f]">
            Follow instructions of how to modify your =SMARTCONTRACT function
            with function and argument from this list to query a data.
          </li>
          <li className="font-normal text-sm text-[#363b3f]">
            Please spend some time to learn examples below
            <CodeBlock
              code={
                <>
                  =SMARTCONTRACT(
                  <span className="text-[hsl(var(--color-text-success))]">
                    &quot;0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59&quot;,
                    &quot;GNOSIS&quot;
                  </span>
                  )
                </>
              }
              copyText='=SMARTCONTRACT("0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59", "GNOSIS")'
            />
            <p className="text-[hsl(var(--color-text-default, #363B3F))] font-normal text-[12px] leading-5 font-[`Helvetica_Neue`] my-2">
              Returning a list of all available functions for this particular
              address.
            </p>
            <div className="flex justify-center items-center gap-2 self-stretch bg-[hsl(var(--color-bg-default))] p-2 rounded border border-solid border-[#e8ebec]">
              <code className="break-all">
                <span className="font-medium text-xs">
                  =SMARTCONTRACT(
                  <span className="text-[hsl(var(--color-text-success))]">
                    &quot;0xdac17f958d2ee523a2206206994597c13d831ec7&quot;,
                    &quot;ETHEREUM&quot;, &quot;balances&quot;,
                    &quot;0x31b1ce9a747BEDBfe8F2d314ed05De6d045Bdb11&quot;
                  </span>
                  )
                </span>
              </code>
              <CopyButton textToCopy='=SMARTCONTRACT("0xdac17f958d2ee523a2206206994597c13d831ec7", "ETHEREUM", "balances", "0x31b1ce9a747BEDBfe8F2d314ed05De6d045Bdb11")' />
            </div>
            <p className="text-[hsl(var(--color-text-default, #363B3F))] font-normal text-[12px] leading-5 font-[`Helvetica_Neue`] mt-2">
              Returning a balance state for address that mentioned at the end of
              function.
            </p>
          </li>
        </ol>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

const ImportContractDocs: React.FC = () => (
  <Accordion
    type="single"
    collapsible
    defaultValue="item-a"
    className="w-full accordin"
  >
    <AccordionItem value="item-a" className="border-none">
      <AccordionTrigger className="!pl-[0px] hover:!bg-[#f8f9fa] !text-left">
        <span className="font-medium text-sm text-[#363b3f]">
          How to import contract?
        </span>
      </AccordionTrigger>
      <AccordionContent className="!pb-[0px]">
        <div className="flex flex-col gap-2 self-stretch pl-4">
          <ol className="flex flex-col gap-2 self-stretch list-decimal">
            <li className="font-normal text-sm text-[#363b3f]">
              Click &quot;Import Contract&quot; above or select the action from
              the toolbar on the right.
            </li>
            <li className="font-normal text-sm text-[#363b3f]">
              Enter the contract address and choose the chain, then click
              &quot;Import Smart Contract.&quot;
            </li>
            <li className="font-normal text-sm text-[#363b3f]">
              Set a Contract Name. Youll use this later in function syntax as
              &apos;contractName&apos;.
            </li>
            <ul className="flex flex-col gap-1 self-stretch pl-[10px]">
              <li
                className="font-normal text-sm text-[#363b3f]"
                style={{ listStyleType: 'disc' }}
              >
                If the ABI cannot be fetched automatically, paste it or upload
                an ABI .json file before setting the Contract Name.
              </li>
            </ul>
            <li className="font-normal text-sm text-[#363b3f]">
              Click &apos;Save smart contract&apos;
            </li>
          </ol>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

const UseImportedContractDocs: React.FC = () => (
  <Accordion
    type="single"
    collapsible
    defaultValue="item-a"
    className="w-full accordin"
  >
    <AccordionItem value="item-a" className="border-none">
      <AccordionTrigger className="!pl-[0px] hover:!bg-[#f8f9fa] !text-left">
        <span className="font-medium text-sm text-[#363b3f]">
          How to use imported contract?
        </span>
      </AccordionTrigger>
      <AccordionContent className="!pb-[0px]">
        <ol className="flex flex-col gap-2 self-stretch list-decimal pl-4">
          <li>
            <span className="font-normal text-sm text-[#363b3f]">
              After importing a contract, you can pull data using the
              =SMARTCONTRACT formula
            </span>
            <div className="flex flex-col gap-2 self-stretch">
              <div className="flex justify-center items-center gap-2 self-stretch bg-[hsl(var(--color-bg-default))] p-2 rounded border border-solid border-[#e8ebec] h-[48px]">
                <code>
                  <span className="font-medium text-xs">
                    =SMARTCONTRACT(
                    <span className="text-[hsl(var(--color-text-success))]">
                      &quot;myContractName&quot;, &quot;functionName&quot;,
                      &quot;arguments&quot;
                    </span>
                    )
                  </span>
                </code>
                <CopyButton textToCopy='=SMARTCONTRACT("myContractName", "functionName", "arguments")' />
              </div>
              <div className="flex flex-col gap-1 self-stretch">
                <span className="font-medium text-xs text-[#77818a]">
                  Description
                </span>
                <div className="flex flex-col gap-1 self-stretch">
                  <ParameterDescription
                    paramName="contract_name"
                    description="Name of the contract, given by import, you want to pull data for"
                  />
                  <ParameterDescription
                    paramName="functions"
                    description="Name of the function you want to call from the given contract. See Functions section for more details."
                  />
                  <ParameterDescription
                    paramName="argument"
                    description="Optional arguments to pass to the contract function"
                    optional
                  />
                </div>
              </div>
            </div>
          </li>
          <li className="font-normal text-sm text-[#363b3f]">
            Enter formula and hit &apos;Enter&apos;. You should get in cell
            output.{' '}
          </li>
          <li className="font-normal text-sm text-[#363b3f]">
            Please spend some time to learn examples below
            <CodeBlock
              code={
                <>
                  =SMARTCONTRACT(
                  <span className="text-[hsl(var(--color-text-success))]">
                    &quot;myContractName&quot;, &quot;isBridge&quot;,
                    &quot;_address&quot;
                  </span>
                  )
                </>
              }
              copyText='=SMARTCONTRACT("myContractName", "isBridge", "_address")'
            />
            <CodeBlock
              code={
                <>
                  =SMARTCONTRACT(
                  <span className="text-[hsl(var(--color-text-success))]">
                    &quot;myContractName&quot;, &quot;balanceOf&quot;,
                    &quot;_owner&quot;
                  </span>
                  )
                </>
              }
              copyText='=SMARTCONTRACT("myContractName", "balanceOf", "_owner")'
            />
            <CodeBlock
              code={
                <>
                  =SMARTCONTRACT(
                  <span className="text-[hsl(var(--color-text-success))]">
                    &quot;myContractName&quot;, &quot;balanceOf&quot;,
                    &quot;_owner&quot;
                  </span>
                  )
                </>
              }
              copyText='=SMARTCONTRACT("myContractName", "balanceOf", "_owner")'
            />
          </li>
        </ol>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

const DocSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col gap-3 self-stretch bg-[#f8f9fa] px-3 py-2 rounded-lg">
    {children}
  </div>
);

// Main Components
export const MyContracts: React.FC<MyContractsProps> = ({
  contracts,
  onDelete,
  setActiveTab,
  fetchContractAbi,
}) => {
  if (contracts.length === 0) {
    return (
      <div className="flex gap-2 mt-2 w-full">
        <div>
          <LucideIcon name="Info" className="color-text-secondary w-4 h-4" />
        </div>
        <p className="text-helper-text-sm color-text-secondary">
          You have not added any smart contracts yet. You can easily add smart
          contracts by clicking on the &quot;Add&quot; button above. See{' '}
          <span
            className="cursor-pointer text-[hsl(var(--color-text-link))]"
            onClick={() => setActiveTab?.('documentation')}
          >
            Documentation
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="gap-2 flex flex-col">
      {contracts.map((contract) => (
        <SmartContractListItem
          key={contract.name}
          contract={contract}
          onDelete={onDelete}
          fetchContractAbi={fetchContractAbi}
        />
      ))}
    </div>
  );
};

export const PopularContracts: React.FC<PopularContractsProps> = ({
  contracts,
  fetchContractAbi,
}) => {
  if (contracts.length === 0) {
    return (
      <div className="flex gap-2 items-center mt-2 w-full">
        <div className="flex">
          <LucideIcon name="Info" className="color-text-secondary w-4 h-4" />
        </div>
        <p className="text-helper-text-sm color-text-secondary">
          No popular contracts yet!
        </p>
      </div>
    );
  }

  return (
    <div className="gap-2 flex flex-col">
      {contracts.map((contract) => (
        <SmartContractListItem
          key={contract.name}
          contract={contract}
          fetchContractAbi={fetchContractAbi}
        />
      ))}
    </div>
  );
};

export const SmartContractListView: React.FC<SmartContractListViewProps> = ({
  userSmartContracts,
  onDelete,
  handleSearch,
  onOpenImportModal,
  fetchContractAbi,
  isAuthorized,
}) => {
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('contracts');
  const isUnAuthenticatedUser = !isAuthorized;

  const [filteredContractList, setFilteredContractList] = useState<
    ContractConfig[]
  >(Object.values(POPULAR_CONTRACTS_MAP));

  useEffect(() => {
    handleSearch(searchText);

    const filtered = Object.values(POPULAR_CONTRACTS_MAP).filter(
      (contract) =>
        contract.name.toLowerCase().includes(searchText.toLowerCase()) ||
        contract.address.toLowerCase().includes(searchText.toLowerCase()) ||
        contract.network.toLowerCase().includes(searchText.toLowerCase())
    );

    setFilteredContractList(filtered);
  }, [searchText, handleSearch]);

  const displayedContracts = searchText
    ? filteredContractList
    : Object.values(POPULAR_CONTRACTS_MAP);

  return (
    <div className="w-full h-[calc(100vh-200px)] flex flex-col gap-3 p-4">
      <div className="flex gap-2 self-stretch">
        <div className="flex flex-col justify-center h-[32px] grow">
          <TextField
            value={searchText}
            className="!pl-10 h-full"
            leftIcon={<LucideIcon name="Search" size="sm" />}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by name, address, network"
          />
        </div>
        <div className="h-[32px] w-[32px] flex justify-center items-center">
          <IconButton
            disabled={isUnAuthenticatedUser}
            icon="Plus"
            onClick={() => onOpenImportModal()}
            className="!w-full h-full !min-w-[32px]"
            size="md"
            variant="default"
          />
        </div>
      </div>

      <div className="w-full overflow-y-auto no-scrollbar">
        <Tabs
          defaultValue="contracts"
          className="w-full"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="w-full p-[0px] h-[32px]">
            <TabsTrigger value="contracts" className="w-full">
              Contracts
            </TabsTrigger>
            <TabsTrigger value="documentation" className="w-full">
              Documentation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contracts" className="w-full mt-[16px]">
            <div className="w-full">
              <Accordion
                type="multiple"
                className="w-full accordin"
                defaultValue={['item-1', 'item-2']}
              >
                <AccordionItem value="item-1" className="border-none">
                  <AccordionTrigger
                    size="md"
                    className="!pl-[0px] hover:!bg-[hsl(var(--color-bg-default))]"
                  >
                    Imported Contracts
                  </AccordionTrigger>
                  <AccordionContent className="!pb-[24px]">
                    <MyContracts
                      contracts={userSmartContracts}
                      onDelete={onDelete}
                      setActiveTab={setActiveTab}
                      fetchContractAbi={fetchContractAbi}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="border-none">
                  <AccordionTrigger
                    size="md"
                    className="!pl-[0px] hover:!bg-[hsl(var(--color-bg-default))]"
                  >
                    Popular Contracts
                  </AccordionTrigger>
                  <AccordionContent>
                    <PopularContracts
                      contracts={displayedContracts}
                      onInsert={(name) => console.log(name)}
                      fetchContractAbi={fetchContractAbi}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>

          <TabsContent value="documentation" className="w-full">
            <div className="flex flex-col gap-5 self-stretch">
              <div className="flex flex-col gap-2 self-stretch mt-[12px]">
                <DocSection>
                  <NonImportedContractDocs />
                </DocSection>
                <DocSection>
                  <ImportContractDocs />
                </DocSection>
                <DocSection>
                  <UseImportedContractDocs />
                </DocSection>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
