/**
 * Constants Patch for @fileverse-dev/formulajs
 *
 * Add "Kirha" to the SERVICES_API_KEY object in src/utils/constants.js
 */

// Original:
var SERVICES_API_KEY_ORIGINAL = {
  Etherscan: "Etherscan",
  Coingecko: "Coingecko",
  Safe: "Safe",
  Basescan: "Basescan",
  Gnosisscan: "Gnosisscan",
  Firefly: "Firefly",
  GnosisPay: "GnosisPay",
  Neynar: "Neynar",
  Defillama: "Defillama",
  DuneSim: "DuneSim"
};

// Updated (add Kirha):
var SERVICES_API_KEY_UPDATED = {
  Etherscan: "Etherscan",
  Coingecko: "Coingecko",
  Safe: "Safe",
  Basescan: "Basescan",
  Gnosisscan: "Gnosisscan",
  Firefly: "Firefly",
  GnosisPay: "GnosisPay",
  Neynar: "Neynar",
  Defillama: "Defillama",
  DuneSim: "DuneSim",
  Kirha: "Kirha"  // <-- ADD THIS LINE
};
