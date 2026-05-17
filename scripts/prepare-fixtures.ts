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

type Pkg = {
  id: string;
  version: string;
  /** Either a fetchable URL or a local .tgz path (relative to repo root). */
  url?: string;
  localTgz?: string;
};

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
  // Graham IG-package test bucket — packages needed to validate cases under
  // test/cases/validator/graham-ig-*.yaml. Local .tgz files are shipped
  // inside the fhir-test-cases repo; online ones come from simplifier.
  // Versions match the test manifest exactly.
  { id: 'hl7.fhir.test.verA', version: '1.0.0',
    localTgz: '../fhir-test-cases/validator/packages/hl7.fhir.test.verA#1.0.0.tgz' },
  { id: 'hl7.fhir.test.verA', version: '2.0.0',
    localTgz: '../fhir-test-cases/validator/packages/hl7.fhir.test.verA#2.0.0.tgz' },
  { id: 'hl7.fhir.test.verB', version: '1.0.0',
    localTgz: '../fhir-test-cases/validator/packages/hl7.fhir.test.verB#1.0.0.tgz' },
  { id: 'hl7.fhir.test.verB', version: '2.0.0',
    localTgz: '../fhir-test-cases/validator/packages/hl7.fhir.test.verB#2.0.0.tgz' },
  { id: 'hl7.fhir.test.verC', version: '1.0.0',
    localTgz: '../fhir-test-cases/validator/packages/hl7.fhir.test.verC#1.0.0.tgz' },
  { id: 'hl7.fhir.uv.ips', version: '1.1.0',
    url: 'https://packages.simplifier.net/hl7.fhir.uv.ips/1.1.0' },
  { id: 'hl7.fhir.us.core', version: '3.1.0',
    url: 'https://packages.simplifier.net/hl7.fhir.us.core/3.1.0' },
  { id: 'hl7.fhir.us.core', version: '3.1.1',
    url: 'https://packages.simplifier.net/hl7.fhir.us.core/3.1.1' },
  { id: 'hl7.fhir.uv.shc-vaccination', version: '0.6.2',
    url: 'https://packages.simplifier.net/hl7.fhir.uv.shc-vaccination/0.6.2' },
  { id: 'hl7.fhir.uv.cgm', version: '1.0.0-ballot',
    url: 'https://packages.simplifier.net/hl7.fhir.uv.cgm/1.0.0-ballot' },
];

async function downloadAndExtract(pkg: Pkg, dest: string): Promise<void> {
  const tgz = join(dest, `${pkg.id}.tgz`);
  mkdirSync(dest, { recursive: true });

  if (pkg.localTgz) {
    const src = join(ROOT, pkg.localTgz);
    if (!existsSync(src)) throw new Error(`local tgz not found: ${src}`);
    console.log(`[prepare-fixtures] copying ${pkg.id}@${pkg.version} from ${pkg.localTgz} ...`);
    await Bun.write(tgz, Bun.file(src));
  } else {
    if (!pkg.url) throw new Error(`${pkg.id}: neither url nor localTgz`);
    console.log(`[prepare-fixtures] downloading ${pkg.id}@${pkg.version} ...`);
    const res = await fetch(pkg.url);
    if (!res.ok) throw new Error(`fetch ${pkg.url} → ${res.status} ${res.statusText}`);
    await Bun.write(tgz, await res.arrayBuffer());
  }

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

/**
 * Pick a per-fixture directory name. For core packages (single version) we
 * keep the bare `pkg.id` for backwards compatibility with existing tests
 * that ask for `loadPackageFixtures('hl7.fhir.r4.core')`. For others,
 * suffix with `@version` so multiple versions can coexist.
 */
function fixtureDirName(pkg: Pkg): string {
  const isCore = [
    'hl7.fhir.r4.core@4.0.1',
    'hl7.fhir.r5.core@5.0.0',
    'hl7.fhir.us.core@5.0.1',
  ].includes(`${pkg.id}@${pkg.version}`);
  return isCore ? pkg.id : `${pkg.id}@${pkg.version}`;
}

async function main(): Promise<void> {
  for (const pkg of PACKAGES) {
    const dirName = fixtureDirName(pkg);
    const out = join(FIXTURES_ROOT, dirName);
    if (fixturesPresent(out)) {
      console.log(
        `[prepare-fixtures] ${dirName} already prepared (${readdirSync(out).length} files), skipping`,
      );
      continue;
    }

    const tmp = join(TMP, dirName);
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
