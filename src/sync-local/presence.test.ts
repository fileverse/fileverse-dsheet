import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_COLOR,
  buildIdentityMap,
  identitySignature,
  mergePresence,
} from './presence';

describe('dSheet collaboration presence', () => {
  it('keeps cell cursor movement out of the authoritative roster signature', () => {
    const before = new Map<number, Record<string, unknown>>([
      [
        1,
        {
          socketId: 'socket-a',
          user: { name: 'Ada', color: '#123456', isEns: true },
          cell: { r: 1, c: 2, sheetId: 'sheet-1' },
        },
      ],
    ]);
    const after = new Map<number, Record<string, unknown>>([
      [
        1,
        {
          socketId: 'socket-a',
          user: { name: 'Ada', color: '#123456', isEns: true },
          cell: { r: 99, c: 42, sheetId: 'sheet-2' },
        },
      ],
    ]);

    expect(identitySignature(['socket-a'], buildIdentityMap(before))).toBe(
      identitySignature(['socket-a'], buildIdentityMap(after)),
    );
  });

  it('uses the server socket roster as the authoritative collaborator set', () => {
    const identities = buildIdentityMap(
      new Map<number, Record<string, unknown>>([
        [
          1,
          {
            socketId: 'socket-a',
            user: { name: 'Ada', color: '#123456', isEns: false },
          },
        ],
        [
          2,
          {
            socketId: 'stale-awareness-only',
            user: { name: 'Grace', color: '#abcdef', isEns: false },
          },
        ],
      ]),
    );

    expect(mergePresence(['socket-a', 'socket-b'], identities)).toEqual([
      {
        clientId: 'socket-a',
        name: 'Ada',
        color: '#123456',
        isEns: false,
        isPlaceholder: false,
      },
      {
        clientId: 'socket-b',
        name: '',
        color: PLACEHOLDER_COLOR,
        isEns: '',
        isPlaceholder: true,
      },
    ]);
  });
});
