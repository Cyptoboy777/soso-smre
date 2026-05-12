'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/FirebaseProvider';

const FEATURES = [
  { step: '01', label: 'DISCOVERY', color: '#38bdf8', rgb: '56,189,248', title: 'Data Ingestion', desc: 'Real-time WebSocket connection to SoSoValue data. Aggregating on-chain metrics and funding rates.' },
  { step: '02', label: 'TELEGRAM', color: '#f97316', rgb: '249,115,22', title: 'Daily Alpha Alerts', desc: 'Gemini AI analyzes top gainers and breaking news to send personalized "Today\'s Alpha" directly to your Telegram.' },
  { step: '03', label: 'ANALYSIS', color: '#a855f7', rgb: '168,85,247', title: 'Dual-AI Signals', desc: 'Groq LLaMA-3 handles lightning-fast momentum checks, while Gemini 2.5 Flash computes deep sentiment reasoning.' },
  { step: '04', label: 'EXECUTION', color: '#00e676', rgb: '0,230,118', title: 'Automated Bot', desc: 'SoDoggy Assistant automatically fires paper-trade payloads based on calculated Entry and Stop-Loss zones.' },
];

export default function LoginPage() {
  const { user, walletAddress, signIn, connectWallet, loading, configured } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!loading && (user || walletAddress)) router.replace('/');
  }, [loading, router, user, walletAddress]);

  // Cycle through features like a flight making stops
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % FEATURES.length), 2800);
    return () => clearInterval(t);
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true); setError('');
    try { if (!configured) throw new Error(); await signIn(); router.replace('/'); }
    catch { setError('Google sign-in failed'); }
    finally { setIsSigningIn(false); }
  };

  const handleConnectWallet = async () => {
    setIsSigningIn(true); setError('');
    try { await connectWallet(); }
    catch { setError('Wallet connection failed'); }
    finally { setIsSigningIn(false); }
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
        .login-btn-google:hover { background:rgba(255,255,255,0.09)!important; }
        .login-btn-wallet:hover { transform:translateY(-3px); box-shadow:0 16px 40px rgba(56,189,248,0.45)!important; }
        @media(max-width:860px){ .left-panel{ display:none!important; } }
      `}} />

      {/* ── LEFT PANEL: Flight Journey ── */}
      <div className="left-panel" style={{ flex:1, position:'relative', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 40px', overflow:'hidden' }}>

        {/* Deep space background */}
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(56,189,248,0.07) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 20% 80%, rgba(168,85,247,0.06) 0%, transparent 60%)', pointerEvents:'none' }} />

        {/* Floating particles */}
        {[...Array(18)].map((_,i) => (
          <div key={i} style={{ position:'absolute', left:`${10+i*5}%`, bottom:`${10+(i%5)*15}%`, width: i%3===0?3:2, height: i%3===0?3:2, borderRadius:'50%', background: i%4===0?'#38bdf8':i%4===1?'#a855f7':i%4===2?'#f97316':'#00e676', opacity:0.4, animation:`particleDrift ${4+i*0.4}s ${i*0.3}s ease-in-out infinite alternate`, pointerEvents:'none' }} />
        ))}

        {/* Header branding */}
        <div style={{ textAlign:'center', marginBottom:56, zIndex:1 }}>
          <div style={{ fontSize:11, letterSpacing:'.3em', color:'#475569', fontWeight:800, marginBottom:16 }}>SOSOVALUE BUILDATHON</div>
          <h1 style={{ fontSize:42, fontWeight:900, color:'#fff', letterSpacing:'-0.04em', lineHeight:1, margin:0 }}>
            One Platform.<br/>
            <span style={{ background:'linear-gradient(90deg,#38bdf8,#a855f7,#f97316)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Infinite Alpha.
            </span>
          </h1>
          <p style={{ color:'#475569', fontSize:14, marginTop:16, fontWeight:500 }}>The journey from news to profit — automated.</p>
        </div>

        {/* Flight track + nodes */}
        <div style={{ position:'relative', display:'flex', flexDirection:'column', gap:0, zIndex:1 }}>

          {/* Vertical track line */}
          <div style={{ position:'absolute', left:19, top:20, bottom:20, width:2, background:'rgba(255,255,255,0.06)', borderRadius:2 }}>
            {/* Animated beam */}
            <div style={{
              position:'absolute', left:-2, top:0, width:6, height:60,
              background:`linear-gradient(to bottom, transparent, ${cur.color}, #fff)`,
              borderRadius:4,
              boxShadow:`0 0 16px ${cur.color}, 0 0 32px ${cur.color}`,
              animation:`beamMove 2.8s ease-in-out infinite`,
              '--track-h': `${(FEATURES.length - 1) * 88}px`,
            } as React.CSSProperties} />
          </div>

          {FEATURES.map((f, i) => {
            const isActive = i === active;
            return (
              <div key={f.step} onClick={() => setActive(i)} style={{ display:'flex', alignItems:'center', gap:24, padding:'10px 0', cursor:'pointer', height:88 }}>
                {/* Node dot */}
                <div style={{ position:'relative', width:40, height:40, flexShrink:0 }}>
                  <div style={{
                    position:'absolute', top:'50%', left:'50%',
                    transform:'translate(-50%,-50%)',
                    width: isActive ? 40 : 28,
                    height: isActive ? 40 : 28,
                    borderRadius:'50%',
                    background: isActive ? f.color : 'transparent',
                    border:`2px solid ${isActive ? f.color : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isActive ? `0 0 24px ${f.color}, 0 0 48px ${f.color}55` : 'none',
                    transition:'all 0.5s cubic-bezier(0.16,1,0.3,1)',
                    animation: isActive ? 'ringPop 0.4s ease-out' : 'none',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {isActive && <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
                  </div>
                </div>

                {/* Card */}
                <div style={{
                  flex:1,
                  background: isActive
                    ? `linear-gradient(135deg, rgba(${f.rgb},0.12), rgba(${f.rgb},0.03))`
                    : 'rgba(255,255,255,0.02)',
                  border:`1px solid ${isActive ? f.color+'44' : 'rgba(255,255,255,0.04)'}`,
                  borderRadius:16,
                  padding:'16px 20px',
                  transition:'all 0.5s cubic-bezier(0.16,1,0.3,1)',
                  boxShadow: isActive ? `0 8px 32px rgba(${f.rgb},0.15)` : 'none',
                  animation: isActive ? 'cardSlide 0.4s ease-out' : 'none',
                  maxWidth:380,
                }}>
                  <div style={{ fontSize:9, color:f.color, fontWeight:900, letterSpacing:'.25em', marginBottom:4 }}>{f.step} / {f.label}</div>
                  <div style={{ fontSize:isActive?16:13, fontWeight: isActive?700:500, color: isActive?'#fff':'#475569', transition:'all 0.4s', marginBottom: isActive?6:0 }}>{f.title}</div>
                  {isActive && (
                    <div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.65, maxWidth:340 }}>{f.desc}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ display:'flex', gap:6, marginTop:40, zIndex:1 }}>
          {FEATURES.map((f,i) => (
            <div key={i} style={{ height:3, borderRadius:2, transition:'all 0.4s', background: i===active ? f.color : 'rgba(255,255,255,0.1)', width: i===active ? 28 : 12 }} />
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL: Login ── */}
      <div style={{ flex: 1, maxWidth: 460, minWidth: 320, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', background: 'rgba(8,10,16,0.8)', borderLeft: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(40px)', position: 'relative', zIndex: 10 }}>

        {/* Top shimmer line */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg, transparent, #38bdf8, #a855f7, transparent)', backgroundSize:'400px 2px', animation:'shimmer 3s linear infinite' }} />

        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ width:72, height:72, background:'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(168,85,247,0.15))', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 0 40px rgba(56,189,248,0.15)' }}>
            <Logo style={{ width:40, height:40 }} />
          </div>
          <h2 style={{ color:'#fff', fontSize:28, fontWeight:800, letterSpacing:'-0.04em', margin:0, lineHeight:1 }}>SoSo SMRE</h2>
          <p style={{ color:'#475569', fontSize:13, marginTop:10, fontWeight:500 }}>Elite AI-Agent Research Infrastructure</p>
        </div>

        {error && (
          <div style={{ background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', color:'#fda4af', borderRadius:10, padding:'12px 16px', fontSize:12, marginBottom:24 }}>{error}</div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
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

          <button className="login-btn-wallet" onClick={handleConnectWallet} disabled={isSigningIn}
            style={{ width:'100%', minHeight:52, borderRadius:12, border:'none', background:'linear-gradient(135deg, #0ea5e9, #2563eb)', color:'#fff', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:12, fontSize:14, boxShadow:'0 8px 24px rgba(56,189,248,0.25)', transition:'all 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
            {isSigningIn ? 'Syncing...' : 'Connect SoDEX Wallet'}
          </button>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'32px 0' }}>
          <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize:9, color:'#334155', fontWeight:800, letterSpacing:'.15em' }}>SECURED</span>
          <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Trust badges */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[['🔐','EIP-712 Protocol'],['⚡','SoDEX L1 Chain'],['🤖','Gemini + Groq AI'],['🔒','Firebase Auth']].map(([icon,label]) => (
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
