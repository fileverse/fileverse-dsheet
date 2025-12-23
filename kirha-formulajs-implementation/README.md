# KIRHA Implementation for @fileverse-dev/formulajs

This folder contains the implementation files needed to add the KIRHA function to the `@fileverse-dev/formulajs` package.

## Files

- `kirha.ts` - Main KIRHA function implementation
- `metadata.js` - Function metadata (logo, description, parameters)
- `index.js` - Export file

## Integration Steps

### 1. Copy files to formulajs

Copy these files to the formulajs package:

```bash
# In the formulajs repo
mkdir -p src/crypto/kirha
cp kirha.ts src/crypto/kirha/kirha.ts
cp metadata.js src/crypto/kirha/metadata.js
cp index.js src/crypto/kirha/index.js
```

### 2. Add to SERVICES_API_KEY

In `src/utils/constants.js`, add Kirha to the API keys:

```javascript
var SERVICES_API_KEY = {
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
  Kirha: "Kirha"  // <-- Add this
};
```

### 3. Add to FUNCTION_LOCALE

In `src/crypto/crypto-metadata.js`, import and add KIRHA_metadata:

```javascript
// Add import at the top
import { KIRHA_metadata } from './kirha/metadata.js';

// Add to FUNCTION_LOCALE array
var FUNCTION_LOCALE = [
  EOA_metadata,
  UNISWAP_metadata,
  COINGECKO_metadata,
  // ... other metadata ...
  KIRHA_metadata,  // <-- Add this
  // ... rest
];
```

### 4. Export KIRHA function

In `src/index.js`, add the KIRHA export:

```javascript
// Add import
import { KIRHA } from './crypto/kirha/kirha.js';

// Add to exports
export {
  // ... other exports ...
  KIRHA,
};
```

### 5. Build and publish

```bash
npm run build
npm version patch
npm publish
```

## Usage

Once integrated, users can use the KIRHA function in dsheets:

```
=KIRHA("get the 5 latest transactions of 0xfA89ee073436cF2e4ef1Fd4130aFfD389E56f2a1, return only explorer links", "onchain")
```

The function returns:
- **summary**: The formatted response based on the prompt instructions
- **toolUsage**: Array of tools used with their credits (for transparency)

## API Reference

### Kirha Search API

**Endpoint**: `POST https://api.kirha.ai/chat/v1/search`

**Headers**:
- `Content-Type: application/json`
- `Authorization: Bearer <KIRHA_API_KEY>`

**Body**:
```json
{
  "query": "your search prompt with formatting instructions",
  "vertical_id": "onchain",
  "include_planning": true
}
```

**Response**:
```json
{
  "summary": "formatted response based on prompt",
  "raw_data": [
    {
      "step_id": "1",
      "tool_name": "web3_explorer",
      "parameters": { ... },
      "output": { ... },
      "credits": 2
    }
  ]
}
```
