import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter/index';
import { toStructureDefinition } from '../../src/converter/to-structure-definition';
import type { StructureDefinition } from '../../src/converter/types';

// preserveSource also stashes SD-level publishing/documentation metadata (title, date,
// publisher, status, …) under a top-level `fhir` sidecar, restored by the reverse.

const profile = {
  resourceType: 'StructureDefinition',
  url: 'http://example.org/Obs',
  name: 'Obs',
  title: 'Observation Profile',
  status: 'draft',
  experimental: true,
  date: '2024-01-02',
  publisher: 'ACME',
  kind: 'resource',
  type: 'Observation',
  derivation: 'constraint',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
  differential: { element: [{ path: 'Observation' }] },
} as unknown as StructureDefinition;

describe('preserveSource: SD-level metadata sidecar', () => {
  it('default does NOT add a top-level fhir sidecar', () => {
    const fs = translate(profile);
    expect((fs as Record<string, unknown>).fhir).toBeUndefined();
  });

  it('with preserveSource stashes dropped SD metadata under top-level fhir', () => {
    const fs = translate(profile, { preserveSource: true });
    expect(fs.fhir).toEqual({
      title: 'Observation Profile',
      status: 'draft',
      experimental: true,
      date: '2024-01-02',
      publisher: 'ACME',
    });
  });

  it('reverse restores SD metadata, including the real status (not the default)', () => {
    const sd = toStructureDefinition(translate(profile, { preserveSource: true }));
    const out = sd as Record<string, unknown>;
    expect(out.title).toBe('Observation Profile');
    expect(out.publisher).toBe('ACME');
    expect(out.experimental).toBe(true);
    expect(out.date).toBe('2024-01-02');
    expect(sd.status).toBe('draft'); // not the fabricated 'active'
    expect(out.fhir).toBeUndefined(); // no raw sidecar leaks into the SD
  });
});
