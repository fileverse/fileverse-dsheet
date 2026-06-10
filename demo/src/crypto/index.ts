import { generateECKeyPair } from '@fileverse/crypto/ecies';
import { fromUint8Array } from 'js-base64';

export const crypto = {
  generateKeyPair: () => {
    const pair = generateECKeyPair();
    return {
      privateKey: pair.privateKey as Uint8Array,
      privateKeyBase64: fromUint8Array(pair.privateKey as Uint8Array, true),
    };
  },
};
