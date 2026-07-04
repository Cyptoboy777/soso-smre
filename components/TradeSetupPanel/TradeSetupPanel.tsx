'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { validateTradeRisk, calculateAtrTargets, calculatePositionSizeByRisk } from '@/lib/riskManager';
import { calcPnL } from '@/lib/tradeMath';
import { ShieldAlert, Crosshair, Target, Zap, RefreshCw, Settings } from 'lucide-react';
import { useAccount, useSignTypedData, useBalance, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import MarketAnalysisEngine from './MarketAnalysisEngine';
import RiskDashboard from './RiskDashboard';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { Ticker, TradeSetup, RiskSettings } from '@/types/sodex';
import { formatUnits } from 'viem';

interface Props {
  selected: Ticker | null;
  onTradeSetupChange: (setup: TradeSetup) => void;
}

export const TradeSetupPanel = React.memo(function TradeSetupPanel({ selected, onTradeSetupChange }: Props) {
  // Global State
  const { isConnected, address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const [paperTrading, setPaperTrading] = useState(true);
  const [executionRoute, setExecutionRoute] = useState<'contract' | 'relayer'>('relayer');

  // Wagmi USDC balance (Assuming USDC is on Ethereum Mainnet or similar. We mock the token address or use native balance if not available for hackathon demo).
  // For hackathon, if no token, we can just read ETH balance or mock if 0. We'll read ETH for demo if no USDC token specified.
  const { data: balanceData } = useBalance({ address });
  
  // Portfolio Store
  const { paperCapital, dailyPnL, addPosition, addOrder, setPaperCapital, addDailyPnL } = usePortfolioStore();

  const realCapital = balanceData ? parseFloat(formatUnits(balanceData.value, balanceData.decimals)) * 3500 : 0; // Mock ETH -> USD for demo purposes if no raw USDC.
  const capital = paperTrading ? paperCapital : (realCapital > 0 ? realCapital : 5000); // Fallback to 5000 for Real Trading demo if empty wallet

  
  // Risk Settings
  const [settings, setSettings] = useState<RiskSettings>({
    maxRiskPerTradePct: 1,
    maxDailyRiskPct: 3,
    minRR: 2.0,
  });

  // Trade Form
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [entryPrice, setEntryPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [tpPrices, setTpPrices] = useState<string[]>(['']);

  const atr = selected ? (selected.high - selected.low) : 0;

  const autoSuggest = (forcedSide?: 'BUY'|'SELL') => {
    if (!selected) return;
    const targetSide = forcedSide || side;
    const atrProxy = selected.high - selected.low;
    const { sl, tps } = calculateAtrTargets(selected.lastPrice, targetSide, atrProxy);
    setEntryPrice(selected.lastPrice.toFixed(4));
    setSlPrice(sl.toFixed(4));
    setTpPrices(tps.map(t => t.toFixed(4)));
  };

  useEffect(() => {
    const handleSignal = (e: CustomEvent) => {
      const { side: sigSide, entry, sl, tp, autoSuggest: doAuto } = e.detail;
      if (sigSide) setSide(sigSide);
      if (entry) setEntryPrice(entry.toString());
      if (sl) setSlPrice(sl.toString());
      if (tp) setTpPrices([tp.toString()]);
      if (doAuto) autoSuggest(sigSide);
    };
    window.addEventListener('TradeSignal', handleSignal as EventListener);
    return () => window.removeEventListener('TradeSignal', handleSignal as EventListener);
  }, [selected, side]);
  
  const [trailingStop, setTrailingStop] = useState(false);
  const [breakevenMove, setBreakevenMove] = useState(true);
  
  const entry = parseFloat(entryPrice) || 0;
  const sl = parseFloat(slPrice) || 0;
  const tp = tpPrices.map(t => parseFloat(t) || 0);

  const riskAmountUsdc = capital * (settings.maxRiskPerTradePct / 100);
  const positionSize = calculatePositionSizeByRisk(riskAmountUsdc, entry, sl);

  const tradeSetup: TradeSetup = { side, entry, sl, tp, trailingStop, breakevenMove };
  
  // Run Risk Engine Validation
  const validation = validateTradeRisk(tradeSetup, settings, capital, dailyPnL);

  // Sync entry with market price when selecting token
  useEffect(() => {
    if (selected && !entryPrice) {
      setEntryPrice(selected.lastPrice.toFixed(4));
    }
  }, [selected?.symbol]); 

  // Sync to chart
  useEffect(() => {
    onTradeSetupChange(tradeSetup);
  }, [side, entryPrice, slPrice, tpPrices, trailingStop, breakevenMove]);

  // Handlers
  const addTp = () => {
    if (tpPrices.length < 3) setTpPrices([...tpPrices, '']);
  };
  const updateTp = (idx: number, val: string) => {
    const newTps = [...tpPrices];
    newTps[idx] = val;
    setTpPrices(newTps);
  };
  const removeTp = (idx: number) => {
    const newTps = tpPrices.filter((_, i) => i !== idx);
    if (newTps.length === 0) newTps.push('');
    setTpPrices(newTps);
  };


  const [submitted, setSubmitted] = useState(false);
  const executeTrade = async () => {
    if (!validation.valid || !selected) return;
    if (!paperTrading && !isConnected) return; // Should not reach here because of ConnectButton

    setSubmitted(true);
    try {
      if (!paperTrading) {
        if (executionRoute === 'contract') {
          // Real Trading -> Direct Smart Contract Hookup (Bypass Relayers)
          const tx = await writeContractAsync({
            address: '0x378BcADaBfF12530E57223b207aA6Fd4b93b4822', // SoDEX Smart Contract Router
            abi: [
              {
                name: 'executeOrderDirect',
                type: 'function',
                stateMutability: 'payable',
                inputs: [
                  { name: 'symbol', type: 'string' },
                  { name: 'side', type: 'uint8' },
                  { name: 'price', type: 'uint256' },
                  { name: 'size', type: 'uint256' }
                ],
                outputs: []
              }
            ],
            functionName: 'executeOrderDirect',
            args: [
              selected.symbol,
              side === 'BUY' ? 0 : 1,
              BigInt(Math.round(parseFloat(entryPrice) * 1e6)),
              BigInt(Math.round(positionSize * 1e18))
            ]
          });
          
          alert(`Decentralized Contract Call Succeeded! Transaction Hash: ${tx}`);
          
          const orderId = `${Date.now()}`;
          addOrder({ id: orderId, symbol: selected.symbol, side, size: positionSize, price: parseFloat(entryPrice), timestamp: Date.now(), mode: 'real' });
          addPosition({ id: orderId, symbol: selected.symbol, side, size: positionSize, entryPrice: parseFloat(entryPrice), unrealizedPnL: 0, mode: 'real' });
        } else {
          // Real Trading -> Sign Typed Data for SoDEX (Relayed Route)
          const domain = {
            name: 'SoDEX',
            version: '1',
            chainId: 1, 
            verifyingContract: '0x0000000000000000000000000000000000000000' as const,
          };

          const types = {
            Order: [
              { name: 'symbol', type: 'string' },
              { name: 'side', type: 'string' },
              { name: 'price', type: 'string' },
              { name: 'size', type: 'string' },
              { name: 'nonce', type: 'uint256' },
            ],
          };

          const message = {
            symbol: selected.symbol,
            side,
            price: entryPrice,
            size: positionSize.toString(),
            nonce: BigInt(Date.now()),
          };

          const signature = await signTypedDataAsync({
            domain,
            types,
            primaryType: 'Order',
            message,
          });

          // Send signature and payload to backend
          const res = await fetch('/api/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: selected.symbol,
              type: side,
              amount: positionSize,
              price: parseFloat(entryPrice),
              signature,
              mode: 'real'
            })
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Trade failed on SoDEX');
          }

          // Add to Real Portfolio
          const orderId = `${Date.now()}`;
          addOrder({ id: orderId, symbol: selected.symbol, side, size: positionSize, price: parseFloat(entryPrice), timestamp: Date.now(), mode: 'real' });
          addPosition({ id: orderId, symbol: selected.symbol, side, size: positionSize, entryPrice: parseFloat(entryPrice), unrealizedPnL: 0, mode: 'real' });
        }
      } else {
        // Mock execution for paper trading
        await new Promise(r => setTimeout(r, 1000));
        
        const orderId = `${Date.now()}`;
        addOrder({ id: orderId, symbol: selected.symbol, side, size: positionSize, price: parseFloat(entryPrice), timestamp: Date.now(), mode: 'paper' });
        addPosition({ id: orderId, symbol: selected.symbol, side, size: positionSize, entryPrice: parseFloat(entryPrice), unrealizedPnL: 0, mode: 'paper' });
        
        // Deduct from paper capital roughly
        setPaperCapital(paperCapital - riskAmountUsdc);
        addDailyPnL(-10); // Mock PnL hit on entry fees
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Execution failed');
    } finally {
      setSubmitted(false);
    }
  };

  const isBuy = side === 'BUY';
  const themeColor = isBuy ? '#00e676' : '#f43f5e';
  const themeGradient = isBuy ? 'linear-gradient(135deg, #00e676, #00b0ff)' : 'linear-gradient(135deg, #f43f5e, #f97316)';

  return (
    <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid #1a1a2e', display: 'flex', flexDirection: 'column', background: '#09090f', overflowY: 'auto' }} className="scroll-track">
      
      {/* MODE TOGGLE */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e3a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d0d1a' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>EXECUTION MODE</span>
        <button 
          onClick={() => setPaperTrading(!paperTrading)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: paperTrading ? 'rgba(249,115,22,0.1)' : 'rgba(0,230,118,0.1)', border: `1px solid ${paperTrading ? '#f97316' : '#00e676'}`, borderRadius: 20, padding: '4px 10px', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: paperTrading ? '#f97316' : '#00e676', boxShadow: `0 0 8px ${paperTrading ? '#f97316' : '#00e676'}` }} />
          <span style={{ fontSize: 9, fontWeight: 900, color: paperTrading ? '#f97316' : '#00e676' }}>
            {paperTrading ? 'PAPER TRADING' : 'REAL TRADING (WEB3)'}
          </span>
        </button>
      </div>

      {!paperTrading && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%' }}>
          <ConnectButton showBalance={false} />
          {/* Direct smart contract route selector */}
          <div style={{ display: 'flex', background: '#111120', borderRadius: 8, padding: 3, border: '1px solid #1e1e3a', width: '100%' }}>
            {['relayer', 'contract'].map((r) => (
              <button
                key={r}
                onClick={() => setExecutionRoute(r as any)}
                style={{
                  flex: 1, padding: '6px 0', border: 'none', borderRadius: 6,
                  background: executionRoute === r ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: executionRoute === r ? '#a78bfa' : '#44446a',
                  fontSize: 10, fontWeight: 900, cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                {r === 'contract' ? 'DIRECT CONTRACT' : 'GASLESS RELAYER'}
              </button>
            ))}
          </div>
        </div>
      )}

      <MarketAnalysisEngine selected={selected} />

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* RISK DASHBOARD */}
        <RiskDashboard validation={validation} dailyPnL={dailyPnL} maxDailyLoss={capital * (settings.maxDailyRiskPct/100)} />

        {/* BUY / SELL TOGGLE */}
        <div style={{ display: 'flex', background: '#111120', borderRadius: 10, padding: 4, border: '1px solid #1e1e3a' }}>
          {(['BUY', 'SELL'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: 6,
                background: side === s ? (s === 'BUY' ? 'rgba(0,230,118,0.15)' : 'rgba(244,63,94,0.15)') : 'transparent',
                color: side === s ? (s === 'BUY' ? '#00e676' : '#f43f5e') : '#44446a',
                fontSize: 12, fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* RISK & POSITION SIZE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span style={{ fontSize: 9, color: '#44446a', fontWeight: 800 }}>RISK PER TRADE (%)</span>
            <input 
              type="number" step="0.1" max="5" min="0.1"
              value={settings.maxRiskPerTradePct} 
              onChange={e => setSettings({...settings, maxRiskPerTradePct: parseFloat(e.target.value)||1})}
              style={{ width: '100%', background: '#141425', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'monospace', marginTop: 4 }}
            />
          </div>
          <div>
            <span style={{ fontSize: 9, color: '#44446a', fontWeight: 800 }}>CAPITAL AMOUNT</span>
            <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid #2a2a4a', borderRadius: 8, color: '#8888aa', fontSize: 13, fontFamily: 'monospace', marginTop: 4 }}>
              ${capital.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: '#1e1e3a', margin: '4px 0' }} />

        {/* TRADE LEVELS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 800 }}>ORDER LEVELS</span>
            <button onClick={() => autoSuggest()} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', border: 'none', padding: '4px 10px', borderRadius: 6, color: '#f97316', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
              <RefreshCw size={10} /> AI SUGGEST (ATR)
            </button>
          </div>

          {/* Entry */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Crosshair size={12} color="#38bdf8" />
              <span style={{ fontSize: 9, color: '#38bdf8', fontWeight: 800, letterSpacing: '0.05em' }}>ENTRY PRICE</span>
            </div>
            <input 
              type="number" 
              value={entryPrice} 
              onChange={e => setEntryPrice(e.target.value)}
              style={{ width: '100%', background: '#141425', border: '1px solid #2a2a4a', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
            />
          </div>

          {/* Stop Loss */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ShieldAlert size={12} color="#f43f5e" />
              <span style={{ fontSize: 9, color: '#f43f5e', fontWeight: 800, letterSpacing: '0.05em' }}>STOP LOSS</span>
              {entry > 0 && sl > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: '#f43f5e', fontFamily: 'monospace' }}>
                  -{Math.abs((entry - sl) / entry * 100).toFixed(2)}%
                </span>
              )}
            </div>
            <input 
              type="number" 
              value={slPrice} 
              onChange={e => setSlPrice(e.target.value)}
              style={{ width: '100%', background: '#141425', border: '1px solid #2a2a4a', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
            />
          </div>

          {/* Take Profits */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={12} color="#00e676" />
                <span style={{ fontSize: 9, color: '#00e676', fontWeight: 800, letterSpacing: '0.05em' }}>TAKE PROFIT</span>
              </div>
              {tpPrices.length < 3 && (
                <button onClick={addTp} style={{ background: 'none', border: 'none', color: '#00e676', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>+ ADD TP</button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tpPrices.map((val, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6 }}>
                  <div style={{ width: 40, background: '#111120', border: '1px solid #2a2a4a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#00e676' }}>
                    TP{idx + 1}
                  </div>
                  <input 
                    type="number" value={val} onChange={e => updateTp(idx, e.target.value)}
                    style={{ flex: 1, background: '#141425', border: '1px solid #2a2a4a', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
                  />
                  {tpPrices.length > 1 && (
                    <button onClick={() => removeTp(idx)} style={{ width: 36, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', fontSize: 14, cursor: 'pointer' }}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ADVANCED EXECUTION LOGIC */}
        <div style={{ background: '#111120', border: '1px solid #1e1e3a', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Settings size={12} color="#a78bfa" />
            <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 800 }}>ADVANCED AUTOMATION (CLIENT-SIDE)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: trailingStop ? '#fff' : '#8888aa', fontWeight: 600 }}>Trailing Stop</span>
              <input type="checkbox" checked={trailingStop} onChange={e => setTrailingStop(e.target.checked)} style={{ accentColor: '#a78bfa' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: 11, color: breakevenMove ? '#fff' : '#8888aa', fontWeight: 600 }}>Auto Move SL to Breakeven</span>
              <input type="checkbox" checked={breakevenMove} onChange={e => setBreakevenMove(e.target.checked)} style={{ accentColor: '#a78bfa' }} />
            </label>
          </div>
        </div>

        {/* EXECUTION SUMMARY */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${themeColor}33`, borderRadius: 10, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#8888aa', fontWeight: 700 }}>TOTAL POSITION SIZE</span>
            <span style={{ fontSize: 14, color: '#fff', fontWeight: 900, fontFamily: 'monospace' }}>
              {positionSize > 0 ? positionSize.toFixed(4) : '0.00'} {selected?.base}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#8888aa', fontWeight: 700 }}>TOTAL RISK (USDC)</span>
            <span style={{ fontSize: 12, color: '#f43f5e', fontWeight: 800, fontFamily: 'monospace' }}>
              -${riskAmountUsdc.toFixed(2)}
            </span>
          </div>
        </div>

        {/* EXECUTE BUTTON */}
        {!paperTrading && !isConnected ? (
          <div style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#111', border: '1px solid #333', color: '#666', fontSize: 13, fontWeight: 900, textAlign: 'center', letterSpacing: '0.05em' }}>
            PLEASE CONNECT WALLET TO EXECUTE
          </div>
        ) : (
          <motion.button 
            whileTap={validation.valid ? { scale: 0.98 } : {}} 
            onClick={executeTrade}
            disabled={!validation.valid}
            style={{ 
              width: '100%', padding: '14px', borderRadius: 12, border: 'none', 
              fontSize: 13, fontWeight: 900, cursor: validation.valid ? 'pointer' : 'not-allowed', color: validation.valid ? '#000' : '#44446a', letterSpacing: '0.05em',
              background: submitted ? '#00e676' : validation.valid ? themeGradient : '#111120',
              boxShadow: validation.valid ? `0 8px 24px ${themeColor}40` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            {submitted ? (
              <>✓ ORDER PLACED</>
            ) : !validation.valid ? (
              <>⚠️ FIX RISK RULES TO EXECUTE</>
            ) : (
              <><Zap size={16} /> EXECUTE {side} {selected?.base || ''}</>
            )}
          </motion.button>
        )}
      </div>
    </div>
  );
});
