import { describe, expect, it } from 'bun:test';
import { calculateActions } from '../../src/converter/action-calculator';
import { parsePath } from '../../src/converter/path-parser';
import type { PathComponent, StructureDefinitionElement } from '../../src/converter/types';

describe('Action Calculator', () => {
  it('should calculate exit and enter for sibling elements', () => {
    const prevPath = parsePath({ path: 'R.a' } as StructureDefinitionElement);
    const newPath = parsePath({ path: 'R.b' } as StructureDefinitionElement);

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'b' },
    ]);
  });

  it('should calculate multiple enters for deeper path', () => {
    const prevPath = parsePath({ path: 'R.a' } as StructureDefinitionElement);
    const newPath = parsePath({ path: 'R.b.c' } as StructureDefinitionElement);

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'b' },
      { type: 'enter', el: 'c' },
    ]);
  });

  it('should calculate multiple exits for shallower path', () => {
    const prevPath = parsePath({ path: 'R.a.b.c' } as StructureDefinitionElement);
    const newPath = parsePath({ path: 'R.x' } as StructureDefinitionElement);

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'c' },
      { type: 'exit', el: 'b' },
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'x' },
    ]);
  });

  it('should handle empty new path', () => {
    const prevPath = parsePath({ path: 'R.a.b.c' } as StructureDefinitionElement);
    const newPath: PathComponent[] = [];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'c' },
      { type: 'exit', el: 'b' },
      { type: 'exit', el: 'a' },
    ]);
  });

  it('should handle slice entry', () => {
    const prevPath: PathComponent[] = [];
    const newPath: PathComponent[] = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'enter', el: 'a' },
      { type: 'enter-slice', sliceName: 's1' },
      { type: 'enter', el: 'b' },
    ]);
  });

  it('should handle slice exit', () => {
    const prevPath: PathComponent[] = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];
    const newPath: PathComponent[] = [];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'b' },
      { type: 'exit-slice', sliceName: 's1', slicing: undefined, slice: undefined },
      { type: 'exit', el: 'a' },
    ]);
  });

  it('should handle slice change', () => {
    const prevPath: PathComponent[] = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];
    const newPath: PathComponent[] = [{ el: 'a', sliceName: 's2' }];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toEqual([
      { type: 'exit', el: 'b' },
      { type: 'exit-slice', sliceName: 's1', slicing: undefined, slice: undefined },
      { type: 'enter-slice', sliceName: 's2' },
    ]);
  });

  it('should preserve slicing metadata in exit-slice action', () => {
    const slicing = {
      discriminator: [{ type: 'value', path: 'code' }],
    };
    const slice = {
      min: 1,
      max: 2,
    };

    const prevPath: PathComponent[] = [{ el: 'a', sliceName: 's1', slicing, slice }, { el: 'b' }];
    const newPath: PathComponent[] = [];

    const actions = calculateActions(prevPath, newPath);

    expect(actions).toContainEqual({
      type: 'exit-slice',
      sliceName: 's1',
      slicing,
      slice,
    });
  });
});
