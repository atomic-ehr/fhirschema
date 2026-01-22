const separators: { [key in FieldPathComponent['type']]: string } = {
  field: '.',
  slice: ':',
  reslice: '/',
  index: '.',
};

type StringifyOpts = {
  asFhirPath?: boolean;
  withIndices?: boolean;
};

const stringify = (fieldPath: FieldPathComponent[], opts: StringifyOpts = {}): string => {
  const { asFhirPath = false, withIndices = false } = opts;

  if (withIndices) {
    // Format with brackets for indices: field.subfield[0].nested[1]
    return fieldPath.reduce((acc, { type, name }, idx) => {
      if (type === 'index') {
        return `${acc}[${name}]`;
      }
      return `${acc}${idx === 0 ? '' : separators[type]}${name}`;
    }, '');
  }

  const result = fieldPath
    .filter(({ type }) => !asFhirPath || 'field' === type)
    .reduce((acc, { type, name }, idx) => {
      return `${acc}${idx === 0 ? '' : separators[type]}${name}`;
    }, '');

  return result;
};

type FieldPathComponent = { type: 'field' | 'slice' | 'reslice' | 'index'; name: string };

export { stringify, type FieldPathComponent };
