import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAddress, type Abi, type Hex } from 'viem';
import type { Cell, WorkbookInstance } from '@sheet-engine/react';
import type {
  ContractConfig,
  ContractRegistry,
  NewContractInput,
  SmartContractConfig,
  SupportedChain,
} from '../types/smart-contract';
import type { SmartContractQueryHandler } from '../utils/after-update-cell';
import { formulaResponseUiSync } from '../utils/formula-ui-sync';
import {
  POPULAR_CONTRACTS_MAP,
  POPULAR_CONTRACT_NAMES,
} from '../utils/smart-contract/constants';
import {
  executeSmartContractCall,
  fetchContractAbi,
  normalizeGridArray,
  parseCallSignature,
  type SmartContractRuntimeDeps,
} from '../utils/smart-contract/reading-utils';

const buildRegistry = (
  persisted: ContractConfig[],
  memory: ContractConfig[],
): ContractRegistry => {
  const userMap = Object.fromEntries(
    [...persisted, ...memory].map((c) => [c.name, c]),
  );
  return { ...POPULAR_CONTRACTS_MAP, ...userMap };
};

export const useSmartContract = (config?: SmartContractConfig) => {
  const [showSmartContractModal, setShowSmartContractModal] = useState(false);
  const [memoryContracts, setMemoryContracts] = useState<ContractConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [smartContractReadingError, setSmartContractReadingError] = useState({
    hasError: false,
    errorMessage: '',
  });

  const abiCacheRef = useRef<Record<string, Abi>>({});
  const registryMapRef = useRef<ContractRegistry>({});

  const persistedContracts = config?.contracts ?? [];

  const userContracts = useMemo(
    () => [...persistedContracts, ...memoryContracts],
    [persistedContracts, memoryContracts],
  );

  const registry = useMemo(
    () => buildRegistry(persistedContracts, memoryContracts),
    [persistedContracts, memoryContracts],
  );

  useEffect(() => {
    registryMapRef.current = registry;
  }, [registry]);

  const runtimeDeps = useMemo<SmartContractRuntimeDeps>(
    () => ({
      resolveAbi: config?.resolveAbi,
      rpcConfig: config?.rpcConfig,
      abiCache: abiCacheRef.current,
    }),
    [config?.resolveAbi, config?.rpcConfig],
  );

  const fetchContractAbiFn = useCallback(
    (contract: ContractConfig) => fetchContractAbi(contract, runtimeDeps),
    [runtimeDeps],
  );

  const displayedUserContracts = useMemo(() => {
    if (!searchQuery) return userContracts;
    const q = searchQuery.toLowerCase();
    return userContracts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.network.toLowerCase().includes(q),
    );
  }, [userContracts, searchQuery]);

  const handleSearch = useCallback((searchText: string) => {
    setSearchQuery(searchText);
  }, []);

  const onImportContract = useCallback(
    async (
      address: Hex,
      network: SupportedChain,
      abiJson: string,
      smartContractName: string,
    ) => {
      const abi = JSON.parse(abiJson) as Abi;
      const input: NewContractInput = {
        address,
        network,
        name: smartContractName,
        abi,
      };

      if (config?.onAddContract) {
        await config.onAddContract(input);
      } else {
        const memoryEntry: ContractConfig = {
          name: smartContractName,
          address,
          network,
          abiHash: `memory:${smartContractName}`,
        };
        abiCacheRef.current[memoryEntry.abiHash] = abi;
        setMemoryContracts((prev) => [
          ...prev.filter((c) => c.name !== smartContractName),
          memoryEntry,
        ]);
      }

      config?.onSmartContractEvent?.({
        type: 'contract-added',
        contractName: smartContractName,
      });
    },
    [config],
  );

  const onDelete = useCallback(
    async (name: string) => {
      if (POPULAR_CONTRACT_NAMES.has(name)) return;

      const isMemory = memoryContracts.some((c) => c.name === name);
      const isPersisted = persistedContracts.some((c) => c.name === name);

      if (isPersisted && config?.onDeleteContract) {
        await config.onDeleteContract(name);
      } else if (isMemory) {
        setMemoryContracts((prev) => prev.filter((c) => c.name !== name));
      }

      config?.onSmartContractEvent?.({
        type: 'contract-deleted',
        contractName: name,
      });
    },
    [config, memoryContracts, persistedContracts],
  );

  const handleSmartContractQuery: SmartContractQueryHandler = useCallback(
    (sheetApi) => async (callSignature) => {
      if (!config) {
        throw new Error('Smart contract support is not configured');
      }

      setSmartContractReadingError({ hasError: false, errorMessage: '' });

      const [contractName, functionName, ...args] = callSignature as [
        string,
        string,
        ...unknown[],
      ];
      if (isAddress(contractName)) {
        args.shift();
      }

      const { row, column, newValue, sheetEditorRef, formulaResponseUiSync: sync } =
        sheetApi;

      try {
        sheetEditorRef.current?.setCellValue(row, column, {
          ...newValue,
          m: 'Loading Smart contract ...',
        });

        const callerParams = await parseCallSignature(
          callSignature,
          registryMapRef.current,
          runtimeDeps,
        );

        const normalisedArgs = normalizeGridArray(
          args,
          functionName,
          callerParams.abi,
        );
        callerParams.args = normalisedArgs;

        const { response, staticInstructions } = await executeSmartContractCall(
          callerParams,
          runtimeDeps,
        );

        if (Array.isArray(response)) {
          await sync({
            row,
            column,
            newValue: newValue as Record<string, string>,
            apiData: response,
            sheetEditorRef,
            staticLinesAbove: staticInstructions,
          });
          sheetEditorRef.current?.clearCellError(row, column);
        } else if (['string', 'number', 'boolean'].includes(typeof response)) {
          const key =
            typeof callerParams.functionName === 'string'
              ? callerParams.functionName
              : '0';
          await sync({
            row,
            column,
            newValue: newValue as Record<string, string>,
            apiData: [{ [key]: response }],
            sheetEditorRef,
          });
          sheetEditorRef.current?.clearCellError(row, column);
        } else {
          sheetEditorRef.current?.setCellValue(row, column, {
            ...newValue,
            m: 'Unsupported return type',
            isDataBlockFormula: true,
          });
        }

        config.onSmartContractEvent?.({
          type: 'query-success',
          contractName,
          functionName,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to execute smart contract';

        setSmartContractReadingError({
          hasError: true,
          errorMessage: message,
        });

        sheetEditorRef.current?.setCellValue(row, column, {
          ...newValue,
          m: '#ERROR',
          isDataBlockFormula: true,
        });
        sheetEditorRef.current?.setCellError(row, column, {
          title: 'Smart Contract Error',
          message,
        });

        config.onSmartContractEvent?.({
          type: 'query-error',
          contractName,
          functionName,
          errorMessage: message,
        });
      }
    },
    [config, runtimeDeps],
  );

  const enabled = Boolean(config);

  return {
    enabled,
    showSmartContractModal,
    setShowSmartContractModal,
    userSmartContracts: displayedUserContracts,
    allUserContracts: userContracts,
    registryMapRef,
    handleSmartContractQuery: enabled ? handleSmartContractQuery : undefined,
    onImportContract,
    onDelete,
    handleSearch,
    smartContractReadingError,
    setSmartContractReadingError,
    fetchContractAbi: fetchContractAbiFn,
  };
};

export type UseSmartContractReturn = ReturnType<typeof useSmartContract>;
