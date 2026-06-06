'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSodexWS } from '@/hooks/useSodexWS';
import { useSodexStore } from '@/store/sodexStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { MarketTicker } from '@/components/SodexMarket';
import TokenListSidebar from '@/components/TokenListSidebar';
import { TradeSetupPanel } from '@/components/TradeSetupPanel';
import type { Ticker, Network, TradeSetup } from '@/types/sodex';
import { fmtPrice, fmtVol } from '@/lib/sodex';

type Network2 = Network;

type BottomTab = 'positions' | 'orders' | 'history';
type OrderSide = 'BUY' | 'SELL';
type OrderType = 'LIMIT' | 'MARKET';

const TOOLS = ['✛','╱','▭','○','📐','〰','🔍','⟳'];

// Fake recent trades feed
function useFakeTrades(price: number) {
  const [trades, setTrades] = useState<{id:number;price:number;qty:string;side:'buy'|'sell';ts:number}[]>([]);
  const ref = useRef(0);
  useEffect(() => {
    if (!price) return;
    const id = setInterval(() => {
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const qty = (Math.random() * 0.5 + 0.001).toFixed(4);
      const p = price * (1 + (Math.random() - 0.5) * 0.001);
      setTrades(prev => [{ id: ++ref.current, price: p, qty, side, ts: Date.now() }, ...prev.slice(0, 29)]);
    }, 2500); // Throttled to 2.5s instead of 900ms to save CPU
    return () => clearInterval(id);
  }, [price]);
  return trades;
}

export default function SodexMarketsPage() {
  const [network, setNetwork] = useState<Network2>('mainnet');
  const [selected, setSelected] = useState<Ticker | null>(null);
  const [sortMode, setSortMode] = useState<'vol'|'gainers'|'losers'>('vol');
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions');
  const [tradeSetup, setTradeSetup] = useState<TradeSetup | null>(null);
  
  const { positions, orders } = usePortfolioStore();

  const { subscribeBook } = useSodexWS(network);
  
  // Use selectors for minimum necessary re-renders
  const isConnected = useSodexStore(state => state.connected);
  const totalVol = useSodexStore(state => state.tickerList.reduce((s,t) => s+t.quoteVolume, 0));
  const liveTicker = useSodexStore(state => selected ? state.tickers.get(selected.symbol) : null);
  const displayedTicker = liveTicker || selected;

  // Auto-select first ticker when loaded
  const firstTickerSymbol = useSodexStore(state => state.tickerList[0]?.symbol);
  useEffect(() => {
    if (firstTickerSymbol && !selected) {
      const initial = useSodexStore.getState().tickers.get(firstTickerSymbol);
      if (initial) {
        setSelected(initial);
        subscribeBook(initial.symbol);
      }
    }
  }, [firstTickerSymbol, selected, subscribeBook]);

  const trades = useFakeTrades(displayedTicker?.lastPrice ?? 0);

  const handleSelect = (t: Ticker) => { setSelected(t); subscribeBook(t.symbol); };

  const fmtV = (v:number) => v>1e6?`$${(v/1e6).toFixed(2)}M`:v>1e3?`$${(v/1e3).toFixed(1)}K`:`$${v.toFixed(0)}`;


  return (
    <div className="page-in" style={{display:'flex',flexDirection:'column',height:'100vh',background:'#09090f',color:'#e0e0f0',overflow:'hidden',fontFamily:'monospace'}}>

      {/* ── TOP HEADER ── */}
      <div style={{height:52,display:'flex',alignItems:'center',padding:'0 12px',borderBottom:'1px solid #1a1a2e',background:'#0d0d1a',gap:12,flexShrink:0}}>
        {/* Symbol */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#f97316,#f59e0b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:'#000'}}>
            {selected?.base?.slice(0,2)??'BT'}
          </div>
          {/* Spacer */}
        <div style={{flex:1}}/>
        <div style={{fontSize:9,color:'#44446a',fontWeight:800,letterSpacing:'.1em'}}>
          {network.toUpperCase()} API
        </div>
        </div>

        <div style={{width:1,height:28,background:'#1e1e3a'}}/>

        {/* Price */}
        {displayedTicker && <>
          <div>
            <div style={{fontSize:20,fontWeight:900,color:'#fff',letterSpacing:'-0.03em'}}>{displayedTicker.lastPrice.toLocaleString()}</div>
            <div style={{fontSize:10,fontWeight:800,color:displayedTicker.priceChangePct>=0?'#00e676':'#f43f5e'}}>
              {displayedTicker.priceChangePct>=0?'+':''}{displayedTicker.priceChangePct.toFixed(2)}%
            </div>
          </div>
          {[['24H Change',`${displayedTicker.priceChangePct>=0?'+':''}${displayedTicker.priceChangePct.toFixed(2)}%`,displayedTicker.priceChangePct>=0?'#00e676':'#f43f5e'],
            ['24H High',`$${fmtPrice(displayedTicker.high)}`,'#00e676'],
            ['24H Low', `$${fmtPrice(displayedTicker.low)}`,'#f43f5e'],
            ['24H Vol(USDC)',fmtVol(displayedTicker.quoteVolume),'#8888aa']
          ].map(([l,v,c])=>(
            <div key={l as string} style={{padding:'0 10px',borderLeft:'1px solid #1e1e3a'}}>
              <div style={{fontSize:9,color:'#444466',fontWeight:700}}>{l}</div>
              <div style={{fontSize:12,fontWeight:800,color:c as string}}>{v}</div>
            </div>
          ))}
        </>}

        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {/* Network */}
          <div style={{display:'flex',background:'rgba(255,255,255,0.03)',border:'1px solid #1e1e3a',borderRadius:8,padding:2,gap:2}}>
            {(['mainnet','testnet'] as Network2[]).map(n=>(
              <button key={n} onClick={()=>setNetwork(n)} style={{padding:'4px 12px',borderRadius:6,border:'none',fontSize:9,fontWeight:900,cursor:'pointer',background:network===n?'#f97316':'transparent',color:network===n?'#000':'#666'}}>
                {n.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Live dot */}
          <div style={{display:'flex',alignItems:'center',gap:5,background:isConnected?'rgba(0,230,118,0.08)':'rgba(244,63,94,0.08)',border:`1px solid ${isConnected?'rgba(0,230,118,0.2)':'rgba(244,63,94,0.2)'}`,borderRadius:99,padding:'4px 10px'}}>
            <motion.div animate={{opacity:isConnected?[1,0.3,1]:1}} transition={{repeat:Infinity,duration:1.2}}
              style={{width:6,height:6,borderRadius:'50%',background:isConnected?'#00e676':'#f43f5e'}}/>
            <span style={{fontSize:9,fontWeight:900,color:isConnected?'#00e676':'#f43f5e'}}>{isConnected?'LIVE':'OFFLINE'}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* LEFT SIDEBAR (Token List) */}
        <TokenListSidebar onSelectTicker={handleSelect} />

        {/* CENTER: Real-Time Data Hub & Positions */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden', borderRight:'1px solid #1a1a2e'}}>
          {/* Main Data Area */}
          <div style={{flex:1,minHeight:0,display:'flex',alignItems:'center',justifyContent:'center',background:'radial-gradient(circle at center, #111120 0%, #05050a 100%)', padding: 40}}>
            {displayedTicker ? (
              <div style={{ width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 32 }}>
                
                {/* Big Price Display */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#666', letterSpacing: '.2em' }}>{displayedTicker.base} / USDC</div>
                  <div style={{ fontSize: 72, fontWeight: 900, color: '#fff', fontFamily: 'monospace', lineHeight: 1, textShadow: '0 0 40px rgba(255,255,255,0.1)' }}>
                    {fmtPrice(displayedTicker.lastPrice)}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: displayedTicker.priceChangePct >= 0 ? '#00e676' : '#f43f5e', fontFamily: 'monospace' }}>
                    {displayedTicker.priceChangePct >= 0 ? '+' : ''}{displayedTicker.priceChangePct.toFixed(2)}%
                  </div>
                </div>

                {/* 24h Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, background: '#0a0a14', padding: 24, borderRadius: 16, border: '1px solid #1a1a2e' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#666', fontWeight: 900, letterSpacing: '.1em' }}>24H HIGH</span>
                    <span style={{ fontSize: 16, color: '#fff', fontWeight: 700, fontFamily: 'monospace' }}>{fmtPrice(displayedTicker.high)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderLeft: '1px solid #1a1a2e', borderRight: '1px solid #1a1a2e' }}>
                    <span style={{ fontSize: 10, color: '#666', fontWeight: 900, letterSpacing: '.1em' }}>24H LOW</span>
                    <span style={{ fontSize: 16, color: '#fff', fontWeight: 700, fontFamily: 'monospace' }}>{fmtPrice(displayedTicker.low)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#666', fontWeight: 900, letterSpacing: '.1em' }}>24H VOL (USDC)</span>
                    <span style={{ fontSize: 16, color: '#fff', fontWeight: 700, fontFamily: 'monospace' }}>{fmtV(displayedTicker.baseVolume * displayedTicker.lastPrice)}</span>
                  </div>
                </div>

                {/* AI Insight Snippet */}
                <div style={{ background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.2)', padding: 16, borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ color: '#00e676', marginTop: 2 }}>⚡</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#00e676', marginBottom: 4, letterSpacing: '.1em' }}>AI AGENT INSIGHT</div>
                    <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                      Detecting strong accumulation in {displayedTicker.base} over the last 4 hours. Order book imbalance suggests upward pressure. Recommended strategy: Momentum entries on micro-dips.
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',opacity:0.3}}>
                <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:2,ease:'linear'}} style={{fontSize:32}}>⟳</motion.div>
              </div>
            )}
          </div>

          {/* Bottom Positions Bar */}
          <div style={{borderTop:'1px solid #1a1a2e',background:'#0a0a14',flexShrink:0}}>
            {/* Tabs */}
            <div style={{display:'flex',borderBottom:'1px solid #1a1a2e'}}>
              <button onClick={()=>setBottomTab('positions')} style={{padding:'8px 16px',border:'none',background:'transparent',fontSize:10,fontWeight:900,cursor:'pointer',letterSpacing:'.08em',textTransform:'uppercase',color:bottomTab==='positions'?'#f97316':'#44446a',borderBottom:bottomTab==='positions'?'2px solid #f97316':'2px solid transparent'}}>
                Positions({positions.length})
              </button>
              <button onClick={()=>setBottomTab('orders')} style={{padding:'8px 16px',border:'none',background:'transparent',fontSize:10,fontWeight:900,cursor:'pointer',letterSpacing:'.08em',textTransform:'uppercase',color:bottomTab==='orders'?'#f97316':'#44446a',borderBottom:bottomTab==='orders'?'2px solid #f97316':'2px solid transparent'}}>
                Open Orders({orders.length})
              </button>
              <button onClick={()=>setBottomTab('history')} style={{padding:'8px 16px',border:'none',background:'transparent',fontSize:10,fontWeight:900,cursor:'pointer',letterSpacing:'.08em',textTransform:'uppercase',color:bottomTab==='history'?'#f97316':'#44446a',borderBottom:bottomTab==='history'?'2px solid #f97316':'2px solid transparent'}}>
                Trade History
              </button>
              <div style={{marginLeft:'auto',display:'flex',gap:8,padding:'0 12px',alignItems:'center'}}>
                <span style={{fontSize:9,color:'#2a2a4a',fontWeight:700}}>Total Vol 24H: {fmtV(totalVol)}</span>
              </div>
            </div>
            {/* Content state */}
            {bottomTab === 'positions' && positions.length > 0 ? (
              <div style={{ height: 120, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', padding: '6px 16px', fontSize: 9, color: '#44446a', fontWeight: 900, borderBottom: '1px solid #1a1a2e', position: 'sticky', top: 0, background: '#0a0a14' }}>
                  <span>SYMBOL / MODE</span><span>SIDE</span><span>SIZE</span><span>ENTRY PRICE</span><span style={{ textAlign: 'right' }}>UNREALIZED PNL</span>
                </div>
                {positions.map(p => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr', padding: '6px 16px', fontSize: 11, fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 900, color: '#fff' }}>{p.symbol}</span>
                      <span style={{ fontSize: 8, color: p.mode === 'real' ? '#00b0ff' : '#a78bfa', fontWeight: 800 }}>{p.mode.toUpperCase()}</span>
                    </div>
                    <span style={{ color: p.side === 'BUY' ? '#00e676' : '#f43f5e', fontWeight: 900 }}>{p.side}</span>
                    <span style={{ color: '#8888aa' }}>{p.size.toFixed(4)}</span>
                    <span style={{ color: '#8888aa' }}>${p.entryPrice.toFixed(4)}</span>
                    <span style={{ textAlign: 'right', color: p.unrealizedPnL >= 0 ? '#00e676' : '#f43f5e', fontWeight: 900 }}>
                      {p.unrealizedPnL >= 0 ? '+' : ''}{p.unrealizedPnL.toFixed(2)} USDC
                    </span>
                  </div>
                ))}
              </div>
            ) : bottomTab === 'orders' && orders.length > 0 ? (
              <div style={{ height: 120, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.5fr', padding: '6px 16px', fontSize: 9, color: '#44446a', fontWeight: 900, borderBottom: '1px solid #1a1a2e', position: 'sticky', top: 0, background: '#0a0a14' }}>
                  <span>SYMBOL</span><span>SIDE</span><span>SIZE</span><span>PRICE</span><span style={{ textAlign: 'right' }}>TIMESTAMP</span>
                </div>
                {orders.map(o => (
                  <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.5fr', padding: '6px 16px', fontSize: 11, fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <span style={{ fontWeight: 900, color: '#fff' }}>{o.symbol}</span>
                    <span style={{ color: o.side === 'BUY' ? '#00e676' : '#f43f5e', fontWeight: 900 }}>{o.side}</span>
                    <span style={{ color: '#8888aa' }}>{o.size.toFixed(4)}</span>
                    <span style={{ color: '#8888aa' }}>${o.price.toFixed(4)}</span>
                    <span style={{ textAlign: 'right', color: '#666', fontSize: 10 }}>{new Date(o.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{height:80,display:'flex',alignItems:'center',justifyContent:'center',color:'#2a2a4a',fontSize:11,fontWeight:700}}>
                No {bottomTab} yet
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Market Trades (Recent execution tape) */}
        <div style={{width:260,flexShrink:0,borderLeft:'1px solid #1a1a2e',display:'flex',flexDirection:'column',background:'#0a0a14'}}>
          <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
            <div style={{flex:1,padding:'9px 12px',fontSize:9,fontWeight:900,color:'#fff',borderBottom:'2px solid #f97316'}}>
              MARKET TRADES
            </div>
          </div>
          <div className="scroll-track" style={{flex:1,overflowY:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'5px 12px',fontSize:8,color:'#44446a',fontWeight:900,borderBottom:'1px solid #1a1a2e',position:'sticky',top:0,background:'#0a0a14'}}>
              <span>PRICE(USDC)</span><span style={{textAlign:'center'}}>SIZE</span><span style={{textAlign:'right'}}>TIME</span>
            </div>
            {(() => {
              const myTrades = orders
                .filter(o => !selected || o.symbol === selected.symbol) // Filter to current view or show all? Let's show all for excitement
                .map(o => ({ id: o.id, price: o.price, qty: o.size.toString(), side: o.side.toLowerCase() as 'buy'|'sell', ts: o.timestamp, isMine: true }));
              
              const mergedTrades = [...myTrades, ...trades.map(t => ({...t, isMine: false}))].sort((a, b) => b.ts - a.ts).slice(0, 50);

              return mergedTrades.map(tr=>(
                <div key={tr.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'3px 12px',fontSize:10,fontFamily:'monospace',borderBottom:'1px solid rgba(255,255,255,0.02)', background: tr.isMine ? 'rgba(249, 115, 22, 0.1)' : 'transparent'}}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {tr.isMine && <span style={{fontSize: 8, color: '#f97316'}}>YOU</span>}
                    <span style={{color:tr.side==='buy'?'#00e676':'#f43f5e',fontWeight:700}}>{fmtPrice(tr.price)}</span>
                  </div>
                  <span style={{textAlign:'center',color: tr.isMine ? '#fff' : '#8888aa'}}>{tr.qty}</span>
                  <span style={{textAlign:'right',color:'#44446a',fontSize:9}}>{new Date(tr.ts).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                </div>
              ))
            })()}
          </div>
        </div>

        {/* FAR RIGHT / SIDEBAR */}
        <div style={{ width: 340, flexShrink: 0, background: '#05050a', borderLeft: '1px solid #1a1a2e', display: 'flex', flexDirection: 'column' }}>
          <TradeSetupPanel 
            selected={selected} 
            onTradeSetupChange={setTradeSetup}
          />
        </div>
      </div>
    </div>
  );
}
