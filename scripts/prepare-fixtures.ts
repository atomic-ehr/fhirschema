// Download FHIR core packages and translate every StructureDefinition into a
// FHIRSchema fixture for tests. Output goes to test/fixtures/<package>/.
//
// Auto-runs on `bun test` via the `pretest` hook. To force a refresh:
//   rm -rf test/fixtures && bun run prepare-fixtures
//
// The output dir is gitignored.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { translate } from '../src/converter/index.ts';
import type { StructureDefinition } from '../src/converter/types.ts';

type Pkg = { id: string; version: string; url: string };

const ROOT = join(import.meta.dir, '..');
const FIXTURES_ROOT = join(ROOT, 'test', 'fixtures');
const TMP = join(ROOT, '.tmp-fhir-packages');

const PACKAGES: Pkg[] = [
  {
    id: 'hl7.fhir.r4.core',
    version: '4.0.1',
    url: 'https://packages.simplifier.net/hl7.fhir.r4.core/4.0.1',
  },
  {
    id: 'hl7.fhir.us.core',
    version: '5.0.1',
    url: 'https://packages.simplifier.net/hl7.fhir.us.core/5.0.1',
  },
  {
    id: 'hl7.fhir.r5.core',
    version: '5.0.0',
    url: 'https://packages.simplifier.net/hl7.fhir.r5.core/5.0.0',
  },
];

async function downloadAndExtract(pkg: Pkg, dest: string): Promise<void> {
  const tgz = join(dest, `${pkg.id}.tgz`);
  mkdirSync(dest, { recursive: true });

  console.log(`[prepare-fixtures] downloading ${pkg.id}@${pkg.version} ...`);
  const res = await fetch(pkg.url);
  if (!res.ok) throw new Error(`fetch ${pkg.url} → ${res.status} ${res.statusText}`);
  await Bun.write(tgz, await res.arrayBuffer());

  console.log('[prepare-fixtures] extracting ...');
  const tar = Bun.spawnSync(['tar', 'xzf', tgz, '-C', dest]);
  if (tar.exitCode !== 0) {
    throw new Error(`tar failed: ${new TextDecoder().decode(tar.stderr)}`);
  }
}

function translatePackage(srcDir: string, outDir: string): { written: number; skipped: number } {
  mkdirSync(outDir, { recursive: true });
  let written = 0;
  let skipped = 0;

  for (const f of readdirSync(srcDir)) {
    if (!f.endsWith('.json')) continue;
    if (f === 'package.json' || f.startsWith('.')) continue;

    let sd: StructureDefinition;
    try {
      sd = JSON.parse(readFileSync(join(srcDir, f), 'utf8')) as StructureDefinition;
    } catch {
      continue;
    }
    if (sd.resourceType !== 'StructureDefinition') continue;
    if (sd.kind === 'primitive-type') {
      skipped++;
      continue; // primitives are hardcoded in the validator
    }

    try {
      const fs = translate(sd);
      const name = sd.id ?? sd.name ?? sd.type;
      writeFileSync(join(outDir, `${name}.fs.json`), `${JSON.stringify(fs, null, 2)}\n`);
      written++;
    } catch (e) {
      console.warn(`[prepare-fixtures] skipped ${sd.id ?? f}: ${(e as Error).message}`);
      skipped++;
    }
  }

  return { written, skipped };
}

function fixturesPresent(dir: string): boolean {
  try {
    return statSync(dir).isDirectory() && readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  for (const pkg of PACKAGES) {
    const out = join(FIXTURES_ROOT, pkg.id);
    if (fixturesPresent(out)) {
      console.log(
        `[prepare-fixtures] ${pkg.id} already prepared (${readdirSync(out).length} files), skipping`,
      );
      continue;
    }

    const tmp = join(TMP, pkg.id);
    rmSync(tmp, { recursive: true, force: true });
    await downloadAndExtract(pkg, tmp);

    const srcDir = join(tmp, 'package');
    if (!existsSync(srcDir)) {
      throw new Error(`expected ${srcDir} after extract`);
    }

    const { written, skipped } = translatePackage(srcDir, out);
    console.log(
      `[prepare-fixtures] ${pkg.id}: ${written} schemas written, ${skipped} skipped → ${out}`,
    );
  }

  rmSync(TMP, { recursive: true, force: true });
}

await main();
