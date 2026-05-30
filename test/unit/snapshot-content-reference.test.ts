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
  it('expands a contentReference element’s children one level (gated by source)', async () => {
    const profile = sd({
      url: 'http://example.org/ParamsProfile',
      type: 'Params',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [{ path: 'Params.param', mustSupport: true, type: [{ code: 'BackboneElement' }] }],
      snapshot: [
        { path: 'Params' },
        { path: 'Params.param', type: [{ code: 'BackboneElement' }] },
        { path: 'Params.param.name', type: [{ code: 'string' }] },
        { path: 'Params.param.part', type: [{ code: 'BackboneElement' }], contentReference: '#Params.param' },
        // referenced children of param, surfaced under param.part:
        { path: 'Params.param.part.name', type: [{ code: 'string' }] },
        { path: 'Params.param.part.part', type: [{ code: 'BackboneElement' }], contentReference: '#Params.param' },
      ],
    });

    const snap = await generateSnapshot(profile, { resolver: { [base.url]: base } });
    const paths = new Set((snap.snapshot?.element || []).map((e) => e.path));

    expect(paths.has('Params.param.part.name')).toBe(true);
    expect(paths.has('Params.param.part.part')).toBe(true);
    // recursion is bounded by the source: no param.part.part.name (source lacks it)
    expect(paths.has('Params.param.part.part.name')).toBe(false);
  });
});
