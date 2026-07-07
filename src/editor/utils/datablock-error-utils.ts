import { ERROR_MESSAGES_FLAG } from '../constants/shared-constants';

type ErrorFlag = (typeof ERROR_MESSAGES_FLAG)[keyof typeof ERROR_MESSAGES_FLAG];

function containsErrorFlag(msg: string): boolean {
  const flags = Object.values(ERROR_MESSAGES_FLAG) as ErrorFlag[];
  return (
    (msg && flags.some((flag) => msg.includes(flag))) || msg?.includes('Error')
  );
}

export const isDatablockError = (value: unknown) => {
  const isObject =
    value !== null && typeof value === 'object' && !Array.isArray(value);
  return (
    isObject &&
    containsErrorFlag((value as { type?: string }).type as string)
  );
};
