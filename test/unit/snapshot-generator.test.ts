import { describe, expect, it } from 'bun:test';
import { generateSnapshot } from '../../src/converter/snapshot';
import type { StructureDefinition, StructureDefinitionElement } from '../../src/converter/types';

function createSD(args: {
  url: string;
  name: string;
  type: string;
  kind?: string;
  baseDefinition?: string;
  derivation?: string;
  extension?: Array<Record<string, unknown>>;
  elements: StructureDefinitionElement[];
}): StructureDefinition {
  return {
    resourceType: 'StructureDefinition',
    url: args.url,
    name: args.name,
    status: 'active',
    kind: args.kind || 'resource',
    type: args.type,
    ...(args.baseDefinition ? { baseDefinition: args.baseDefinition } : {}),
    ...(args.derivation ? { derivation: args.derivation } : {}),
    ...(args.extension ? { extension: args.extension } : {}),
    differential: {
      element: [{ path: args.type }, ...args.elements],
    },
  };
}

describe('Snapshot generation via FHIRSchema merge', () => {
  it('merges base and derived definitions into snapshot', async () => {
    const base = createSD({
      url: 'http://example.org/fhir/StructureDefinition/BasePatient',
      name: 'BasePatient',
      type: 'Patient',
      elements: [
        { path: 'Patient.id', type: [{ code: 'id' }] },
        { path: 'Patient.name', min: 0, max: '*', type: [{ code: 'HumanName' }] },
      ],
    });

    const derived = createSD({
      url: 'http://example.org/fhir/StructureDefinition/DerivedPatient',
      name: 'DerivedPatient',
      type: 'Patient',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [
        { path: 'Patient.name', min: 1, max: '*', type: [{ code: 'HumanName' }] },
        { path: 'Patient.active', type: [{ code: 'boolean' }] },
      ],
    });

    const snapshot = await generateSnapshot(derived, {
      resolver: { [base.url]: base },
    });

    const elements = snapshot.snapshot?.element || [];
    const paths = elements.map((e) => e.path);

    expect(paths).toContain('Patient.id');
    expect(paths).toContain('Patient.name');
    expect(paths).toContain('Patient.active');

    const nameEl = elements.find((e) => e.path === 'Patient.name');
    expect(nameEl?.min).toBe(1);
    expect(nameEl?.max).toBe('*');

    // original differential must remain intact
    expect(snapshot.differential).toEqual(derived.differential);
  });

  it('supports multi-level base chain and choice propagation', async () => {
    const base = createSD({
      url: 'http://example.org/fhir/StructureDefinition/BaseObservation',
      name: 'BaseObservation',
      type: 'Observation',
      elements: [
        {
          path: 'Observation.value[x]',
          type: [{ code: 'string' }, { code: 'Quantity' }],
        },
      ],
    });

    const mid = createSD({
      url: 'http://example.org/fhir/StructureDefinition/MidObservation',
      name: 'MidObservation',
      type: 'Observation',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [
        {
          path: 'Observation.value[x]',
          min: 1,
          max: '1',
          type: [{ code: 'string' }, { code: 'Quantity' }],
        },
      ],
    });

    const leaf = createSD({
      url: 'http://example.org/fhir/StructureDefinition/LeafObservation',
      name: 'LeafObservation',
      type: 'Observation',
      baseDefinition: mid.url,
      derivation: 'constraint',
      elements: [{ path: 'Observation.valueQuantity.unit', type: [{ code: 'string' }] }],
    });

    const snapshot = await generateSnapshot(leaf, {
      resolver: {
        [base.url]: base,
        [mid.url]: mid,
      },
    });

    const elements = snapshot.snapshot?.element || [];

    expect(elements).toContainEqual(
      expect.objectContaining({
        path: 'Observation.value[x]',
        min: 1,
        max: '1',
      }),
    );

    expect(elements).toContainEqual(
      expect.objectContaining({
        path: 'Observation.valueQuantity.unit',
      }),
    );
  });

  it('fails fast when baseDefinition cannot be resolved', async () => {
    const derived = createSD({
      url: 'http://example.org/fhir/StructureDefinition/DerivedPatient',
      name: 'DerivedPatient',
      type: 'Patient',
      baseDefinition: 'http://example.org/fhir/StructureDefinition/MissingBase',
      derivation: 'constraint',
      elements: [{ path: 'Patient.active', type: [{ code: 'boolean' }] }],
    });

    await expect(
      generateSnapshot(derived, {
        resolver: {},
      }),
    ).rejects.toThrow('Unable to resolve baseDefinition');
  });

  it('detects circular baseDefinition chains', async () => {
    const cyclic = createSD({
      url: 'http://example.org/fhir/StructureDefinition/Cyclic',
      name: 'Cyclic',
      type: 'Patient',
      baseDefinition: 'http://example.org/fhir/StructureDefinition/Cyclic',
      derivation: 'constraint',
      elements: [{ path: 'Patient.active', type: [{ code: 'boolean' }] }],
    });

    await expect(
      generateSnapshot(cyclic, {
        resolver: {
          [cyclic.url]: cyclic,
        },
      }),
    ).rejects.toThrow('Circular baseDefinition chain detected');
  });

  it('supports resolver object contract (canonical-manager style)', async () => {
    const base = createSD({
      url: 'http://example.org/fhir/StructureDefinition/BasePatient',
      name: 'BasePatient',
      type: 'Patient',
      elements: [{ path: 'Patient.id', type: [{ code: 'id' }] }],
    });
    const derived = createSD({
      url: 'http://example.org/fhir/StructureDefinition/DerivedPatient',
      name: 'DerivedPatient',
      type: 'Patient',
      baseDefinition: `${base.url}|1.0.0`,
      derivation: 'constraint',
      elements: [{ path: 'Patient.active', type: [{ code: 'boolean' }] }],
    });

    const snapshot = await generateSnapshot(derived, {
      resolver: {
        resolve: async (canonical, options) => {
          if (canonical === base.url && options?.resourceType === 'StructureDefinition') {
            return base;
          }
          return undefined;
        },
      },
    });

    const paths = (snapshot.snapshot?.element || []).map((e) => e.path);
    expect(paths).toContain('Patient.id');
    expect(paths).toContain('Patient.active');
  });

  it('resolves versioned baseDefinition via map resolver canonical fallback', async () => {
    const base = createSD({
      url: 'http://example.org/fhir/StructureDefinition/BasePatient',
      name: 'BasePatient',
      type: 'Patient',
      elements: [{ path: 'Patient.id', type: [{ code: 'id' }] }],
    });
    const derived = createSD({
      url: 'http://example.org/fhir/StructureDefinition/DerivedPatient',
      name: 'DerivedPatient',
      type: 'Patient',
      baseDefinition: `${base.url}|1.2.3`,
      derivation: 'constraint',
      elements: [{ path: 'Patient.active', type: [{ code: 'boolean' }] }],
    });

    const snapshot = await generateSnapshot(derived, {
      resolver: {
        [base.url]: base,
      },
    });

    const paths = (snapshot.snapshot?.element || []).map((e) => e.path);
    expect(paths).toContain('Patient.id');
    expect(paths).toContain('Patient.active');
  });

  it('uses differential as source of truth even if snapshot has extra rows', async () => {
    const base = createSD({
      url: 'http://example.org/fhir/StructureDefinition/BaseObservation',
      name: 'BaseObservation',
      type: 'Observation',
      elements: [{ path: 'Observation.status', type: [{ code: 'code' }] }],
    });

    const derived = createSD({
      url: 'http://example.org/fhir/StructureDefinition/DerivedObservation',
      name: 'DerivedObservation',
      type: 'Observation',
      baseDefinition: base.url,
      derivation: 'constraint',
      elements: [{ path: 'Observation.code', type: [{ code: 'CodeableConcept' }] }],
    });

    // Intentionally add snapshot-only element that should be ignored by algorithm.
    derived.snapshot = {
      element: [
        { path: 'Observation' },
        { path: 'Observation.code', type: [{ code: 'CodeableConcept' }] },
        { path: 'Observation.subject', type: [{ code: 'Reference' }] },
      ],
    };

    const snapshot = await generateSnapshot(derived, {
      resolver: { [base.url]: base },
    });

    const paths = new Set((snapshot.snapshot?.element || []).map((e) => e.path));
    expect(paths.has('Observation.status')).toBe(true);
    expect(paths.has('Observation.code')).toBe(true);
    expect(paths.has('Observation.subject')).toBe(false);
  });

  it('fails when a required definition has no differential', async () => {
    const bad: StructureDefinition = {
      resourceType: 'StructureDefinition',
      url: 'http://example.org/fhir/StructureDefinition/NoDiff',
      name: 'NoDiff',
      status: 'active',
      kind: 'resource',
      type: 'Patient',
    };

    await expect(
      generateSnapshot(bad, {
        resolver: {},
      }),
    ).rejects.toThrow('has no differential.element');
  });

  it('includes implemented interface elements (MetadataResource-style) in generated snapshot', async () => {
    const domain = createSD({
      url: 'http://example.org/fhir/StructureDefinition/DomainResource',
      name: 'DomainResource',
      type: 'DomainResource',
      derivation: 'specialization',
      elements: [{ path: 'DomainResource.text', type: [{ code: 'Narrative' }] }],
    });

    const canonical = createSD({
      url: 'http://example.org/fhir/StructureDefinition/CanonicalResource',
      name: 'CanonicalResource',
      type: 'CanonicalResource',
      baseDefinition: domain.url,
      derivation: 'specialization',
      elements: [
        { path: 'CanonicalResource.url', type: [{ code: 'uri' }] },
        { path: 'CanonicalResource.version', type: [{ code: 'string' }] },
      ],
    });

    const metadata = createSD({
      url: 'http://example.org/fhir/StructureDefinition/MetadataResource',
      name: 'MetadataResource',
      type: 'MetadataResource',
      baseDefinition: domain.url,
      derivation: 'specialization',
      extension: [
        {
          url: 'http://hl7.org/fhir/StructureDefinition/structuredefinition-interface',
          valueBoolean: true,
        },
        {
          url: 'http://hl7.org/fhir/StructureDefinition/structuredefinition-implements',
          valueCanonical: canonical.url,
        },
      ],
      elements: [{ path: 'MetadataResource.approvalDate', type: [{ code: 'date' }] }],
    });

    const snapshot = await generateSnapshot(metadata, {
      resolver: {
        [domain.url]: domain,
        [canonical.url]: canonical,
      },
    });

    const paths = new Set((snapshot.snapshot?.element || []).map((e) => e.path));
    expect(paths.has('MetadataResource.approvalDate')).toBe(true);
    expect(paths.has('MetadataResource.url')).toBe(true);
    expect(paths.has('MetadataResource.version')).toBe(true);
  });
});
