/**
 * KIRHA Metadata for @fileverse-dev/formulajs
 *
 * Add this file to: src/crypto/kirha/metadata.js
 */

export const KIRHA_metadata = {
  LOGO: "https://kirha.ai/favicon.ico",
  BRAND_COLOR: "#f5f8ff",
  BRAND_SECONDARY_COLOR: "#6366f1",
  n: "KIRHA",
  t: 20,
  API_KEY: "Kirha",
  d: "Query Kirha AI for lead enrichment, onchain data, and web3 intelligence.",
  a: "Retrieves data from Kirha's AI-powered search. Users can include formatting instructions in their prompt to control the output format via summarization.",
  p: [
    {
      name: "prompt",
      detail: "The search query with optional formatting instructions. Include output format preferences in your prompt.",
      example: `"get the 5 latest transactions of 0xfA89... return only explorer links separated with newlines"`,
      require: "m",
      type: "string"
    },
    {
      name: "verticalId",
      detail: "The vertical/category to search. E.g., 'onchain', 'leads', 'web3'.",
      example: `"onchain"`,
      require: "m",
      type: "string"
    }
  ]
};
