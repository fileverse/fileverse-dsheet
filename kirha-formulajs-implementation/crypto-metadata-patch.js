/**
 * Crypto Metadata Patch for @fileverse-dev/formulajs
 *
 * Add KIRHA_metadata to the FUNCTION_LOCALE array in src/crypto/crypto-metadata.js
 */

// 1. Add import at the top of the file:
// import { KIRHA_metadata } from './kirha/metadata.js';

// 2. Add KIRHA_metadata to the FUNCTION_LOCALE array:

var FUNCTION_LOCALE = [
  EOA_metadata,
  UNISWAP_metadata,
  COINGECKO_metadata,
  DEFILLAMA_metadata,
  BASE_metadata,
  GNOSIS_metadata,
  ETHERSCAN_metadata,
  PNL_metadata,
  SAFE_metadata,
  BLOCKSCOUT_metadata,
  AAVE_metadata,
  LENS_metadata,
  FARCASTER_metadata,
  FIREFLY_metadata,
  Neynar_metadata,
  SMARTCONTRACT_metadata,
  TALLY_metadata,
  DUNESIM_metadata,
  PRICE_metadata,
  WALLET_metadata,
  YIELD_metadata,
  CIRCLES_metadata,
  KIRHA_metadata,  // <-- ADD THIS LINE
  // ... rest of the array (POLYMARKET, PRIVACYPOOL, etc.)
];
