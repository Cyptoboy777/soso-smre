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
copyFileSync('lib/swap-ux.ts', join(d, 'swap-ux.ts'));
writeFileSync(join(d, 'trade-guard.ts'), readFileSync('lib/trade-guard.ts', 'utf8').replaceAll("from './setup'", "from './setup.ts'").replaceAll("from './swap-ux'", "from './swap-ux.ts'").replaceAll("from './risk'", "from './risk.ts'"));
writeFileSync(join(d, 'grid-bot.ts'), readFileSync('lib/grid-bot.ts', 'utf8').replaceAll("from './swap-ux'", "from './swap-ux.ts'").replaceAll("from './trade-guard'", "from './trade-guard.ts'"));
copyFileSync('tests/setup.test.ts', join(d, 'setup.test.ts'));
for (const f of ['backtest', 'strategies', 'paper']) writeFileSync(join(d, f + '.ts'), readFileSync('lib/' + f + '.ts', 'utf8').replaceAll("from './setup'", "from './setup.ts'"));
writeFileSync(join(d, 'backtest.test.ts'), readFileSync('tests/backtest.test.ts', 'utf8').replaceAll("'../lib/", "'./"));
writeFileSync(join(d, 'trade-guard.test.ts'), readFileSync('tests/trade-guard.test.ts', 'utf8').replaceAll("from '../lib/trade-guard.ts'", "from './trade-guard.ts'").replaceAll("from '../lib/setup.ts'", "from './setup.ts'"));
writeFileSync(join(d, 'grid-bot.test.ts'), readFileSync('tests/grid-bot.test.ts', 'utf8').replaceAll("from '../lib/grid-bot.ts'", "from './grid-bot.ts'").replaceAll("from '../lib/trade-guard.ts'", "from './trade-guard.ts'"));
const setup = nodeTest(join(d, 'setup.test.ts'));
const guard = nodeTest(join(d, 'trade-guard.test.ts'));
const grid = nodeTest(join(d, 'grid-bot.test.ts'));
const bt = nodeTest(join(d, 'backtest.test.ts'));
const keys = nodeTest('tests/api-key.test.ts');
const balances = nodeTest('tests/sodex-balances.test.ts');
const transfer = nodeTest('tests/sodex-transfer.test.ts');
const swapUx = nodeTest('tests/swap-ux.test.ts');
const journal = nodeTest('tests/journal.test.ts');
const watch = nodeTest('tests/watch-alerts.test.ts');
const brief = nodeTest('tests/daily-brief.test.ts');

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

process.exit((setup.status ?? 1) || (guard.status ?? 1) || (grid.status ?? 1) || (bt.status ?? 1) || (keys.status ?? 1) || (balances.status ?? 1) || (transfer.status ?? 1) || (swapUx.status ?? 1) || (journal.status ?? 1) || (watch.status ?? 1) || (brief.status ?? 1) || (cfg.status ?? 1) || (routes.status ?? 1));
