import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter/index';
import type { StructureDefinition } from '../../src/converter/types';

// R5 ElementDefinition.constraint.suppress must survive into the IR so the validator
// can skip a suppressed inherited invariant.

describe('forward: constraint.suppress is carried into the IR', () => {
  it('keeps suppress on an element constraint', () => {
    const sd: StructureDefinition = {
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
            path: 'Observation.note',
            constraint: [
              {
                key: 'inv-1',
                expression: 'text.exists()',
                human: 'must have text',
                severity: 'error',
                suppress: true,
              },
            ],
          },
        ],
      },
    };

    const fs = translate(sd);
    const c = (fs.elements?.note?.constraint as Record<string, { suppress?: boolean }>)?.['inv-1'];
    expect(c?.suppress).toBe(true);
  });
});
