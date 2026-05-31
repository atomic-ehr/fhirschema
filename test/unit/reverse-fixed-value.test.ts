import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter/index';
import { toStructureDefinition } from '../../src/converter/to-structure-definition';
import type { StructureDefinition } from '../../src/converter/types';

// The forward converter normalizes `fixed<Type>` into a `fixed: {type, value}` IR
// object (symmetric to `pattern`). The reverse must re-emit the canonical FHIR
// `fixed<Type>` key — not a non-FHIR `fixed: {type, value}` blob, and not drop the
// element. (Audit: 615/615 fixed-bearing rows had the wrong shape.)

const profile: StructureDefinition = {
  resourceType: 'StructureDefinition',
  url: 'http://example.org/Obs',
  name: 'Obs',
  status: 'active',
  kind: 'resource',
  type: 'Observation',
  derivation: 'constraint',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
  differential: {
    element: [
      { path: 'Observation' },
      { path: 'Observation.status', fixedCode: 'final' },
      {
        path: 'Observation.method',
        patternCodeableConcept: { coding: [{ system: 'http://x', code: 'm' }] },
      },
    ],
  },
};

describe('reverse converter: fixed[x] round-trips to the canonical FHIR key', () => {
  it('emits fixedCode (not a fixed:{type,value} blob, not dropped)', () => {
    const sd = toStructureDefinition(translate(profile), { status: 'active' });
    const status = sd.differential?.element.find((e) => e.path === 'Observation.status');

    expect(status).toBeDefined();
    expect((status as Record<string, unknown>).fixedCode).toBe('final');
    // no non-FHIR wrapper key leaks through
    expect((status as Record<string, unknown>).fixed).toBeUndefined();
  });

  it('still emits pattern[x] correctly (regression guard)', () => {
    const sd = toStructureDefinition(translate(profile), { status: 'active' });
    const method = sd.differential?.element.find((e) => e.path === 'Observation.method');
    expect((method as Record<string, unknown>).patternCodeableConcept).toEqual({
      coding: [{ system: 'http://x', code: 'm' }],
    });
    expect((method as Record<string, unknown>).pattern).toBeUndefined();
  });

  it('round-trips: translate(reverse(translate(sd))) keeps the fixed value', () => {
    const fs1 = translate(profile);
    const fs2 = translate(toStructureDefinition(fs1, { status: 'active' }));
    expect(fs2.elements?.status?.fixed).toEqual({ type: 'code', value: 'final' });
  });
});
