'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Wallet, Info, TrendingUp, TrendingDown, Zap } from 'lucide-react';

interface Props { symbol: string; price: number; network: string; }

const PCT_SHORTCUTS = [25, 50, 75, 100];

export default function TradingTerminal({ symbol, price, network }: Props) {
  const [side,            setSide]          = useState<'BUY' | 'SELL'>('BUY');
  const [type,            setType]          = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [amount,          setAmount]        = useState('');
  const [limitPrice,      setLimitPrice]    = useState(price.toFixed(4));
  const [stopLoss,        setStopLoss]      = useState('');
  const [takeProfit,      setTakeProfit]    = useState('');
  const [walletConnected, setWallet]        = useState(false);
  const [account,         setAccount]       = useState('');
  const [loading,         setLoading]       = useState(false);
  const [submitted,       setSubmitted]     = useState(false);
  const [balance,         setBalance]       = useState(1000); // mock USDC balance

  // Keep limit price in sync with live price (only if user hasn't edited it)
  const [priceEdited, setPriceEdited] = useState(false);
  useEffect(() => {
    if (!priceEdited) setLimitPrice(price.toFixed(4));
  }, [price, priceEdited]);

  // Derived order metrics
  const execPrice  = type === 'MARKET' ? price : parseFloat(limitPrice) || price;
  const qty        = parseFloat(amount) || 0;
  const orderTotal = (qty * execPrice).toFixed(2);
  const slippage   = type === 'MARKET' ? (execPrice * 0.001).toFixed(4) : '0.0000';
  const baseName   = symbol.split('_')[0].replace(/^v/, '');

  const canTrade   = walletConnected && qty > 0 && (type === 'MARKET' || parseFloat(limitPrice) > 0);
  const riskPct    = stopLoss ? Math.abs(((parseFloat(stopLoss) - execPrice) / execPrice) * 100).toFixed(2) : null;
  const rewardPct  = takeProfit ? Math.abs(((parseFloat(takeProfit) - execPrice) / execPrice) * 100).toFixed(2) : null;
  const rrRatio    = riskPct && rewardPct ? (parseFloat(rewardPct) / parseFloat(riskPct)).toFixed(2) : null;

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        setWallet(true);
      } catch {}
    } else {
      alert('Please install MetaMask!');
    }
  };

  const handleTrade = () => {
    if (!walletConnected) { connectWallet(); return; }
    if (!canTrade) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    }, 1400);
  };

  const applyPct = (pct: number) => {
    const maxQty = balance / execPrice;
    setAmount((maxQty * pct / 100).toFixed(6));
  };

  const sideColor = side === 'BUY' ? '#00e676' : '#f43f5e';
  const sideBg    = side === 'BUY' ? 'rgba(0,230,118,0.1)' : 'rgba(244,63,94,0.1)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Order type tabs ── */}
      <div style={{ display: 'flex', marginBottom: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 3, gap: 2 }}>
        {(['LIMIT', 'MARKET'] as const).map(t => (
          <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: type === t ? 'rgba(255,255,255,0.07)' : 'transparent', color: type === t ? '#fff' : 'var(--text-dim)', fontSize: 10, fontWeight: 900, cursor: 'pointer', letterSpacing: '.08em', transition: 'all 0.2s' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── BUY / SELL toggle ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {(['BUY', 'SELL'] as const).map(s => (
          <motion.button key={s} whileTap={{ scale: 0.97 }} onClick={() => setSide(s)} style={{
            padding: '11px', borderRadius: 10,
            border: `1px solid ${side === s ? (s === 'BUY' ? '#00e676' : '#f43f5e') : 'var(--border-subtle)'}`,
            background: side === s ? (s === 'BUY' ? 'rgba(0,230,118,0.12)' : 'rgba(244,63,94,0.12)') : 'transparent',
            color: side === s ? (s === 'BUY' ? '#00e676' : '#f43f5e') : 'var(--text-dim)',
            fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.2s',
          }}>
            {s === 'BUY' ? <TrendingUp size={13}/> : <TrendingDown size={13}/>} {s}
          </motion.button>
        ))}
      </div>

      {/* ── Limit Price (only for LIMIT) ── */}
      {type === 'LIMIT' && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, display: 'block', marginBottom: 5, letterSpacing: '.1em', textTransform: 'uppercase' }}>Limit Price (USDC)</label>
          <input
            value={limitPrice}
            onChange={e => { setLimitPrice(e.target.value); setPriceEdited(true); }}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${priceEdited ? sideColor + '60' : 'var(--border-bold)'}`, color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
          />
        </div>
      )}

      {/* ── Amount ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <label style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Amount ({baseName})</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {PCT_SHORTCUTS.map(p => (
              <button key={p} onClick={() => applyPct(p)} style={{ fontSize: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 800 }}>
                {p}%
              </button>
            ))}
          </div>
        </div>
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.000000"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-bold)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* ── Stop Loss / Take Profit ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 8, color: '#f43f5e', fontWeight: 800, display: 'block', marginBottom: 4, letterSpacing: '.08em' }}>STOP LOSS</label>
          <input value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '7px 10px', borderRadius: 7, background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.18)', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 8, color: '#00e676', fontWeight: 800, display: 'block', marginBottom: 4, letterSpacing: '.08em' }}>TAKE PROFIT</label>
          <input value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '7px 10px', borderRadius: 7, background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.18)', color: '#fff', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* ── Order Summary ── */}
      {qty > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: sideBg, border: `1px solid ${sideColor}25`, borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace' }}>
            <span style={{ color: 'var(--text-dim)' }}>Order Total</span>
            <span style={{ color: '#fff', fontWeight: 900 }}>${orderTotal} USDC</span>
          </div>
          {type === 'MARKET' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace' }}>
              <span style={{ color: 'var(--text-dim)' }}>Est. Slippage</span>
              <span style={{ color: '#ffd740' }}>~${slippage}</span>
            </div>
          )}
          {rrRatio && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace' }}>
              <span style={{ color: 'var(--text-dim)' }}>R:R Ratio</span>
              <span style={{ color: parseFloat(rrRatio) >= 2 ? '#00e676' : '#ffd740', fontWeight: 900 }}>{rrRatio}:1</span>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Submit button ── */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleTrade}
        disabled={loading || (walletConnected && !canTrade)}
        style={{
          width: '100%', padding: '13px', borderRadius: 12,
          background: submitted
            ? 'linear-gradient(135deg,#00e676,#00c853)'
            : walletConnected
              ? side === 'BUY' ? 'linear-gradient(135deg,#00e676,#00c853)' : 'linear-gradient(135deg,#f43f5e,#be123c)'
              : 'linear-gradient(135deg,#f97316,#ea580c)',
          color: '#000', border: 'none', fontSize: 12, fontWeight: 900, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `0 8px 24px ${walletConnected ? (side === 'BUY' ? 'rgba(0,230,118,0.25)' : 'rgba(244,63,94,0.25)') : 'rgba(249,115,22,0.25)'}`,
          letterSpacing: '.06em', transition: 'all 0.2s',
          opacity: walletConnected && !canTrade ? 0.5 : 1,
        }}
      >
        {loading  ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}><Zap size={14} /></motion.div>
        : submitted ? <><CheckCircle size={14} /> ORDER PLACED!</>
        : walletConnected ? <><CheckCircle size={14} /> PLACE {side} ORDER</>
        : <><Wallet size={14} /> CONNECT WALLET</>}
      </motion.button>

      {/* ── Info footer ── */}
      {!walletConnected && (
        <div style={{ display: 'flex', gap: 7, background: 'rgba(59,130,246,0.06)', padding: 9, borderRadius: 9, border: '1px solid rgba(59,130,246,0.12)', marginTop: 10 }}>
          <Info size={12} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 10, color: '#555', margin: 0, lineHeight: 1.5 }}>
            EIP-1193 secure sign-in. Orders execute on SoDEX <strong style={{ color: '#666' }}>{network}</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
