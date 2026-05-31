import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

function sd(args: {
  url: string;
  type: string;
  baseDefinition?: string;
  derivation?: string;
  elements: StructureDefinitionElement[];
  snapshot?: StructureDefinitionElement[];
}): StructureDefinition {
  return {
    resourceType: 'StructureDefinition',
    url: args.url,
    name: args.url.split('/').pop() as string,
    status: 'active',
    kind: 'resource',
    type: args.type,
    ...(args.baseDefinition ? { baseDefinition: args.baseDefinition } : {}),
    ...(args.derivation ? { derivation: args.derivation } : {}),
    differential: { element: [{ path: args.type }, ...args.elements] },
    ...(args.snapshot ? { snapshot: { element: args.snapshot } } : {}),
  };
}

// Parameters-style recursive backbone: `param.part` is a BackboneElement whose
// children are defined by a contentReference back to `param` (so `part` has
// `name` and a nested `part`, etc.). The official snapshot expands the
// referenced node's children one level under each contentReference.
const base = sd({
  url: 'http://example.org/Params',
  type: 'Params',
  derivation: 'specialization',
  elements: [
    { path: 'Params.param', min: 0, max: '*', type: [{ code: 'BackboneElement' }] },
    { path: 'Params.param.name', type: [{ code: 'string' }] },
    {
      path: 'Params.param.part',
      min: 0,
      max: '*',
      type: [{ code: 'BackboneElement' }],
      contentReference: '#Params.param',
    },
  ],
});

describe('snapshot: contentReference children expansion (recursive backbone)', () => {
  it('expands a contentReference element’s children when reached into (blind), bounded by constraints', async () => {
    // Profile reaches into param.part (constrains part.name) → the referenced
    // node's children surface under param.part. NO input snapshot.
    const profile = sd({
      url: 'http://example.org/ParamsProfile',
      type: 'Params',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [
        { path: 'Params.param', mustSupport: true, type: [{ code: 'BackboneElement' }] },
        { path: 'Params.param.part.name', mustSupport: true },
      ],
    });

    const snap = await generateSnapshot(profile, { resolver: { [base.url]: base } });
    const paths = new Set((snap.snapshot?.element || []).map((e) => e.path));

    expect(paths.has('Params.param.part.name')).toBe(true); // reached → surfaced
    expect(paths.has('Params.param.part.part')).toBe(true); // sibling cref surfaced
    // recursion is bounded structurally: param.part.part is NOT reached into,
    // so it is not expanded further (no param.part.part.name).
    expect(paths.has('Params.param.part.part.name')).toBe(false);
  });
});
