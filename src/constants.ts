export {
  ERROR_MESSAGES_FLAG,
  SERVICES_API_KEY,
} from './editor/constants/shared-constants';

export const ENS_PRESENCE_COLOR = '#5298FF';

export const COLLAB_PRESENCE_COLORS = [
  '#30bced',
  '#6eeb83',
  '#fa69d1',
  '#ecd444',
  '#ee6352',
  '#db3041',
  '#0ad7f2',
  '#1bff39',
] as const;

function colorForClient(clientId: number): string {
  return COLLAB_PRESENCE_COLORS[clientId % COLLAB_PRESENCE_COLORS.length];
}

function randomPresenceColor(): string {
  return (
    '#' +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, '0')
  );
}

/** ENS brand color, else `color`, else palette by `clientId`, else random. */
export function presenceColor(
  isEns: boolean | undefined,
  color?: string,
  clientId?: number,
): string {
  if (isEns) return ENS_PRESENCE_COLOR;
  return (
    color ??
    (clientId != null ? colorForClient(clientId) : randomPresenceColor())
  );
}
