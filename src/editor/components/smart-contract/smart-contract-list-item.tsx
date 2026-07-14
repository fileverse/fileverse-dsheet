import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  cn,
  LucideIcon,
} from '@fileverse/ui';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { Abi } from 'viem';
import type { ContractConfig, ParsedFunction } from '../../types/smart-contract';
import { parseAbiViewFunctions } from '../../utils/smart-contract/reading-utils';
import {
  parseFunctionSignature,
  getFunctionWithArguments,
} from '../../utils/smart-contract/signature-utils';

// Extracted Components
const CopyButton = ({ textToCopy }: { textToCopy: string }) => (
  <div
    className="w-6 h-6 flex justify-center items-center gap-3 p-2 rounded cursor-pointer active:bg-gray-300 active:scale-95"
    onClick={() => navigator.clipboard.writeText(textToCopy)}
  >
    <div className="w-4 h-4">
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
    </div>
  </div>
);

const CodeBlock = ({
  children,
  onCopy,
}: {
  children: React.ReactNode;
  onCopy?: string;
}) => (
  <div className="flex justify-center items-center gap-2 self-stretch bg-[#f8f9fa] p-2 rounded border border-solid border-[#e8ebec]">
    <code>
      <span className="font-medium text-xs">{children}</span>
    </code>
    {onCopy && <CopyButton textToCopy={onCopy} />}
  </div>
);

const SyntaxSection = () => (
  <div className="flex flex-col gap-2 self-stretch">
    <span className="font-medium text-xs text-[#77818a]">Syntax</span>
    <CodeBlock onCopy="=SMARTCONTRACT('contract_name', 'function', 'argument')">
      =SMARTCONTRACT(
      <span className="text-[hsl(var(--color-text-success))]">
        &quot;contract_name&quot;, &quot;function&quot;, &quot;argument&quot;
      </span>
      )
    </CodeBlock>
  </div>
);

const DescriptionItem = ({
  label,
  description,
  isOptional = false,
  link,
}: {
  label: string;
  description: string;
  isOptional?: boolean;
  link?: { text: string; href: string };
}) => (
  <div className="flex flex-col justify-center gap-1 self-stretch py-1 rounded">
    <p className="text-body-sm">
      <code className="text-[hsl(var(--color-text-default)] font-mono text-sm font-bold leading-5">
        {label}
        {isOptional && (
          <code className="!text-[hsl(var(--color-text-secondary))]">
            {' '}
            [optional]
          </code>
        )}
        {': '}
      </code>
      {description}
      {link && (
        <>
          {' See '}
          <a
            className="cursor-pointer text-[hsl(var(--color-text-link))]"
            href={link.href}
          >
            {link.text}
          </a>
          {' section for more details.'}
        </>
      )}
    </p>
  </div>
);

const DescriptionSection = () => (
  <div className="flex flex-col gap-2 self-stretch">
    <span className="font-medium text-xs text-[#77818a]">Description</span>
    <div className="flex flex-col gap-1 self-stretch">
      <DescriptionItem
        label="contract_name"
        description="Name of the contract, given by import, you want to pull data for"
      />
      <DescriptionItem
        label="functions"
        description="Name of the function you want to call from the given contract."
        link={{ text: 'Functions', href: '#function-list' }}
      />
      <DescriptionItem
        label="argument"
        description="Optional arguments to pass to the contract function"
        isOptional
      />
    </div>
  </div>
);

const ExampleCodeBlock = ({
  contractName,
  functionName,
  args,
}: {
  contractName: string;
  functionName?: string;
  args?: string;
}) => {
  const copyText = `=SMARTCONTRACT("${contractName}", "${functionName}", ${args})`;

  return (
    <CodeBlock onCopy={copyText}>
      =SMARTCONTRACT(
      <span className="text-[hsl(var(--color-text-success))]">
        &quot;{contractName}&quot;, &quot;{functionName}&quot;
        {args ? `, ${args}` : ''}
      </span>
      )
    </CodeBlock>
  );
};

const FunctionExamples = ({
  contractName,
  functionContent,
}: {
  contractName: string;
  functionContent: ParsedFunction[];
}) => {
  const functionDetail = useMemo(
    () => getFunctionWithArguments(functionContent),
    [functionContent]
  );

  const funParsed = useMemo(
    () => parseFunctionSignature(functionDetail?.functionName || ''),
    [functionDetail]
  );

  const cellRefArg = useMemo(
    () =>
      funParsed?.args
        ?.split(',')
        .map((_, index) => `A${index + 1}`)
        .join(', '),
    [funParsed]
  );

  if (!funParsed) return null;

  return (
    <>
      <div className="mt-[4px] flex flex-col gap-[4px]">
        <ExampleCodeBlock
          contractName={contractName}
          functionName={funParsed.name}
          args={funParsed.args}
        />
        <div className="my-2">
          <ExampleCodeBlock
            contractName={contractName}
            functionName={funParsed.name}
            args={cellRefArg}
          />
        </div>
      </div>
      <p className="text-[hsl(var(--color-text-default, #363B3F))] font-normal text-[12px] leading-5 font-[`Helvetica_Neue`] mb-2">
        Note: In above example {cellRefArg} is cell reference containing an
        argument value.
      </p>
    </>
  );
};

const FunctionList = ({
  functionContent,
  contractName,
}: {
  functionContent: ParsedFunction[];
  contractName: string;
}) => (
  <>
    <div className="flex flex-col justify-center gap-1 self-stretch py-2 rounded">
      <span className="text-[hsl(var(--color-text-secondary,#77818A))] font-['Helvetica_Neue'] text-[12px] font-medium leading-[16px]">
        Functions
      </span>
    </div>
    {functionContent.map((data, index) => {
      const functionDetail = parseFunctionSignature(data.functionName);
      return (
        <div key={index} className="w-full">
          <div className="mb-2">
            <code className="text-helper-mono text-[12px]">
              <span className="font-medium text-xs">
                =SMARTCONTRACT(
                <span className="text-[hsl(var(--color-text-success))]">
                  &quot;{contractName}&quot;, &quot;{functionDetail?.name}&quot;
                  {functionDetail?.args ? ', ' + functionDetail.args : ''}
                </span>
                )
              </span>
            </code>
          </div>
          {index !== functionContent.length - 1 && (
            <hr className="w-full my-2" />
          )}
        </div>
      );
    })}
  </>
);

const FunctionsSection = ({
  contractName,
  functionContent,
}: {
  contractName: string;
  functionContent: ParsedFunction[];
}) => (
  <Accordion className="!w-full" type="multiple" defaultValue={['function']}>
    <AccordionItem value="function" className="border-none">
      <AccordionTrigger
        style={{ backgroundColor: 'white', background: 'white !important' }}
        className="!p-0"
        size="md"
      >
        <p className="text-heading-xsm">Functions and their arguments</p>
      </AccordionTrigger>
      <AccordionContent className="!pb-0" id="function-list">
        <p className="text-[hsl(var(--color-text-default, #363B3F))] font-normal text-sm leading-5 font-[`Helvetica_Neue`] mb-2">
          How to use functions and arguments? Place the function name followed
          by its arguments. Explore examples below.
        </p>
        <FunctionExamples
          contractName={contractName}
          functionContent={functionContent}
        />
        <FunctionList
          functionContent={functionContent}
          contractName={contractName}
        />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

const ContractHeader = ({
  contractName,
  onDelete,
  isDeleting,
}: {
  contractName: string;
  onDelete?: (name: string) => void;
  isDeleting: boolean;
}) => (
  <div className="w-full flex justify-between h-[20px] items-center">
    <div className="flex gap-2 items-center">
      <div>
        <LucideIcon
          name="FileKey2"
          size="sm"
          className={cn('color-icon-secondary')}
        />
      </div>
      <p className="text-heading-xsm flex-1 max-w-[200px] truncate">
        {contractName}
      </p>
    </div>
    {onDelete && (
      <div
        role="button"
        onClick={() => onDelete(contractName)}
        className="p-2 rounded-md hover:bg-[#FFF1F2] mr-[4px]"
      >
        <LucideIcon
          name="Trash2"
          size="sm"
          stroke="#FB3449"
          className={cn(
            'cursor-pointer color-icon-danger',
            isDeleting && 'cursor-not-allowed'
          )}
        />
      </div>
    )}
  </div>
);

const ContractDetails = ({ contract }: { contract: ContractConfig }) => (
  <div className="flex gap-4 items-center">
    <div className="w-[46px]">
      <p className="text-helper-text-sm color-text-secondary">Network</p>
      <p className="text-helper-text-sm flex-1 truncate color-text-default">
        {contract.network}
      </p>
    </div>
    <div className="max-w-[222px]">
      <p className="text-helper-text-sm color-text-secondary">Address</p>
      <p className="truncate text-helper-text-sm flex-1 color-text-default">
        {contract.address}
      </p>
    </div>
  </div>
);

// Main Component
export const SmartContractListItem = ({
  contract,
  onDelete,
  fetchContractAbi,
}: {
  contract: ContractConfig;
  onDelete?: (name: string) => void;
  fetchContractAbi: (contract: ContractConfig) => Promise<Abi>;
}) => {
  const [isDeleting] = useState(false);
  const [functionContent, setFunctionContent] = useState<ParsedFunction[]>([]);

  const parseAbi = useCallback(async () => {
    try {
      const abi = await fetchContractAbi(contract);
      const results = parseAbiViewFunctions(abi);
      setFunctionContent(results);
    } catch (error) {
      console.error('Failed to fetch ABI for contract', contract.name, error);
    }
  }, [contract, fetchContractAbi]);

  useEffect(() => {
    parseAbi();
  }, [parseAbi]);

  return (
    <div className="border px-3 py-[8px] w-full rounded-lg">
      <div className="flex w-full justify-between items-center" />
      <div className="w-full">
        <div className="w-full mt-2">
          <Accordion className="!w-full" collapsible type="single">
            <AccordionItem value="item-1" className="border-none">
              <AccordionTrigger
                style={{
                  backgroundColor: 'white',
                  background: 'white !important',
                }}
                className="!p-0 mb-3"
                size="md"
              >
                <ContractHeader
                  contractName={contract.name}
                  onDelete={onDelete}
                  isDeleting={isDeleting}
                />
              </AccordionTrigger>
              <AccordionContent className="!pb-4 !pt-0">
                <div className="w-full">
                  <div className="flex flex-col gap-4 self-stretch">
                    <SyntaxSection />
                    <DescriptionSection />
                  </div>
                  <hr className="w-full border-t border-dashed border-gray-200 mt-2 mb-4" />
                  <FunctionsSection
                    contractName={contract.name}
                    functionContent={functionContent}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
      <ContractDetails contract={contract} />
    </div>
  );
};
