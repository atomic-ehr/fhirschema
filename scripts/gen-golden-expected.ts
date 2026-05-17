// Generate <name>.fs.json next to <name>.sd.json by running translate().
// Usage: bun run scripts/gen-golden-expected.ts <name.sd.json> [...more]

import { readFileSync, writeFileSync } from 'node:fs';
import { translate } from '../src/converter/index.ts';
import type { StructureDefinition } from '../src/converter/types.ts';

for (const arg of process.argv.slice(2)) {
  const sd =  JSON.parse(readFileSync(arg, 'utf8')) as StructureDefinition;
  const fs = translate(sd);
  const out = arg.replace(/\.sd\.json$/, '.fs.json');
  writeFileSync(out, `${JSON.stringify(fs, null, 2)}\n`);
  console.log(`✓ ${out}`);
}
