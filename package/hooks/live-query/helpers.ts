import { SUPPORTED_LIVE_QUERY_FUNCTIONS } from './constants';

export function getFirstArgument(formula: string) {
  const matches = formula.match(/"([^"]*)"/g);
  if (matches && matches.length > 0) {
    return matches[0].replace(/"/g, '');
  }
  return null;
}
export const isSupported = (functionName: string, formula: string) => {
  const name = functionName.toLowerCase();
  if (name === 'coingecko') {
    return getFirstArgument(formula) === 'price';
  }
  return SUPPORTED_LIVE_QUERY_FUNCTIONS.includes(name);
};
