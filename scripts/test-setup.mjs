// Runs tests/setup.test.ts against lib/setup.ts and lib/risk.ts with Node's built-in type stripping.
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const nodeTest = (file) => spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--test', file], { stdio: 'inherit' });

const d = mkdtempSync(join(tmpdir(), 'setup-test-'));
writeFileSync(join(d, 'package.json'), JSON.stringify({ type: 'module' }));
copyFileSync('lib/risk.ts', join(d, 'risk.ts'));
writeFileSync(join(d, 'setup.ts'), readFileSync('lib/setup.ts', 'utf8').replace("'@/lib/risk'", "'./risk.ts'"));
copyFileSync('tests/setup.test.ts', join(d, 'setup.test.ts'));
const setup = nodeTest(join(d, 'setup.test.ts'));
const keys = nodeTest('tests/api-key.test.ts');
const balances = nodeTest('tests/sodex-balances.test.ts');
process.exit((setup.status ?? 1) || (keys.status ?? 1) || (balances.status ?? 1));
