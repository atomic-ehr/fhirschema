import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter/index';
import { toStructureDefinition } from '../../src/converter/to-structure-definition';
import type { StructureDefinition } from '../../src/converter/types';

// Opt-in metadata preservation: with { preserveSource: true }, translate stashes the
// documentation/metadata fields it normally drops under a namespaced `fhir` sidecar on
// the node, and the reverse restores them — so a single SD round-trips losslessly for
// those fields WITHOUT polluting the canonical (default-off) schema.

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
      {
        path: 'Observation.status',
        short: 'the status',
        definition: 'The status of the observation.',
        comment: 'Carefully consider the status.',
        requirements: 'Needed for workflow.',
        alias: ['state'],
        mapping: [{ identity: 'v2', map: 'OBX-11' }],
      } as any,
    ],
  },
};

describe('preserveSource: opt-in metadata sidecar', () => {
  it('default (no flag) does NOT add a fhir sidecar — schema stays clean', () => {
    const fs = translate(profile);
    const status = fs.elements?.status as Record<string, unknown>;
    expect(status.fhir).toBeUndefined();
    // dropped doc fields are simply absent (definition/comment/mapping)
    expect(status.definition).toBeUndefined();
    expect(status.comment).toBeUndefined();
    expect(status.mapping).toBeUndefined();
  });

  it('with preserveSource stashes dropped metadata under `fhir`', () => {
    const fs = translate(profile, { preserveSource: true });
    const status = fs.elements?.status as Record<string, unknown>;
    expect(status.fhir).toEqual({
      definition: 'The status of the observation.',
      comment: 'Carefully consider the status.',
      requirements: 'Needed for workflow.',
      alias: ['state'],
      mapping: [{ identity: 'v2', map: 'OBX-11' }],
    });
  });

  it('reverse restores the metadata from the sidecar', () => {
    const sd = toStructureDefinition(translate(profile, { preserveSource: true }), {
      status: 'active',
    });
    const status = sd.differential?.element.find((e) => e.path === 'Observation.status') as Record<
      string,
      unknown
    >;
    expect(status.definition).toBe('The status of the observation.');
    expect(status.comment).toBe('Carefully consider the status.');
    expect(status.mapping).toEqual([{ identity: 'v2', map: 'OBX-11' }]);
    // no raw `fhir` key leaks into the SD output
    expect(status.fhir).toBeUndefined();
  });
});
