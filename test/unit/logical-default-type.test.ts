import { describe, expect, it } from 'bun:test';
import { translate } from '../../src/converter/index';
import type { StructureDefinition } from '../../src/converter/types';

// elementdefinition-defaulttype (logical models) lives on ElementDefinition.extension.
// stripElementMetadata removes element.extension before buildElementType runs, so the
// default type was silently lost. It must be captured before the strip.

const logical: StructureDefinition = {
  resourceType: 'StructureDefinition',
  url: 'http://example.org/L',
  name: 'L',
  status: 'active',
  kind: 'logical',
  type: 'L',
  derivation: 'specialization',
  differential: {
    element: [
      { path: 'L' },
      {
        path: 'L.field',
        min: 0,
        max: '1',
        type: [{ code: 'Element' }],
        extension: [
          {
            url: 'http://hl7.org/fhir/StructureDefinition/elementdefinition-defaulttype',
            valueCanonical: 'http://example.org/DefaultType',
          },
        ],
      },
    ],
  },
};

describe('forward: logical-model defaultType survives element.extension stripping', () => {
  it('captures elementdefinition-defaulttype into defaultType', () => {
    const fs = translate(logical);
    expect((fs.elements?.field as Record<string, unknown>)?.defaultType).toBe(
      'http://example.org/DefaultType',
    );
  });
});
