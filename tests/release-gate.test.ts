import { describe, expect, it } from 'vitest';
import { intentView } from '@/lib/order-intent';
import { getBuilderConfig, assertRelayAllowed, assertTradingAllowed } from '@/lib/sodex-builder';

describe('mainnet review with submission held', () => {
  it('prepares against mainnet chain 286623 while submission stays off', () => {
    delete process.env.SODEX_MAINNET_TRADING;
    const cfg = getBuilderConfig();
    expect(cfg.targetNetwork).toBe('mainnet');
    expect(cfg.network).toBe('mainnet');
    expect(cfg.mainnet.chainId).toBe(286623);
    expect(cfg.executionEnabled).toBe(false);
    expect(assertTradingAllowed({ network: 'mainnet', confirmed: true })).toBeNull();
    expect(assertRelayAllowed({ network: 'mainnet', confirmed: true })).toBe('Order submission is not enabled.');
    expect(assertRelayAllowed({ network: 'testnet', confirmed: true })).toBe('Order submission is not enabled.');
  });
});

describe('intent labels follow the selected engine', () => {
  it('names perps, stops, brackets, twap, dca, and grid without calling them spot', () => {
    expect(intentView('perps').title).toBe('Perps order');
    expect(intentView('perps').engine).toBe('perps');
    expect(intentView('perps', 'market').showLimitPrice).toBe(false);
    expect(intentView('stop').showStop).toBe(true);
    expect(intentView('stop').engine).toBe('perps');
    expect(intentView('stop').title.startsWith('Perps')).toBe(true);
    expect(intentView('bracket').showTarget).toBe(true);
    expect(intentView('twap').showMinutes).toBe(true);
    expect(intentView('twap').showLimitPrice).toBe(false);
    expect(intentView('dca').showHour).toBe(true);
    expect(intentView('grid').engine).toBe('spot');
    expect(intentView('grid').showGrid).toBe(true);
    expect(intentView('spot').costNote).toMatch(/Spot/);
  });
});
