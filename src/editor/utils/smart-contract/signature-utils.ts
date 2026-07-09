export function parseFunctionSignature(signature: string) {
  const fnMatch = signature.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
  if (!fnMatch) return null;

  const name = fnMatch[1];
  const argsPart = fnMatch[2].trim();

  if (!argsPart) {
    return { name, args: '' };
  }

  const argsArray = argsPart
    .split(',')
    .map((arg) => {
      const match = arg.trim().match(/^\[(.+)\]$/);
      const match2 = match?.[1].includes('[')
        ? `_${match[1]}`
        : `"_${match?.[1]}"`;
      return match ? `${match2}` : null;
    })
    .filter(Boolean);

  return {
    name,
    args: argsArray.join(','),
  };
}

export function getFunctionWithArguments(
  functions: { functionName: string }[],
): { functionName: string } | null {
  if (!Array.isArray(functions) || functions.length === 0) {
    return null;
  }

  for (const fn of functions) {
    const match = fn.functionName.match(/\(([^)]*)\)/);
    if (match && match[1].trim().length > 0) {
      return fn;
    }
  }

  return functions[0];
}
