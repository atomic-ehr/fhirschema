// Playground for ad-hoc experiments. Real cases live in
// test/cases/validator/*.yaml (e.g. patient-name.yaml for the Patient
// examples below). Add quick prototypes here, promote them to YAML
// once they stabilise.

import { describe, expect, it } from 'bun:test';
import { parsePath } from '../../src/converter/path-parser.js';
import { validate, type ValidateContext } from '../../src/validator/index.js';
import { buildResolverMap, loadPackageFixtures } from '../test-helpers.js';

describe('parsePath', () => {
  it('simple path', () => {
    expect(parsePath({ path: 'R.a' })).toEqual([{ el: 'a' }]);
  });
});

describe('playground: validate() direct call', () => {
  const base = buildResolverMap(loadPackageFixtures('hl7.fhir.r4.core'));
  const ctx: ValidateContext = { resolve: (ref) => base.get(ref) };

  it('quick smoke: valid Patient.name', () => {
    const r = validate(ctx, [], {
      resourceType: 'Patient',
      name: [{ family: 'Smith', given: ['John', 'A.'] }],
    });
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });
});
