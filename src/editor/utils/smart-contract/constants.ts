import { base, gnosis, mainnet, sepolia } from 'viem/chains';
import type { ContractConfig } from '../../types/smart-contract';
import { SupportedChain } from '../../types/smart-contract';

export const DEFAULT_RPC_URL_MAP: Record<SupportedChain, string[]> = {
  [SupportedChain.Sepolia]: [
    'https://eth-sepolia.g.alchemy.com/v2/iu7jObrJF2MAYHNrVwuh7cah4xg9g8iN',
  ],
  [SupportedChain.Gnosis]: [
    'https://gnosis-mainnet.g.alchemy.com/v2/yB7FBP7D-qhIPCGwiU1X-',
  ],
  [SupportedChain.Base]: [
    'https://base-mainnet.g.alchemy.com/v2/yB7FBP7D-qhIPCGwiU1X-',
  ],
  [SupportedChain.Ethereum]: [
    'https://eth-mainnet.g.alchemy.com/v2/yB7FBP7D-qhIPCGwiU1X-',
  ],
};

export const SUPPORTED_VIEM_CHAIN_MAP = {
  [SupportedChain.Sepolia]: sepolia,
  [SupportedChain.Gnosis]: gnosis,
  [SupportedChain.Base]: base,
  [SupportedChain.Ethereum]: mainnet,
};

export const SUPPORTED_CHAIN_ID_MAP: Record<number, SupportedChain> = {
  11155111: SupportedChain.Sepolia,
  100: SupportedChain.Gnosis,
  8453: SupportedChain.Base,
  1: SupportedChain.Ethereum,
};

export const CHAIN_NAME_MAP: Record<string, SupportedChain> = {
  ['ethereum,eth,mainnet']: SupportedChain.Ethereum,
  ['gnosis,xdai']: SupportedChain.Gnosis,
  ['base']: SupportedChain.Base,
  ['sepolia']: SupportedChain.Sepolia,
};

export const POPULAR_CONTRACTS_MAP: Record<string, ContractConfig> = {
  USDC: {
    name: 'USDC',
    network: SupportedChain.Ethereum,
    abiHash: '',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
  DAI: {
    name: 'DAI',
    network: SupportedChain.Ethereum,
    abiHash: '',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  },
  USDT: {
    name: 'USDT',
    network: SupportedChain.Ethereum,
    abiHash: '',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  },
  PudgyPenguins: {
    name: 'PudgyPenguins',
    network: SupportedChain.Ethereum,
    abiHash: '',
    address: '0xbd3531da5cf5857e7cfaa92426877b022e612cf8',
  },
  BAYC: {
    name: 'BAYC',
    network: SupportedChain.Ethereum,
    abiHash: '',
    address: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
  },
};

export const UNIVERSAL_ENS_RESOLVER_ADDRESS =
  '0xce01f8eee7E479C928F8919abD53E553a36CeF67';

export const RESOLVER_FUNCTION_NAME = 'findResolver';

export const SMART_CONTRACT_PANEL_ID = 'smart-contract-list-view';

export const POPULAR_CONTRACT_NAMES = new Set(
  Object.keys(POPULAR_CONTRACTS_MAP),
);
