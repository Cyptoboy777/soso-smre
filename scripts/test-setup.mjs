// Runs repo tests with Node's built-in type stripping.
// Existing tests are unchanged. New lib/routes tests get a temp copy with .ts import paths.
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

function withTsExt(src) {
  return src.replaceAll(/from ['"](\.[^'"]+)['"]/g, (m, spec) => spec.endsWith('.ts') || spec.endsWith('.json') ? m : m.replace(spec, spec + '.ts'));
}

const r = mkdtempSync(join(tmpdir(), 'route-test-'));
writeFileSync(join(r, 'package.json'), JSON.stringify({ type: 'module' }));
mkdirSync(join(r, 'lib', 'routes'), { recursive: true });
mkdirSync(join(r, 'tests', 'fixtures'), { recursive: true });
writeFileSync(join(r, 'lib', 'sodexConfig.ts'), withTsExt(readFileSync('lib/sodexConfig.ts', 'utf8')));
for (const name of readdirSync('lib/routes')) {
  if (!name.endsWith('.ts')) continue;
  writeFileSync(join(r, 'lib', 'routes', name), withTsExt(readFileSync(join('lib/routes', name), 'utf8')));
}
for (const name of readdirSync('tests/fixtures')) {
  copyFileSync(join('tests/fixtures', name), join(r, 'tests', 'fixtures', name));
}
writeFileSync(join(r, 'tests', 'sodex-config.test.ts'), readFileSync('tests/sodex-config.test.ts', 'utf8'));
writeFileSync(join(r, 'tests', 'route-quote.test.ts'), readFileSync('tests/route-quote.test.ts', 'utf8'));
const cfg = nodeTest(join(r, 'tests', 'sodex-config.test.ts'));
const routes = nodeTest(join(r, 'tests', 'route-quote.test.ts'));

process.exit((setup.status ?? 1) || (keys.status ?? 1) || (balances.status ?? 1) || (cfg.status ?? 1) || (routes.status ?? 1));
