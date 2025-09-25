import { describe, expect, it } from 'bun:test';
import { enrichPath, getCommonPath, parsePath } from '../../src/converter/path-parser';

describe('Path Parser', () => {
  describe('parsePath', () => {
    it('should parse simple path', () => {
      const result = parsePath({ path: 'R.a' });
      expect(result).toEqual([{ el: 'a' }]);
    });

    it('should parse nested path', () => {
      const result = parsePath({ path: 'R.a.b' });
      expect(result).toEqual([{ el: 'a' }, { el: 'b' }]);
    });

    it('should handle empty path after resource', () => {
      const result = parsePath({ path: 'R' });
      expect(result).toEqual([]);
    });

    it('should add slicing info to last element', () => {
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

    it('should add sliceName info to last element', () => {
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
          slice: {
            min: 0,
            max: 2,
          },
        },
      ]);
    });
  });

  describe('getCommonPath', () => {
    it('should find common path between two paths', () => {
      const path1 = [{ el: 'a' }, { el: 'b' }, { el: 'c' }];
      const path2 = [{ el: 'a' }, { el: 'b' }, { el: 'd' }];

      const result = getCommonPath(path1, path2);
      expect(result).toEqual([{ el: 'a' }, { el: 'b' }]);
    });

    it('should handle paths with no common elements', () => {
      const path1 = [{ el: 'a' }];
      const path2 = [{ el: 'b' }];

      const result = getCommonPath(path1, path2);
      expect(result).toEqual([]);
    });

    it('should handle empty paths', () => {
      const result = getCommonPath([], [{ el: 'a' }]);
      expect(result).toEqual([]);
    });

    it('should handle identical paths', () => {
      const path = [{ el: 'a' }, { el: 'b' }];
      const result = getCommonPath(path, path);
      expect(result).toEqual(path);
    });
  });

  describe('enrichPath', () => {
    it('should inherit slicing info from previous path', () => {
      const prevPath = [{ el: 'a', slicing: { rules: 'open' } }, { el: 'b' }];
      const newPath = [{ el: 'a' }, { el: 'b' }, { el: 'c' }];

      const result = enrichPath(prevPath, newPath);
      expect(result).toEqual([{ el: 'a', slicing: { rules: 'open' } }, { el: 'b' }, { el: 'c' }]);
    });

    it('should inherit sliceName from previous path', () => {
      const prevPath = [{ el: 'a', sliceName: 's1' }];
      const newPath = [{ el: 'a' }, { el: 'b' }];

      const result = enrichPath(prevPath, newPath);
      expect(result).toEqual([{ el: 'a', sliceName: 's1' }, { el: 'b' }]);
    });

    it('should handle different paths', () => {
      const prevPath = [{ el: 'a' }];
      const newPath = [{ el: 'b' }];

      const result = enrichPath(prevPath, newPath);
      expect(result).toEqual([{ el: 'b' }]);
    });
  });
});
