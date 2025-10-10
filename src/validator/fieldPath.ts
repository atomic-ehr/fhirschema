const separators: { [key in FieldPathComponent['type']]: string } = {
  field: '.',
  slice: ':',
  reslice: '/',
};

const stringify = (fieldPath: FieldPathComponent[]): string => {
  const result = fieldPath.reduce((acc, { type, name }, idx) => {
    return `${acc}${idx == 0 ? '' : separators[type]}${name}`;
  }, '');

  return result;
};

type FieldPathComponent = { type: 'field' | 'slice' | 'reslice'; name: string };

export { stringify, FieldPathComponent };
