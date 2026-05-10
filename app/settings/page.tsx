'use client';
import { useState, useEffect } from 'react';
import { Bell, Shield, Bot, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/FirebaseProvider';

export default function SettingsPage() {
  const { user } = useAuth();
  const [chatId, setChatId] = useState('');
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [botActive, setBotActive] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('tg_chat_id');
    if (saved) {
      setChatId(saved);
      setTelegramConnected(true);
    }
  }, []);

  const testConnection = async () => {
    if (!chatId.trim()) {
      setStatus('Please enter a valid Chat ID');
      return;
    }
    setLoading(true);
    setStatus('Sending test message...');
    
    try {
      const r = await fetch('/api/telegram-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId, 
          message: `<b>✅ Connection Verified!</b>\n\nHello ${user?.displayName || 'Trader'},\nYour SoSo SMRE account is now linked to this Telegram bot. You will receive real-time AI signals here.\n\n<i>System: Intelligence Terminal Active</i>` 
        }),
      });
      const d = await r.json();
      if (d.success) {
        setTelegramConnected(true);
        localStorage.setItem('tg_chat_id', chatId);
        setStatus('Message Sent! Please check your Telegram.');
      } else {
        setStatus(`Error: ${d.error}`);
      }
    } catch (e) {
      setStatus('Failed to connect to Telegram API');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 32, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Platform Protocols</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* 5. Telegram Alerts */}
        <div className="neon-border glass" style={{ padding: 28, borderRadius: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={24} color="var(--accent-blue)" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>TELEGRAM NOTIFICATIONS</h3>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Real-time AI signals & critical trade alerts.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.05)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.1)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
               <b>How to get your Chat ID:</b><br/>
               1. Start the bot: <a href="https://t.me/sodexAI_bot" target="_blank" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>@sodexAI_bot</a><br/>
               2. Send <code>/id</code> to the bot or use <a href="https://t.me/userinfobot" target="_blank" style={{ color: 'var(--accent-blue)' }}>@userinfobot</a> to find your ID.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <input 
                value={chatId}
                onChange={e => setChatId(e.target.value)}
                placeholder="Enter your Telegram Chat ID"
                style={{ flex: 1, padding: '12px 16px', borderRadius: 12, background: 'var(--bg-main)', border: '1px solid var(--border-bold)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
              />
              <button 
                onClick={testConnection}
                disabled={loading}
                style={{ padding: '0 24px', borderRadius: 12, background: 'var(--accent-blue)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              >
                {loading ? <Loader2 size={16} className="spin" /> : 'VERIFY & TEST'}
              </button>
            </div>

            {status && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: status.includes('Sent') ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {status.includes('Sent') ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {status}
              </div>
            )}
          </div>
        </div>

        {/* 2. AI Auto-Trader (Bot) */}
        <div className="neon-border glass" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={20} color="var(--accent-orange)" />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>AI Auto-Trader (Beta)</h3>
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Automatically execute trades based on AI confidence scores.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div 
              onClick={() => setBotActive(!botActive)}
              style={{ 
                width: 50, height: 26, borderRadius: 13, background: botActive ? 'var(--accent-green)' : 'var(--bg-main)', 
                border: '1px solid var(--border-bold)', position: 'relative', cursor: 'pointer', transition: '0.3s' 
              }}
            >
              <div style={{ 
                width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', 
                top: 2, left: botActive ? 26 : 2, transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' 
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: botActive ? 'var(--accent-green)' : 'var(--text-dim)' }}>
              {botActive ? 'ACTIVE - WATCHING MARKETS' : 'INACTIVE'}
            </span>
          </div>

          {botActive && (
             <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 10 }}>BOT PARAMETERS</div>
                <div style={{ display: 'flex', gap: 20 }}>
                   <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800 }}>MAX POSITION</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>500 USDC</div>
                   </div>
                   <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 800 }}>CONFIDENCE THRESHOLD</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>85%</div>
                   </div>
                </div>
             </div>
          )}
        </div>

        {/* Security / API */}
        <div className="neon-border glass" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
             <Shield size={20} color="var(--accent-green)" />
             <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Security Protocols</h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            All trades are currently executed in the Simulation Environment. Real wallet execution requires multi-sig approval.
          </p>
        </div>

      </div>
    </div>
  );
}
