import { describe, expect, it } from 'bun:test';
import { enrichPath, getCommonPath, parsePath } from '../../src/converter/path-parser.js';

describe('parsePath', () => {
  it('simple path', () => {
    expect(parsePath({ path: 'R.a' })).toEqual([{ el: 'a' }]);
  });

  it('nested path', () => {
    expect(parsePath({ path: 'R.a.b' })).toEqual([{ el: 'a' }, { el: 'b' }]);
  });

  it('empty path after resource', () => {
    expect(parsePath({ path: 'R' })).toEqual([]);
  });

  it('slicing info lands on last element', () => {
    const result = parsePath({
      path: 'R.a.b',
      slicing: {
        discriminator: [{ type: 'pattern', path: 'code' }],
        rules: 'open',
      },
      min: 1,
      max: '*',
    });
    expect(result).toEqual([
      { el: 'a' },
      {
        el: 'b',
        slicing: {
          discriminator: [{ type: 'pattern', path: 'code' }],
          rules: 'open',
          min: 1,
        },
      },
    ]);
  });

  it('sliceName + slice cardinality on last element', () => {
    const result = parsePath({
      path: 'R.a',
      sliceName: 's1',
      min: 0,
      max: '2',
    });
    expect(result).toEqual([
      {
        el: 'a',
        sliceName: 's1',
        slice: { min: 0, max: 2 },
      },
    ]);
  });
});

describe('getCommonPath', () => {
  it('common prefix of two paths', () => {
    expect(
      getCommonPath([{ el: 'a' }, { el: 'b' }, { el: 'c' }], [{ el: 'a' }, { el: 'b' }, { el: 'd' }]),
    ).toEqual([{ el: 'a' }, { el: 'b' }]);
  });

  it('paths with no overlap', () => {
    expect(getCommonPath([{ el: 'a' }], [{ el: 'b' }])).toEqual([]);
  });

  it('empty paths', () => {
    expect(getCommonPath([], [{ el: 'a' }])).toEqual([]);
  });

  it('identical paths', () => {
    const path = [{ el: 'a' }, { el: 'b' }];
    expect(getCommonPath(path, path)).toEqual(path);
  });

  it('common path of sliced siblings', () => {
    const path1 = parsePath({ path: 'R.a.c', sliceName: 's1' });
    path1.push({ el: 'b' });
    const path2 = parsePath({ path: 'R.a.c', sliceName: 's2' });
    expect(getCommonPath(path1, path2)).toEqual([{ el: 'a' }, { el: 'c' }]);
  });
});

describe('enrichPath', () => {
  it('inherits slicing info from previous path', () => {
    const prev = [{ el: 'a', slicing: { rules: 'open' } }, { el: 'b' }];
    const next = [{ el: 'a' }, { el: 'b' }, { el: 'c' }];
    expect(enrichPath(prev, next)).toEqual([
      { el: 'a', slicing: { rules: 'open' } },
      { el: 'b' },
      { el: 'c' },
    ]);
  });

  it('inherits sliceName from previous path', () => {
    const prev = [{ el: 'a', sliceName: 's1' }];
    const next = [{ el: 'a' }, { el: 'b' }];
    expect(enrichPath(prev, next)).toEqual([{ el: 'a', sliceName: 's1' }, { el: 'b' }]);
  });

  it('different paths inherit nothing', () => {
    expect(enrichPath([{ el: 'a' }], [{ el: 'b' }])).toEqual([{ el: 'b' }]);
  });
});
