import { describe, expect, it } from 'bun:test';
import { mergeFHIRSchema } from '../../src/converter/merge';

// merge() is the FHIRSchema overlay primitive used to fold a base→leaf chain.
// `required` / `excluded` are per-node arrays naming required/forbidden children.
// They MUST be unioned across the chain, not replaced by the last overlay.
describe('merge: required/excluded arrays are unioned, not replaced', () => {
  it('unions root-level required arrays', () => {
    const base = {
      required: ['status', 'code'],
      elements: { status: {}, code: {} },
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;
    const overlay = {
      required: ['category'],
      elements: { category: {} },
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;

    const merged = mergeFHIRSchema(base, overlay, { unionArrays: true }) as { required?: string[] };
    expect(new Set(merged.required)).toEqual(new Set(['status', 'code', 'category']));
  });

  it('unions nested element required arrays', () => {
    const base = {
      elements: {
        component: { required: ['code'], elements: { code: {}, value: {} } },
      },
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;
    const overlay = {
      elements: {
        component: { required: ['value'], elements: { code: {}, value: {} } },
      },
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;

    const merged = mergeFHIRSchema(base, overlay, { unionArrays: true }) as {
      elements?: { component?: { required?: string[] } };
    };
    expect(new Set(merged.elements?.component?.required)).toEqual(new Set(['code', 'value']));
  });

  it('keeps base required when overlay omits the array', () => {
    const base = {
      required: ['status'],
      elements: { status: {} },
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;
    const overlay = {
      elements: { status: { mustSupport: true } },
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;

    const merged = mergeFHIRSchema(base, overlay, { unionArrays: true }) as { required?: string[] };
    expect(merged.required).toEqual(['status']);
  });

  it('unions excluded arrays', () => {
    const base = {
      excluded: ['a'],
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;
    const overlay = {
      excluded: ['b'],
      // biome-ignore lint/suspicious/noExplicitAny: test fixture
    } as any;

    const merged = mergeFHIRSchema(base, overlay, { unionArrays: true }) as { excluded?: string[] };
    expect(new Set(merged.excluded)).toEqual(new Set(['a', 'b']));
  });
});
