/**
 * KIRHA Function Implementation for @fileverse-dev/formulajs
 *
 * Add this file to: src/crypto/kirha/kirha.js
 */

import { ERROR_MESSAGES_FLAG } from '../utils/constants.js';

// Response types
export interface KirhaToolUsageItem {
  tool_name: string;
  credits?: number;
  step_id?: string;
  parameters?: Record<string, unknown>;
  output?: unknown;
}

export interface KirhaSuccessResponse {
  summary: string;
  toolUsage: KirhaToolUsageItem[];
}

export interface KirhaErrorResponse {
  type: string;
  message: string;
  functionName: string;
  apiKeyName?: string;
}

export type KirhaResponse = KirhaSuccessResponse | KirhaErrorResponse;

/**
 * Get API key from the global formulaCache or localStorage
 */
function getKirhaApiKey(): string | null {
  // Check global formulaCache first (set by dsheet)
  if (typeof window !== 'undefined') {
    // @ts-ignore
    const formulaCache = window.formulaCache;
    if (formulaCache?.apiKeys?.KIRHA_API_KEY) {
      return formulaCache.apiKeys.KIRHA_API_KEY;
    }
    // Fallback to localStorage
    const storedKey = localStorage.getItem('KIRHA_API_KEY');
    if (storedKey) {
      return storedKey;
    }
  }
  return null;
}

/**
 * KIRHA - Query Kirha AI for lead enrichment, onchain data, and web3 intelligence
 *
 * @param {string} prompt - The search query with optional formatting instructions
 * @param {string} verticalId - The vertical/category to search (e.g., 'onchain', 'leads', 'web3')
 * @returns {Promise<KirhaResponse>} The search results or error
 *
 * @example
 * // Get latest transactions with formatted output
 * =KIRHA("get the 5 latest transactions of 0xfA89... return only explorer links", "onchain")
 *
 * @example
 * // Lead enrichment
 * =KIRHA("find contact info for web3 founders in San Francisco", "leads")
 */
export async function KIRHA(
  prompt: string,
  verticalId: string
): Promise<KirhaResponse> {
  // Validate required parameters
  if (!prompt || typeof prompt !== 'string') {
    return {
      type: ERROR_MESSAGES_FLAG.INVALID_PARAM,
      message: 'Prompt is required and must be a string',
      functionName: 'KIRHA'
    };
  }

  if (!verticalId || typeof verticalId !== 'string') {
    return {
      type: ERROR_MESSAGES_FLAG.INVALID_PARAM,
      message: 'Vertical ID is required and must be a string',
      functionName: 'KIRHA'
    };
  }

  // Get API key
  const apiKey = getKirhaApiKey();
  if (!apiKey) {
    return {
      type: ERROR_MESSAGES_FLAG.MISSING_KEY,
      message: 'Kirha API key is required. Please add your API key.',
      functionName: 'KIRHA',
      apiKeyName: 'KIRHA_API_KEY'
    };
  }

  try {
    const response = await fetch('https://api.kirha.ai/chat/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: prompt,
        vertical_id: verticalId,
        include_planning: true
      })
    });

    // Handle HTTP errors
    if (!response.ok) {
      if (response.status === 401) {
        return {
          type: ERROR_MESSAGES_FLAG.INVALID_API_KEY,
          message: 'Invalid Kirha API key. Please check your API key.',
          functionName: 'KIRHA',
          apiKeyName: 'KIRHA_API_KEY'
        };
      }

      if (response.status === 429) {
        return {
          type: ERROR_MESSAGES_FLAG.RATE_LIMIT,
          message: 'Kirha API rate limit exceeded. Please try again later.',
          functionName: 'KIRHA',
          apiKeyName: 'KIRHA_API_KEY'
        };
      }

      return {
        type: ERROR_MESSAGES_FLAG.NETWORK_ERROR,
        message: `Kirha API error: ${response.status} ${response.statusText}`,
        functionName: 'KIRHA'
      };
    }

    const data = await response.json();

    // Extract tool usage for logging/transparency
    const toolUsage: KirhaToolUsageItem[] = (data.raw_data || []).map(
      (item: Record<string, unknown>) => ({
        tool_name: item.tool_name as string,
        credits: item.credits as number | undefined,
        step_id: item.step_id as string | undefined,
        parameters: item.parameters as Record<string, unknown> | undefined,
        output: item.output
      })
    );

    // Return the summary and tool usage
    return {
      summary: data.summary || '',
      toolUsage
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      type: ERROR_MESSAGES_FLAG.NETWORK_ERROR,
      message: `Failed to call Kirha API: ${errorMessage}`,
      functionName: 'KIRHA'
    };
  }
}

export default KIRHA;
