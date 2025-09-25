import { describe, expect, it } from 'bun:test';
import { calculateActions } from '../../src/converter/action-calculator';
import { parsePath } from '../../src/converter/path-parser';

describe('Action Calculator', () => {
  it('should calculate exit and enter for sibling elements', () => {
    const prevPath = parsePath({ path: 'R.a' });
    const newPath = parsePath({ path: 'R.b' });

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'b' },
    ]);
  });

  it('should calculate multiple enters for deeper path', () => {
    const prevPath = parsePath({ path: 'R.a' });
    const newPath = parsePath({ path: 'R.b.c' });

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'b' },
      { type: 'enter', el: 'c' },
    ]);
  });

  it('should calculate multiple exits for shallower path', () => {
    const prevPath = parsePath({ path: 'R.a.b.c' });
    const newPath = parsePath({ path: 'R.x' });

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'c' },
      { type: 'exit', el: 'b' },
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'x' },
    ]);
  });

  it('should handle empty new path', () => {
    const prevPath = parsePath({ path: 'R.a.b.c' });
    const newPath: any[] = [];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'c' },
      { type: 'exit', el: 'b' },
      { type: 'exit', el: 'a' },
    ]);
  });

  it('should handle slice entry', () => {
    const prevPath: any[] = [];
    const newPath = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'enter', el: 'a' },
      { type: 'enter-slice', sliceName: 's1' },
      { type: 'enter', el: 'b' },
    ]);
  });

  it('should handle slice exit', () => {
    const prevPath = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];
    const newPath: any[] = [];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'b' },
      { type: 'exit-slice', sliceName: 's1', slicing: undefined, slice: undefined },
      { type: 'exit', el: 'a' },
    ]);
  });

  it('should handle slice change', () => {
    const prevPath = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];
    const newPath = [{ el: 'a', sliceName: 's2' }];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'b' },
      { type: 'exit-slice', sliceName: 's1', slicing: undefined, slice: undefined },
      { type: 'enter-slice', sliceName: 's2' },
    ]);
  });

  it('should preserve slicing metadata in exit-slice action', () => {
    const slicing = { discriminator: [{ type: 'value', path: 'code' }] };
    const slice = { min: 1, max: 2 };

    const prevPath = [{ el: 'a', sliceName: 's1', slicing, slice }, { el: 'b' }];
    const newPath: any[] = [];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toContainEqual({
      type: 'exit-slice',
      sliceName: 's1',
      slicing,
      slice,
    });
  });
});
