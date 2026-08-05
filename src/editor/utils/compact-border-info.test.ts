import { describe, expect, it } from 'vitest';
import { compactBorderInfo } from '../../sheet-engine/core/paste/paste-border-utils';

describe('compactBorderInfo', () => {
  it('drops cell borders with only empty or transparent sides', () => {
    const input = [
      {
        rangeType: 'cell',
        value: {
          row_index: 0,
          col_index: 0,
          l: {},
          r: { style: 1, color: 'transparent' },
        },
      },
      {
        rangeType: 'cell',
        value: {
          row_index: 1,
          col_index: 1,
          b: { style: 1, color: '#000' },
        },
      },
    ];

    expect(compactBorderInfo(input)).toEqual([
      {
        rangeType: 'cell',
        value: {
          row_index: 1,
          col_index: 1,
          b: { style: 1, color: '#000' },
        },
      },
    ]);
  });

  it('returns undefined when nothing changes', () => {
    const input = [
      {
        rangeType: 'cell',
        value: {
          row_index: 0,
          col_index: 0,
          t: { style: 1, color: '#000' },
        },
      },
    ];
    expect(compactBorderInfo(input)).toBeUndefined();
  });
});
