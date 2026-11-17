// Runs tests/setup.test.ts against lib/setup.ts and lib/risk.ts with Node's built-in type stripping.
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const d = mkdtempSync(join(tmpdir(), 'setup-test-'));
copyFileSync('lib/risk.ts', join(d, 'risk.ts'));
writeFileSync(join(d, 'setup.ts'), readFileSync('lib/setup.ts', 'utf8').replace("'@/lib/risk'", "'./risk.ts'"));
copyFileSync('tests/setup.test.ts', join(d, 'setup.test.ts'));
const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--test', join(d, 'setup.test.ts')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
