import { describe, expect, it } from 'bun:test';
import { calculateActions } from '../../src/converter/action-calculator.js';
import { parsePath } from '../../src/converter/path-parser.js';
import type { PathComponent, StructureDefinitionElement } from '../../src/converter/types.js';

describe('calculateActions', () => {
  it('exit + enter for siblings', () => {
    expect(
      calculateActions(
        parsePath({ path: 'R.a' } as StructureDefinitionElement),
        parsePath({ path: 'R.b' } as StructureDefinitionElement),
      ),
    ).toEqual([
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'b' },
    ]);
  });

  it('multiple enters for deeper path', () => {
    expect(
      calculateActions(
        parsePath({ path: 'R.a' } as StructureDefinitionElement),
        parsePath({ path: 'R.b.c' } as StructureDefinitionElement),
      ),
    ).toEqual([
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'b' },
      { type: 'enter', el: 'c' },
    ]);
  });

  it('multiple exits for shallower path', () => {
    expect(
      calculateActions(
        parsePath({ path: 'R.a.b.c' } as StructureDefinitionElement),
        parsePath({ path: 'R.x' } as StructureDefinitionElement),
      ),
    ).toEqual([
      { type: 'exit', el: 'c' },
      { type: 'exit', el: 'b' },
      { type: 'exit', el: 'a' },
      { type: 'enter', el: 'x' },
    ]);
  });

  it('empty new path exits all', () => {
    expect(
      calculateActions(parsePath({ path: 'R.a.b.c' } as StructureDefinitionElement), []),
    ).toEqual([
      { type: 'exit', el: 'c' },
      { type: 'exit', el: 'b' },
      { type: 'exit', el: 'a' },
    ]);
  });

  it('slice entry', () => {
    const next: PathComponent[] = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];
    expect(calculateActions([], next)).toEqual([
      { type: 'enter', el: 'a' },
      { type: 'enter-slice', sliceName: 's1' },
      { type: 'enter', el: 'b' },
    ]);
  });

  it('slice exit on path collapse', () => {
    const prev: PathComponent[] = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];
    expect(calculateActions(prev, [])).toEqual([
      { type: 'exit', el: 'b' },
      { type: 'exit-slice', sliceName: 's1', slicing: undefined, slice: undefined },
      { type: 'exit', el: 'a' },
    ]);
  });

  it('slice change (s1 → s2 under same parent)', () => {
    const prev: PathComponent[] = [{ el: 'a', sliceName: 's1' }, { el: 'b' }];
    const next: PathComponent[] = [{ el: 'a', sliceName: 's2' }];
    expect(calculateActions(prev, next)).toEqual([
      { type: 'exit', el: 'b' },
      { type: 'exit-slice', sliceName: 's1', slicing: undefined, slice: undefined },
      { type: 'enter-slice', sliceName: 's2' },
    ]);
  });

  it('exit-slice preserves slicing/slice metadata', () => {
    const slicing = { discriminator: [{ type: 'value', path: 'code' }] };
    const slice = { min: 1, max: 2 };
    const prev: PathComponent[] = [{ el: 'a', sliceName: 's1', slicing, slice }, { el: 'b' }];
    expect(calculateActions(prev, [])).toContainEqual({
      type: 'exit-slice',
      sliceName: 's1',
      slicing,
      slice,
    });
  });

  it('exit from sliced element to non-sliced sibling', () => {
    const prev = parsePath({ path: 'Patient.name' } as StructureDefinitionElement);
    const next = parsePath({
      sliceName: 'race',
      path: 'Patient.extension',
      type: [{ code: 'Extension' }],
    } as StructureDefinitionElement);
    expect(calculateActions(prev, next)).toEqual([
      { type: 'exit', el: 'name' },
      { type: 'enter', el: 'extension' },
      { type: 'enter-slice', sliceName: 'race' },
    ]);
  });

  it('slice within slice transition', () => {
    const prev = [{ sliceName: 's1', el: 'x' }, { el: 'b' }];
    const next = [
      { sliceName: 's1', el: 'x' },
      { el: 'b', sliceName: 'z1' },
    ];
    const actions = calculateActions(prev, next);
    expect(
      actions.some((a) => a.type === 'enter-slice' && 'sliceName' in a && a.sliceName === 'z1'),
    ).toBe(true);
  });
});
