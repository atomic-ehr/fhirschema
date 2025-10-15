const separators: { [key in FieldPathComponent['type']]: string } = {
  field: '.',
  slice: ':',
  reslice: '/',
  index: '.',
};

const stringify = (
  fieldPath: FieldPathComponent[],
  opts: { asFhirPath: boolean } = { asFhirPath: false },
): string => {
  const result = fieldPath
    .filter(({ type }) => !opts.asFhirPath || 'field' === type)
    .reduce((acc, { type, name }, idx) => {
      return `${acc}${idx === 0 ? '' : separators[type]}${name}`;
    }, '');

  return result;
};

type FieldPathComponent = { type: 'field' | 'slice' | 'reslice' | 'index'; name: string };

export { stringify, type FieldPathComponent };
