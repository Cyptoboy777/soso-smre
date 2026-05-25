'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSodexWS } from '@/hooks/useSodexWS';
import { MarketTicker, OrderBook } from '@/components/SodexMarket';
import SodexProfessionalChart from '@/components/SodexProfessionalChart';
import type { Ticker, Network } from '@/types/sodex';
import { fmtPrice, fmtVol } from '@/lib/sodex';

type Network2 = Network;
type RightTab = 'book' | 'trades';
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
    }, 900);
    return () => clearInterval(id);
  }, [price]);
  return trades;
}

export default function SodexMarketsPage() {
  const [network, setNetwork] = useState<Network2>('mainnet');
  const [selected, setSelected] = useState<Ticker | null>(null);
  const [sortMode, setSortMode] = useState<'vol'|'gainers'|'losers'>('vol');
  const [rightTab, setRightTab] = useState<RightTab>('book');
  const [bottomTab, setBottomTab] = useState<BottomTab>('orders');
  const [showSidebar, setShowSidebar] = useState(false);
  const [tool, setTool] = useState(0);

  // Order form
  const [side, setSide] = useState<OrderSide>('BUY');
  const [otype, setOtype] = useState<OrderType>('LIMIT');
  const [amount, setAmount] = useState('');
  const [limitP, setLimitP] = useState('');
  const [sliderPct, setSliderPct] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [wallet, setWallet] = useState(false);

  const { tickerList, orderBook, connected, subscribeBook } = useSodexWS(network);
  const trades = useFakeTrades(selected?.lastPrice ?? 0);

  useEffect(() => {
    if (tickerList.length > 0 && !selected) {
      const t = tickerList.find(t => t.symbol.includes('SOSO')) || tickerList[0];
      setSelected(t); subscribeBook(t.symbol);
    }
  }, [tickerList, selected, subscribeBook]);

  useEffect(() => {
    if (selected) setLimitP(selected.lastPrice.toFixed(4));
  }, [selected?.lastPrice]);

  const handleSelect = (t: Ticker) => { setSelected(t); subscribeBook(t.symbol); };

  const totalVol = useMemo(() => tickerList.reduce((s,t) => s+t.quoteVolume,0), [tickerList]);
  const fmtV = (v:number) => v>1e6?`$${(v/1e6).toFixed(2)}M`:v>1e3?`$${(v/1e3).toFixed(1)}K`:`$${v.toFixed(0)}`;

  const execPrice = otype === 'MARKET' ? (selected?.lastPrice??0) : parseFloat(limitP)||0;
  const qty = parseFloat(amount)||0;
  const orderVal = qty && execPrice ? (qty*execPrice).toFixed(2) : '0.00';
  const fee = qty && execPrice ? (qty*execPrice*0.00065).toFixed(4) : '0.0000';

  const connectWallet = async () => {
    const eth = (window as any).ethereum;
    if (!eth) { alert('Install a Web3 wallet'); return; }
    await eth.request({ method:'eth_requestAccounts' });
    setWallet(true);
  };
  const placeOrder = () => {
    if (!wallet) { connectWallet(); return; }
    setSubmitted(true); setTimeout(() => setSubmitted(false), 2000);
  };

  const sC = side==='BUY'?'#00e676':'#f43f5e';
  const sBg = side==='BUY'?'rgba(0,230,118,0.12)':'rgba(244,63,94,0.12)';

  return (
    <div className="page-in" style={{display:'flex',flexDirection:'column',height:'100vh',background:'#09090f',color:'#e0e0f0',overflow:'hidden',fontFamily:'monospace'}}>

      {/* ── TOP HEADER ── */}
      <div style={{height:52,display:'flex',alignItems:'center',padding:'0 12px',borderBottom:'1px solid #1a1a2e',background:'#0d0d1a',gap:12,flexShrink:0}}>
        {/* Symbol */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#f97316,#f59e0b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:'#000'}}>
            {selected?.base?.slice(0,2)??'BT'}
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:900,letterSpacing:'-0.02em'}}>{selected?.base??'BTC'}/USDC</div>
            <div style={{fontSize:9,color:'#3b82f6',fontWeight:700,background:'rgba(59,130,246,0.1)',padding:'1px 6px',borderRadius:4,display:'inline-block'}}>Spot</div>
          </div>
        </div>

        <div style={{width:1,height:28,background:'#1e1e3a'}}/>

        {/* Price */}
        {selected && <>
          <div>
            <div style={{fontSize:20,fontWeight:900,color:'#fff',letterSpacing:'-0.03em'}}>{selected.lastPrice.toLocaleString()}</div>
            <div style={{fontSize:10,fontWeight:800,color:selected.priceChangePct>=0?'#00e676':'#f43f5e'}}>
              {selected.priceChangePct>=0?'+':''}{selected.priceChangePct.toFixed(2)}%
            </div>
          </div>
          {[['24H Change',`${selected.priceChangePct>=0?'+':''}${selected.priceChangePct.toFixed(2)}%`,selected.priceChangePct>=0?'#00e676':'#f43f5e'],
            ['24H High',`$${fmtPrice(selected.high)}`,'#00e676'],
            ['24H Low', `$${fmtPrice(selected.low)}`,'#f43f5e'],
            ['24H Vol(USDC)',fmtVol(selected.quoteVolume),'#8888aa']
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
          <div style={{display:'flex',alignItems:'center',gap:5,background:connected?'rgba(0,230,118,0.08)':'rgba(244,63,94,0.08)',border:`1px solid ${connected?'rgba(0,230,118,0.2)':'rgba(244,63,94,0.2)'}`,borderRadius:99,padding:'4px 10px'}}>
            <motion.div animate={{opacity:connected?[1,0.3,1]:1}} transition={{repeat:Infinity,duration:1.2}}
              style={{width:6,height:6,borderRadius:'50%',background:connected?'#00e676':'#f43f5e'}}/>
            <span style={{fontSize:9,fontWeight:900,color:connected?'#00e676':'#f43f5e'}}>{connected?'LIVE':'OFFLINE'}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* LEFT: Drawing Toolbar */}
        <div style={{width:40,flexShrink:0,borderRight:'1px solid #1a1a2e',display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 0',gap:4,background:'#0a0a14'}}>
          {TOOLS.map((ic,i)=>(
            <button key={i} onClick={()=>setTool(i)} title={`Tool ${i+1}`}
              style={{width:32,height:32,borderRadius:8,border:'none',background:tool===i?'rgba(249,115,22,0.15)':'transparent',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',color:tool===i?'#f97316':'#444466',transition:'all 0.15s'}}>
              {ic}
            </button>
          ))}
          <div style={{flex:1}}/>
          <button onClick={()=>setShowSidebar(v=>!v)}
            style={{width:32,height:32,borderRadius:8,border:`1px solid ${showSidebar?'#f97316':'#1e1e3a'}`,background:showSidebar?'rgba(249,115,22,0.1)':'transparent',cursor:'pointer',fontSize:10,color:showSidebar?'#f97316':'#444466'}}>
            ☰
          </button>
        </div>

        {/* LEFT MARKET SIDEBAR (toggle) */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div initial={{width:0,opacity:0}} animate={{width:240,opacity:1}} exit={{width:0,opacity:0}}
              style={{flexShrink:0,borderRight:'1px solid #1a1a2e',overflow:'hidden',background:'rgba(0,0,0,0.3)'}}>
              <MarketTicker tickers={tickerList} onSelect={handleSelect} selected={selected?.symbol} sortMode={sortMode}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CENTER: Chart */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Chart area */}
          <div style={{flex:1,minHeight:0,position:'relative'}}>
            {selected ? (
              <SodexProfessionalChart
                initialSymbol={selected.base}
                livePrice={selected.lastPrice}
                onSymbolChange={(_,base)=>{const m=tickerList.find(t=>t.base===base);if(m)handleSelect(m);}}
              />
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
              {(['positions','orders','history'] as BottomTab[]).map(t=>(
                <button key={t} onClick={()=>setBottomTab(t)}
                  style={{padding:'8px 16px',border:'none',background:'transparent',fontSize:10,fontWeight:900,cursor:'pointer',letterSpacing:'.08em',textTransform:'uppercase',color:bottomTab===t?'#f97316':'#44446a',borderBottom:bottomTab===t?'2px solid #f97316':'2px solid transparent'}}>
                  {t==='positions'?'Position(0)':t==='orders'?'Open Orders(0)':'Trade History'}
                </button>
              ))}
              <div style={{marginLeft:'auto',display:'flex',gap:8,padding:'0 12px',alignItems:'center'}}>
                <span style={{fontSize:9,color:'#2a2a4a',fontWeight:700}}>Total Vol 24H: {fmtV(totalVol)}</span>
              </div>
            </div>
            {/* Empty state */}
            <div style={{height:80,display:'flex',alignItems:'center',justifyContent:'center',color:'#2a2a4a',fontSize:11,fontWeight:700}}>
              No {bottomTab} yet — connect wallet to trade
            </div>
          </div>
        </div>

        {/* RIGHT: Order Book + Trades */}
        <div style={{width:260,flexShrink:0,borderLeft:'1px solid #1a1a2e',display:'flex',flexDirection:'column',background:'#0a0a14'}}>
          {/* Tabs */}
          <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
            {([['book','Order Book'],['trades','Market Trades']] as [RightTab,string][]).map(([id,lbl])=>(
              <button key={id} onClick={()=>setRightTab(id)}
                style={{flex:1,padding:'9px 0',border:'none',background:'transparent',fontSize:9,fontWeight:900,cursor:'pointer',color:rightTab===id?'#fff':'#44446a',borderBottom:rightTab===id?'2px solid #f97316':'2px solid transparent'}}>
                {lbl.toUpperCase()}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {rightTab==='book' ? (
              <motion.div key="book" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                <OrderBook book={orderBook} symbol={selected?.symbol??null}/>
              </motion.div>
            ) : (
              <motion.div key="trades" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="scroll-track" style={{flex:1,overflowY:'auto'}}>
                {/* Column headers */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'5px 12px',fontSize:8,color:'#44446a',fontWeight:900,borderBottom:'1px solid #1a1a2e',position:'sticky',top:0,background:'#0a0a14'}}>
                  <span>PRICE(USDC)</span><span style={{textAlign:'center'}}>SIZE</span><span style={{textAlign:'right'}}>TIME</span>
                </div>
                {trades.map(tr=>(
                  <div key={tr.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'3px 12px',fontSize:10,fontFamily:'monospace',borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                    <span style={{color:tr.side==='buy'?'#00e676':'#f43f5e',fontWeight:700}}>{fmtPrice(tr.price)}</span>
                    <span style={{textAlign:'center',color:'#8888aa'}}>{tr.qty}</span>
                    <span style={{textAlign:'right',color:'#44446a',fontSize:9}}>{new Date(tr.ts).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FAR RIGHT: Order Form */}
        <div style={{width:240,flexShrink:0,borderLeft:'1px solid #1a1a2e',display:'flex',flexDirection:'column',background:'#0b0b16',padding:'0 0 8px'}}>
          {/* Market / Limit tabs */}
          <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',marginBottom:14}}>
            {(['MARKET','LIMIT'] as OrderType[]).map(t=>(
              <button key={t} onClick={()=>setOtype(t)}
                style={{flex:1,padding:'9px 0',border:'none',background:'transparent',fontSize:9,fontWeight:900,cursor:'pointer',color:otype===t?'#fff':'#44446a',borderBottom:otype===t?'2px solid #f97316':'2px solid transparent'}}>
                {t}
              </button>
            ))}
          </div>

          <div style={{padding:'0 12px',display:'flex',flexDirection:'column',gap:12,flex:1}}>
            {/* Buy / Sell */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              <button onClick={()=>setSide('BUY')} style={{padding:'9px',borderRadius:8,border:`1px solid ${side==='BUY'?'#00e676':'#1e1e3a'}`,background:side==='BUY'?'rgba(0,230,118,0.12)':'transparent',color:side==='BUY'?'#00e676':'#44446a',fontSize:11,fontWeight:900,cursor:'pointer'}}>BUY</button>
              <button onClick={()=>setSide('SELL')} style={{padding:'9px',borderRadius:8,border:`1px solid ${side==='SELL'?'#f43f5e':'#1e1e3a'}`,background:side==='SELL'?'rgba(244,63,94,0.12)':'transparent',color:side==='SELL'?'#f43f5e':'#44446a',fontSize:11,fontWeight:900,cursor:'pointer'}}>SELL</button>
            </div>

            <div style={{fontSize:9,color:'#44446a',fontWeight:700}}>Available: <span style={{color:'#8888aa'}}>0.00 USDC</span></div>

            {/* Limit price */}
            {otype==='LIMIT' && (
              <div>
                <label style={{fontSize:8,color:'#44446a',fontWeight:800,display:'block',marginBottom:4,letterSpacing:'.1em'}}>LIMIT PRICE</label>
                <input value={limitP} onChange={e=>setLimitP(e.target.value)}
                  style={{width:'100%',background:'rgba(255,255,255,0.03)',border:'1px solid #1e1e3a',borderRadius:7,padding:'7px 10px',color:'#fff',fontSize:12,outline:'none',boxSizing:'border-box'}}/>
              </div>
            )}

            {/* Amount */}
            <div>
              <label style={{fontSize:8,color:'#44446a',fontWeight:800,display:'block',marginBottom:4,letterSpacing:'.1em'}}>AMOUNT ({selected?.base??'BTC'})</label>
              <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.0000"
                style={{width:'100%',background:'rgba(255,255,255,0.03)',border:'1px solid #1e1e3a',borderRadius:7,padding:'7px 10px',color:'#fff',fontSize:12,outline:'none',boxSizing:'border-box'}}/>
            </div>

            {/* Slider */}
            <div>
              <input type="range" min={0} max={100} value={sliderPct} onChange={e=>setSliderPct(+e.target.value)}
                style={{width:'100%',accentColor:sC,cursor:'pointer'}}/>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                {[0,25,50,75,100].map(p=>(
                  <button key={p} onClick={()=>setSliderPct(p)}
                    style={{fontSize:8,padding:'2px 5px',borderRadius:4,border:`1px solid ${sliderPct===p?sC:'#1e1e3a'}`,background:sliderPct===p?`${sC}15`:'transparent',color:sliderPct===p?sC:'#44446a',cursor:'pointer',fontWeight:800}}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Order summary */}
            {(qty>0||sliderPct>0) && (
              <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid #1e1e3a',borderRadius:8,padding:'8px 10px',display:'flex',flexDirection:'column',gap:4}}>
                {[['Order Value',`$${orderVal} USDC`],['Fee',`${fee} USDC`]].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:9,fontFamily:'monospace'}}>
                    <span style={{color:'#44446a'}}>{l}</span><span style={{color:'#8888aa',fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{flex:1}}/>

            {/* Place order */}
            <motion.button whileTap={{scale:0.97}} onClick={placeOrder}
              style={{width:'100%',padding:'11px',borderRadius:10,border:'none',fontSize:12,fontWeight:900,cursor:'pointer',
                background:submitted?'linear-gradient(135deg,#00e676,#00c853)':side==='BUY'?'linear-gradient(135deg,#00e676,#00c853)':'linear-gradient(135deg,#f43f5e,#be123c)',
                color:side==='BUY'?'#000':'#fff',boxShadow:side==='BUY'?'0 6px 20px rgba(0,230,118,0.25)':'0 6px 20px rgba(244,63,94,0.25)'}}>
              {submitted?'✓ ORDER PLACED':wallet?`PLACE ${side} ORDER`:'CONNECT WALLET'}
            </motion.button>

            {!wallet && (
              <p style={{fontSize:9,color:'#2a2a4a',textAlign:'center',margin:0,lineHeight:1.5}}>
                EIP-1193 secure · SoDEX {network}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
