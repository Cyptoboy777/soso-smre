'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/FirebaseProvider';
import type { WalletProvider } from '@/lib/walletConnectors';

const FEATURES = [
  { step: '01', label: 'DISCOVERY', color: '#38bdf8', rgb: '56,189,248', title: 'Data Ingestion', desc: 'Real-time WebSocket connection to SoSoValue data. Aggregating on-chain metrics and funding rates.' },
  { step: '02', label: 'TELEGRAM', color: '#f97316', rgb: '249,115,22', title: 'Daily Alpha Alerts', desc: 'Gemini AI analyzes top gainers and breaking news to send personalized "Today\'s Alpha" directly to your Telegram.' },
  { step: '03', label: 'ANALYSIS', color: '#a855f7', rgb: '168,85,247', title: 'Dual-AI Signals', desc: 'Groq LLaMA-3 handles lightning-fast momentum checks, while Gemini 2.5 Flash computes deep sentiment reasoning.' },
  { step: '04', label: 'EXECUTION', color: '#00e676', rgb: '0,230,118', title: 'Auto Trading Bot', desc: 'AI-powered trading bot fires paper-trade payloads based on Entry/SL zones with real-time SoDEX market data.' },
];

// ── Wallet Picker Modal ──────────────────────────────────────────────────────
function WalletPicker({ wallets, onSelect, onClose, loading }: {
  wallets: WalletProvider[];
  onSelect: (id: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '32px 28px', width: 360, boxShadow: '0 32px 80px rgba(0,0,0,0.8)', position: 'relative' }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Connect Wallet</h2>
          <p style={{ color: '#475569', fontSize: 12, margin: '6px 0 0' }}>Choose from your installed extensions</p>
        </div>

        {wallets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>No wallet extension detected.<br />Install MetaMask, Rabby, OKX Wallet, or any EVM extension.</p>
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', background: 'linear-gradient(135deg,#f97316,#ea580c)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
              Install MetaMask →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wallets.map(w => (
              <button
                key={w.id}
                onClick={() => onSelect(w.id)}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff', textAlign: 'left', transition: 'all 0.2s',
                  opacity: loading ? 0.6 : 1,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(56,189,248,0.08)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(56,189,248,0.3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{w.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{w.name}</div>
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 2 }}>Detected — click to connect</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 14, color: '#334155' }}>→</span>
              </button>
            ))}
          </div>
        )}

        <p style={{ fontSize: 9, color: '#1e293b', textAlign: 'center', marginTop: 20, letterSpacing: '.1em' }}>
          SIGN-IN WITH ETHEREUM · NO FUNDS MOVE · READ-ONLY AUTH
        </p>
      </div>
    </div>
  );
}

// ── Main Login Page ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const { user, walletAddress, availableWallets, refreshWallets, signIn, connectWallet, loading, configured } = useAuth();
  const [isSigningIn,   setIsSigningIn]   = useState(false);
  const [error,         setError]         = useState('');
  const [active,        setActive]        = useState(0);
  const [showPicker,    setShowPicker]    = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && (user || walletAddress)) router.replace('/');
  }, [loading, router, user, walletAddress]);

  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % FEATURES.length), 2800);
    return () => clearInterval(t);
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true); setError('');
    try {
      if (!configured) throw new Error('Firebase not set up');
      await signIn();
      router.replace('/');
    } catch { setError('Google sign-in failed. Check Firebase config.'); }
    finally { setIsSigningIn(false); }
  };

  const handleWalletButtonClick = () => {
    refreshWallets();
    setShowPicker(true);
    setError('');
  };

  const handleWalletSelect = async (walletId: string) => {
    setIsSigningIn(true); setError('');
    try {
      await connectWallet(walletId);
      setShowPicker(false);
    } catch {
      setError('Wallet connection rejected. Please try again.');
    } finally { setIsSigningIn(false); }
  };

  if (loading || user || walletAddress) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: 32, height: 32, border: '2px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  const cur = FEATURES[active];

  return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'stretch', overflow: 'hidden', fontFamily: 'system-ui,sans-serif' }}>
      <style dangerouslySetInnerHTML={{__html:`
        @keyframes beamMove {
          0%   { transform: translateY(0);   opacity:0; }
          8%   { opacity:1; }
          92%  { opacity:1; }
          100% { transform: translateY(var(--track-h,300px)); opacity:0; }
        }
        @keyframes ringPop {
          0%   { transform:translate(-50%,-50%) scale(0.6); opacity:0; }
          60%  { transform:translate(-50%,-50%) scale(1.15); opacity:1; }
          100% { transform:translate(-50%,-50%) scale(1);    opacity:1; }
        }
        @keyframes cardSlide {
          0%   { opacity:0; transform:translateX(32px); }
          100% { opacity:1; transform:translateX(0); }
        }
        @keyframes particleDrift {
          0%   { transform:translateY(0) translateX(0); opacity:0.6; }
          100% { transform:translateY(-120px) translateX(20px); opacity:0; }
        }
        @keyframes shimmer {
          0%  { background-position: -400px 0; }
          100%{ background-position:  400px 0; }
        }
        @keyframes pulse {
          0%,100% { opacity:0.3; transform:scale(1); }
          50%      { opacity:0.7; transform:scale(1.06); }
        }
        .login-btn-google:hover { background:rgba(255,255,255,0.09)!important; }
        .login-btn-wallet:hover { transform:translateY(-3px); box-shadow:0 16px 40px rgba(56,189,248,0.45)!important; }
        @media(max-width:860px){ .left-panel{ display:none!important; } }
      `}} />

      {/* ── Wallet Picker Modal ── */}
      {showPicker && (
        <WalletPicker
          wallets={availableWallets}
          onSelect={handleWalletSelect}
          onClose={() => setShowPicker(false)}
          loading={isSigningIn}
        />
      )}

      {/* ── LEFT PANEL ── */}
      <div className="left-panel" style={{ flex:1, position:'relative', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 40px', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(56,189,248,0.07) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 20% 80%, rgba(168,85,247,0.06) 0%, transparent 60%)', pointerEvents:'none' }} />
        {[...Array(18)].map((_,i) => (
          <div key={i} style={{ position:'absolute', left:`${10+i*5}%`, bottom:`${10+(i%5)*15}%`, width: i%3===0?3:2, height: i%3===0?3:2, borderRadius:'50%', background: i%4===0?'#38bdf8':i%4===1?'#a855f7':i%4===2?'#f97316':'#00e676', opacity:0.4, animation:`particleDrift ${4+i*0.4}s ${i*0.3}s ease-in-out infinite alternate`, pointerEvents:'none' }} />
        ))}
        <div style={{ textAlign:'center', marginBottom:56, zIndex:1 }}>
          <div style={{ fontSize:11, letterSpacing:'.3em', color:'#475569', fontWeight:800, marginBottom:16 }}>SOSOVALUE BUILDATHON</div>
          <h1 style={{ fontSize:42, fontWeight:900, color:'#fff', letterSpacing:'-0.04em', lineHeight:1, margin:0 }}>
            One Platform.<br/>
            <span style={{ background:'linear-gradient(90deg,#38bdf8,#a855f7,#f97316)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Infinite Alpha.</span>
          </h1>
          <p style={{ color:'#475569', fontSize:14, marginTop:16, fontWeight:500 }}>The journey from news to profit — automated.</p>
        </div>
        <div style={{ position:'relative', display:'flex', flexDirection:'column', gap:0, zIndex:1 }}>
          <div style={{ position:'absolute', left:19, top:20, bottom:20, width:2, background:'rgba(255,255,255,0.06)', borderRadius:2 }}>
            <div style={{ position:'absolute', left:-2, top:0, width:6, height:60, background:`linear-gradient(to bottom, transparent, ${cur.color}, #fff)`, borderRadius:4, boxShadow:`0 0 16px ${cur.color}, 0 0 32px ${cur.color}`, animation:`beamMove 2.8s ease-in-out infinite`, '--track-h': `${(FEATURES.length - 1) * 88}px` } as React.CSSProperties} />
          </div>
          {FEATURES.map((f, i) => {
            const isActive = i === active;
            return (
              <div key={f.step} onClick={() => setActive(i)} style={{ display:'flex', alignItems:'center', gap:24, padding:'10px 0', cursor:'pointer', height:88 }}>
                <div style={{ position:'relative', width:40, height:40, flexShrink:0 }}>
                  <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width: isActive ? 40 : 28, height: isActive ? 40 : 28, borderRadius:'50%', background: isActive ? f.color : 'transparent', border:`2px solid ${isActive ? f.color : 'rgba(255,255,255,0.1)'}`, boxShadow: isActive ? `0 0 24px ${f.color}, 0 0 48px ${f.color}55` : 'none', transition:'all 0.5s cubic-bezier(0.16,1,0.3,1)', animation: isActive ? 'ringPop 0.4s ease-out' : 'none', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {isActive && <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
                  </div>
                </div>
                <div style={{ flex:1, background: isActive ? `linear-gradient(135deg, rgba(${f.rgb},0.12), rgba(${f.rgb},0.03))` : 'rgba(255,255,255,0.02)', border:`1px solid ${isActive ? f.color+'44' : 'rgba(255,255,255,0.04)'}`, borderRadius:16, padding:'16px 20px', transition:'all 0.5s cubic-bezier(0.16,1,0.3,1)', boxShadow: isActive ? `0 8px 32px rgba(${f.rgb},0.15)` : 'none', animation: isActive ? 'cardSlide 0.4s ease-out' : 'none', maxWidth:380 }}>
                  <div style={{ fontSize:9, color:f.color, fontWeight:900, letterSpacing:'.25em', marginBottom:4 }}>{f.step} / {f.label}</div>
                  <div style={{ fontSize:isActive?16:13, fontWeight: isActive?700:500, color: isActive?'#fff':'#475569', transition:'all 0.4s', marginBottom: isActive?6:0 }}>{f.title}</div>
                  {isActive && <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.65, maxWidth:340 }}>{f.desc}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex', gap:6, marginTop:40, zIndex:1 }}>
          {FEATURES.map((f,i) => (
            <div key={i} style={{ height:3, borderRadius:2, transition:'all 0.4s', background: i===active ? f.color : 'rgba(255,255,255,0.1)', width: i===active ? 28 : 12 }} />
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, maxWidth: 460, minWidth: 320, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', background: 'rgba(8,10,16,0.8)', borderLeft: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(40px)', position: 'relative', zIndex: 10 }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg, transparent, #38bdf8, #a855f7, transparent)', backgroundSize:'400px 2px', animation:'shimmer 3s linear infinite' }} />

        <div style={{ textAlign:'center', marginBottom: 48 }}>
          <div style={{ position:'relative', display:'inline-block', margin:'0 auto 8px' }}>
            <div style={{ position:'absolute', inset:-8, borderRadius:28, border:'1px solid rgba(56,189,248,0.2)', animation:'pulse 3s ease-in-out infinite', pointerEvents:'none' }} />
            <div style={{ position:'absolute', inset:-16, borderRadius:34, border:'1px solid rgba(168,85,247,0.12)', animation:'pulse 3s ease-in-out infinite 1.2s', pointerEvents:'none' }} />
            <div style={{ background:'linear-gradient(135deg, rgba(56,189,248,0.1), rgba(168,85,247,0.1))', borderRadius:22, border:'1px solid rgba(255,255,255,0.07)', boxShadow:'0 0 60px rgba(56,189,248,0.15)', padding:14, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px),linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)', backgroundSize:'12px 12px' }} />
              <Logo mode="full" style={{ width: 52, height: 52, position:'relative', zIndex:1 }} />
            </div>
          </div>
          <p style={{ color:'#334155', fontSize:11, marginTop:16, fontWeight:600, letterSpacing:'0.08em' }}>ELITE AI-AGENT RESEARCH INFRASTRUCTURE</p>
        </div>

        {error && (
          <div style={{ background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', color:'#fda4af', borderRadius:10, padding:'12px 16px', fontSize:12, marginBottom:24 }}>{error}</div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Google */}
          <button className="login-btn-google" onClick={handleSignIn} disabled={isSigningIn}
            style={{ width:'100%', minHeight:52, borderRadius:12, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'#fff', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:12, fontSize:14, transition:'background 0.2s' }}>
            <svg style={{ width:18, height:18 }} viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isSigningIn ? 'Connecting...' : 'Continue with Google'}
          </button>

          {/* Wallet — shows picker */}
          <button className="login-btn-wallet" onClick={handleWalletButtonClick} disabled={isSigningIn}
            style={{ width:'100%', minHeight:52, borderRadius:12, border:'none', background:'linear-gradient(135deg, #0ea5e9, #2563eb)', color:'#fff', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:12, fontSize:14, boxShadow:'0 8px 24px rgba(56,189,248,0.25)', transition:'all 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
            <span style={{ fontSize: 20 }}>🔐</span>
            Connect Web3 Wallet
            {availableWallets.length > 0 && (
              <span style={{ marginLeft: 4, fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 99, fontWeight: 900 }}>
                {availableWallets.length} detected
              </span>
            )}
          </button>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'32px 0' }}>
          <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize:9, color:'#334155', fontWeight:800, letterSpacing:'.15em' }}>SECURED</span>
          <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Wallet badges — dynamically show detected wallets */}
        {availableWallets.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
            {availableWallets.map(w => (
              <button key={w.id} onClick={() => { setShowPicker(true); }} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:99, background:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.2)', color:'#38bdf8', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                <span>{w.icon}</span> {w.name}
              </button>
            ))}
          </div>
        )}

        {/* Trust badges */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[['🔐','EIP-712 Sign-In'],['⚡','Any EVM Wallet'],['🤖','Gemini + Groq AI'],['🔒','Firebase Auth']].map(([icon,label]) => (
            <div key={label as string} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:14 }}>{icon}</span>
              <span style={{ fontSize:10, color:'#475569', fontWeight:700 }}>{label}</span>
            </div>
          ))}
        </div>

        <p style={{ color:'#1e293b', fontSize:8, textAlign:'center', fontFamily:'monospace', letterSpacing:'.15em', marginTop:32, lineHeight:1.6 }}>
          SOSOVALUE BUILDATHON · WAVE 2 · ALL TRADES SIMULATED
        </p>
      </div>
    </div>
  );
}
