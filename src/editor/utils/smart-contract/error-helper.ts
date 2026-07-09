import type { Hex } from 'viem';

export class ContractNotFound extends Error {
  constructor(contractName: string) {
    super(`Contract "${contractName}" not found in registry`);
  }
}

export class InvalidFunctionName extends Error {
  constructor(functionName: string) {
    super(`Function "${functionName}" not in ABI "`);
  }
}

export class ReadOnlyError extends Error {
  constructor(functionName: string) {
    super(`Function "${functionName}" is not read‑only`);
  }
}

export class InvalidParams extends Error {
  constructor(message: string) {
    super(`Invalid Function Params: ${message}`);
  }
}

export class UnsupportedChainError extends Error {
  constructor(chainId: number | Hex | string) {
    super(`Chain ${chainId} is not supported`);
  }
}

export class ContractAbiFetchError extends Error {
  constructor(contractAddress: string, chainId: number | Hex) {
    super(
      `Failed to fetch contract ABI for ${contractAddress} on chain ${chainId}`,
    );
  }
}
