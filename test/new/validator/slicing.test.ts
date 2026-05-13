import { describe, expect, test } from 'bun:test';
import { errorCodes, errorRegistry } from '../../../src/new/errors';
import { validate } from '../../../src/new/validator';
import { OK_OUTCOME } from './fixture';

describe('New validator draft', () => {
  describe('Slicing', () => {
    test('open slicing accepts matched and unmatched items', () => {
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                type: 'object',
                array: true,
                slicing: {
                  discriminator: [{ type: 'pattern', path: 'system' }],
                  rules: 'open',
                  slices: {
                    usMRN: {
                      match: { system: 'urn:mrn' },
                      schema: { elements: { value: { type: 'string', required: true } } },
                    },
                  },
                },
              },
            },
          },
        ],
        {
          identifier: [
            { system: 'urn:mrn', value: 'M123' },
            { system: 'urn:other', value: 'X1' },
          ],
        },
      );
      expect(result).toEqual(OK_OUTCOME);
    });

    test('closed slicing rejects unmatched items', () => {
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  discriminator: [{ type: 'pattern', path: 'system' }],
                  rules: 'closed',
                  slices: {
                    usMRN: { match: { system: 'urn:mrn' } },
                  },
                },
              },
            },
          },
        ],
        { identifier: [{ system: 'urn:mrn' }, { system: 'urn:other' }] },
      );
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.code).toBe(errorRegistry[errorCodes.slicingUnmatched].issueCode);
      expect(issues[0]?.details?.text).toContain('us-core');
      expect(issues[0]?.details?.text).toContain('identifier.1');
    });

    test('slice min cardinality violation', () => {
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  discriminator: [{ type: 'pattern', path: 'system' }],
                  rules: 'open',
                  slices: {
                    usMRN: { match: { system: 'urn:mrn' }, min: 1 },
                  },
                },
              },
            },
          },
        ],
        { identifier: [{ system: 'urn:other' }] },
      );
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.code).toBe(errorRegistry[errorCodes.sliceCardinality].issueCode);
      expect(issues[0]?.details?.text).toContain('usMRN');
      expect(issues[0]?.details?.text).toContain('min=1');
    });

    test('slice max cardinality violation', () => {
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  rules: 'open',
                  discriminator: [{ type: 'pattern', path: 'system' }],
                  slices: {
                    usMRN: { match: { system: 'urn:mrn' }, max: 1 },
                  },
                },
              },
            },
          },
        ],
        {
          identifier: [
            { system: 'urn:mrn', value: 'A' },
            { system: 'urn:mrn', value: 'B' },
          ],
        },
      );
      const issues = result.issue ?? [];
      expect(issues.some((i) => i.details?.text?.includes('max=1'))).toBe(true);
    });

    test('ambiguous slice matches', () => {
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  // intentionally empty discriminator → falls back to whole-item deepPartial match,
                  // making slices that share an overlapping pattern indistinguishable
                  rules: 'open',
                  slices: {
                    hasSystem: { match: { system: 'urn:mrn' } },
                    hasValue: { match: { value: 'M123' } },
                  },
                },
              },
            },
          },
        ],
        { identifier: [{ system: 'urn:mrn', value: 'M123' }] },
      );
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.code).toBe(errorRegistry[errorCodes.slicingAmbiguous].issueCode);
      expect(issues[0]?.details?.text).toContain('hasSystem');
      expect(issues[0]?.details?.text).toContain('hasValue');
    });

    test('slice schema overlay enforces extra required field', () => {
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  rules: 'open',
                  discriminator: [{ type: 'pattern', path: 'system' }],
                  slices: {
                    usMRN: {
                      match: { system: 'urn:mrn' },
                      schema: {
                        type: 'elements',
                        elements: {
                          system: { type: 'string' },
                          value: { type: 'string', required: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        { identifier: [{ system: 'urn:mrn' }] },
      );
      const issues = result.issue ?? [];
      expect(issues.some((i) => i.code === errorRegistry[errorCodes.requiredField].issueCode)).toBe(
        true,
      );
    });

    test('multi-profile: US Core and AU Core independently slice the same array', () => {
      // US Core slices identifier by system=urn:mrn (cardinality 1..1)
      // AU Core slices identifier by type.coding[].code=NI (cardinality 1..1)
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  rules: 'open',
                  discriminator: [{ type: 'pattern', path: 'system' }],
                  slices: {
                    usMRN: { match: { system: 'urn:mrn' }, min: 1, max: 1 },
                  },
                },
              },
            },
          },
          {
            source: 'au-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  rules: 'open',
                  discriminator: [{ type: 'pattern', path: 'type.coding' }],
                  slices: {
                    auIHI: {
                      match: { type: { coding: [{ code: 'NI' }] } },
                      min: 1,
                      max: 1,
                    },
                  },
                },
              },
            },
          },
        ],
        {
          identifier: [
            { system: 'urn:mrn', value: 'M123' },
            { type: { coding: [{ code: 'NI' }] }, value: '8003600...' },
          ],
        },
      );
      expect(result).toEqual(OK_OUTCOME);
    });

    test('multi-profile: missing AU slice reports cardinality error attributed to AU profile', () => {
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  rules: 'open',
                  discriminator: [{ type: 'pattern', path: 'system' }],
                  slices: { usMRN: { match: { system: 'urn:mrn' }, min: 1 } },
                },
              },
            },
          },
          {
            source: 'au-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  rules: 'open',
                  discriminator: [{ type: 'pattern', path: 'type.coding' }],
                  slices: {
                    auIHI: { match: { type: { coding: [{ code: 'NI' }] } }, min: 1 },
                  },
                },
              },
            },
          },
        ],
        { identifier: [{ system: 'urn:mrn', value: 'M123' }] },
      );
      const issues = result.issue ?? [];
      expect(issues).toHaveLength(1);
      expect(issues[0]?.code).toBe(errorRegistry[errorCodes.sliceCardinality].issueCode);
      expect(issues[0]?.details?.text).toContain('au-core');
      expect(issues[0]?.details?.text).toContain('auIHI');
    });

    test('discriminator value type compares by strict equality', () => {
      const result = validate(
        undefined,
        [
          {
            source: 'us-core',
            elements: {
              identifier: {
                array: true,
                slicing: {
                  rules: 'closed',
                  discriminator: [{ type: 'value', path: 'system' }],
                  slices: {
                    usMRN: { match: { system: 'urn:mrn' } },
                  },
                },
              },
            },
          },
        ],
        { identifier: [{ system: 'urn:mrn' }, { system: 'urn:MRN' }] },
      );
      const issues = result.issue ?? [];
      // second item URL has different casing → not matched, closed slicing fails
      expect(issues).toHaveLength(1);
      expect(issues[0]?.code).toBe(errorRegistry[errorCodes.slicingUnmatched].issueCode);
    });
  });
});
