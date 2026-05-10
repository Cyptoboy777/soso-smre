'use client';
import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Send, X, MessageSquare, LineChart, Newspaper } from 'lucide-react';

export default function DogAssistant() {
  const [msg, setMsg] = useState("Woof! I'm SoDoggy, your Cyber-Analyst assistant. Systems online!");
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{role: 'dog' | 'user', text: string}>>([
    { role: 'dog', text: "Woof! I am SoDoggy 🐕. I analyze millions of data points to help you trade like a pro. How can I help you today?" }
  ]);
  const [muted, setMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [emotion, setEmotion] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  // Real Dog Sounds
  const playWoof = () => {
    if (muted) return;
    try {
      const sounds = [
        'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Loud bark
        'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3', // Small bark
        'https://assets.mixkit.co/active_storage/sfx/112/112-preview.mp3'    // Panting/excited
      ];
      const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
      const audio = new Audio(randomSound);
      audio.volume = 0.4;
      audio.play();
    } catch (e) {}
  };

  const speak = (text: string) => {
    if (muted || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    // Play real bark first
    playWoof();
    setIsSpeaking(true);

    // Random Emotion
    const emojis = ['⚡', '🔥', '🚀', '👀', '🧠', '💸', '🐕'];
    setEmotion(emojis[Math.floor(Math.random() * emojis.length)]);

    // Filter out dog sound keywords so the AI voice doesn't read them
    const filteredText = text.replace(/(Woof|Bork|Boww|Bark|Arf|Yip)/gi, '').trim();
    
    const utterance = new SpeechSynthesisUtterance(filteredText.replace(/[*_#]/g, ''));
    utterance.rate = 1.1;
    utterance.pitch = 1.3;
    
    utterance.onend = () => { setIsSpeaking(false); setEmotion(null); };
    utterance.onerror = () => { setIsSpeaking(false); setEmotion(null); };
    
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      // Fetch context
      const [pricesRes, newsRes] = await Promise.all([
        fetch('/api/prices').then(r => r.json()),
        fetch('/api/news').then(r => r.json())
      ]);

      const res = await fetch('/api/dog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg, 
          prices: pricesRes, 
          news: newsRes?.news?.slice(0, 5) 
        }),
      });
      const data = await res.json();
      setHistory(prev => [...prev, { role: 'dog', text: data.reply }]);
      playWoof();
      speak(data.reply);
    } catch (e) {
      setHistory(prev => [...prev, { role: 'dog', text: "Woof! Something went wrong with my neural link. Try again later!" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
      
      {/* Chat Window */}
      {chatOpen && (
        <div className="fade-up" style={{ 
          width: 320, 
          height: 450, 
          background: 'rgba(10, 10, 10, 0.95)', 
          border: '1px solid #333', 
          borderRadius: 20, 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
          marginBottom: 10
        }}>
          {/* Header */}
          <div style={{ padding: '16px', background: 'linear-gradient(90deg, #f59e0b20, transparent)', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
               <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 10px #00e676' }} />
               <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.05em' }}>SODOGGY ANALYST</span>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={18} /></button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {history.map((h, i) => (
              <div key={i} style={{ alignSelf: h.role === 'dog' ? 'flex-start' : 'flex-end', maxWidth: '85%' }}>
                <div style={{ 
                  background: h.role === 'dog' ? '#1a1a1a' : '#f59e0b', 
                  color: h.role === 'dog' ? '#eee' : '#000', 
                  padding: '10px 14px', 
                  borderRadius: h.role === 'dog' ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontWeight: h.role === 'dog' ? 400 : 600,
                  border: h.role === 'dog' ? '1px solid #333' : 'none'
                }}>
                  {h.text}
                </div>
              </div>
            ))}
            {loading && (
               <div style={{ alignSelf: 'flex-start', background: '#1a1a1a', padding: '10px 14px', borderRadius: '16px 16px 16px 4px', border: '1px solid #333' }}>
                 <div style={{ display: 'flex', gap: 4 }}>
                   <div className="bounce-1" style={{ width: 4, height: 4, background: '#f59e0b', borderRadius: '50%' }} />
                   <div className="bounce-2" style={{ width: 4, height: 4, background: '#f59e0b', borderRadius: '50%' }} />
                   <div className="bounce-3" style={{ width: 4, height: 4, background: '#f59e0b', borderRadius: '50%' }} />
                 </div>
               </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: 16, borderTop: '1px solid #222', display: 'flex', gap: 10 }}>
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about BTC news..." 
              style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none' }} 
            />
            <button onClick={handleSend} style={{ background: '#f59e0b', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Send size={16} color="#000" />
            </button>
          </div>
        </div>
      )}

      {/* Dog Avatar Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
         {!chatOpen && (
           <div className="fade-up" style={{ background: 'rgba(10,10,10,0.8)', border: '1px solid #333', padding: '8px 12px', borderRadius: 12, fontSize: 11, color: '#f59e0b', fontWeight: 700, backdropFilter: 'blur(10px)' }}>
             Woof! Hi, I'm SoDoggy!
           </div>
         )}
         <div 
          onClick={() => { setChatOpen(!chatOpen); if (!chatOpen) playWoof(); }}
          className={isSpeaking ? 'cybonk-talk' : 'cybonk-float'}
          style={{ 
            width: 80, 
            height: 80, 
            background: `url('/cybonk_dog.png') center/cover no-repeat`,
            backgroundColor: '#050505',
            borderRadius: '50%', 
            border: '2px solid #f59e0b',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.4), inset 0 0 15px rgba(245, 158, 11, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
            position: 'relative'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)';
            e.currentTarget.style.boxShadow = '0 0 40px rgba(245, 158, 11, 0.6)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.4)';
          }}
        >
          {/* HUD Decorative Circles */}
          <div style={{ position: 'absolute', inset: -8, border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: '50%', animation: 'spin 10s linear infinite' }} />
          <div style={{ position: 'absolute', inset: -15, border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '50%', borderTopColor: '#3b82f6', animation: 'spin 4s linear infinite reverse' }} />
          
          <img 
            src="/cybonk_dog.png" 
            alt="SoDoggy" 
            className="cybonk-glitch"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
            onError={(e) => { 
              e.currentTarget.style.display='none'; 
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const emoji = document.createElement('div');
                emoji.innerText = '🐕';
                emoji.style.fontSize = '36px';
                parent.appendChild(emoji);
              }
            }} 
          />

          {/* Floating Emotion Emoji */}
          {emotion && (
            <div className="fade-up" style={{
              position: 'absolute',
              top: -15,
              right: -10,
              fontSize: 24,
              background: 'rgba(0,0,0,0.6)',
              borderRadius: '50%',
              padding: 4,
              boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)',
              animation: 'bounce-1 1s infinite alternate'
            }}>
              {emotion}
            </div>
          )}
        </div>
      </div>

      <button onClick={() => setMuted(!muted)} style={{ position: 'absolute', top: -30, right: 0, background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}>
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  );
}
