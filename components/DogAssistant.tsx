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
  const [isWaving, setIsWaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Idle Animation: Wave every 30 seconds
  useEffect(() => {
    const id = setInterval(() => {
      if (!chatOpen && !isSpeaking) {
        setIsWaving(true);
        setTimeout(() => setIsWaving(false), 3000); // Wave for 3s
      }
    }, 30000);
    return () => clearInterval(id);
  }, [chatOpen, isSpeaking]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  // Scooby-Style Barking & Effects
  const playWoof = () => {
    if (muted) return;
    try {
      const sounds = [
        'https://www.myinstants.com/media/sounds/scooby-doo-laugh.mp3', // Scooby Laugh
        'https://www.myinstants.com/media/sounds/scooby-doo-where-are-you-laugh.mp3',
        'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
      ];
      const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
      const audio = new Audio(randomSound);
      audio.volume = 0.5;
      audio.play();
    } catch (e) {}
  };

  const speak = (text: string) => {
    if (muted || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    playWoof();
    setIsSpeaking(true);

    const emojis = ['⚡', '🔥', '🚀', '👀', '🧠', '💸', '🐕'];
    setEmotion(emojis[Math.floor(Math.random() * emojis.length)]);

    // Prepare Scooby-Animal Style text
    let scoobyText = text.replace(/(Woof|Bark|Arf)/gi, 'Rrrr-woof-woof!');
    if (!scoobyText.includes('Ree-hee-hee')) scoobyText += ' Ree-hee-hee-hee!';
    if (!scoobyText.startsWith('R')) scoobyText = 'Ruh-roh! ' + scoobyText;

    const utterance = new SpeechSynthesisUtterance(scoobyText.replace(/[*_#]/g, ''));
    
    // Animal/Scooby Settings (Very Deep & Fun)
    const voices = window.speechSynthesis.getVoices();
    const deepVoice = voices.find(v => v.name.includes('UK English Male') || v.name.includes('Male')) || voices[0];
    
    utterance.voice = deepVoice;
    utterance.pitch = 0.5; // Very deep animal voice
    utterance.rate = 0.8;  // Slower, more exaggerated
    utterance.volume = 1;

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
      const [pricesRes, newsRes] = await Promise.all([
        fetch('/api/prices').then(r => r.json()),
        fetch('/api/news').then(r => r.json())
      ]);

      // Build history for multi-turn context (last 8 messages)
      const historyForApi = history.slice(-8).map(h => ({
        role: h.role === 'dog' ? 'assistant' : 'user',
        content: h.text,
      }));

      const res = await fetch('/api/dog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg, 
          prices: pricesRes, 
          news: newsRes?.news?.slice(0, 5),
          history: historyForApi,
        }),
      });
      const data = await res.json();
      setHistory(prev => [...prev, { role: 'dog', text: data.reply }]);
      playWoof();
      speak(data.reply);
    } catch (e) {
      setHistory(prev => [...prev, { role: 'dog', text: "Woof! Something went wrong. Neural link broken!" }]);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 40, 
      right: chatOpen ? 24 : (isHovered ? 10 : -40), 
      zIndex: 1000, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'flex-end', 
      gap: 12,
      transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }}
    onMouseEnter={() => setIsHovered(true)}
    onMouseLeave={() => setIsHovered(false)}
    >
      
      {/* Chat Window */}
      {chatOpen && (
        <div className="fade-up" style={{ 
          width: 320, 
          height: 480, 
          background: 'rgba(5, 5, 5, 0.98)', 
          border: '1px solid #333', 
          borderRadius: 24, 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
          backdropFilter: 'blur(30px)',
          overflow: 'hidden',
          marginBottom: 10,
          borderBottom: '4px solid #f59e0b'
        }}>
          {/* Header */}
          <div style={{ padding: '16px', background: 'linear-gradient(90deg, #f59e0b20, transparent)', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
               <div className="sync" style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 10px #00e676' }} />
               <span style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', letterSpacing: '0.1em' }}>SODOGGY INTELLIGENCE</span>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={18} /></button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {history.map((h, i) => (
              <div key={i} style={{ alignSelf: h.role === 'dog' ? 'flex-start' : 'flex-end', maxWidth: '85%' }}>
                <div style={{ 
                  background: h.role === 'dog' ? 'rgba(255,255,255,0.03)' : 'var(--accent-orange)', 
                  color: h.role === 'dog' ? '#ccc' : '#000', 
                  padding: '12px 16px', 
                  borderRadius: h.role === 'dog' ? '20px 20px 20px 4px' : '20px 20px 4px 20px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontWeight: h.role === 'dog' ? 400 : 700,
                  border: h.role === 'dog' ? '1px solid #1a1a1a' : 'none',
                  boxShadow: h.role === 'dog' ? 'none' : '0 4px 12px rgba(245,158,11,0.2)'
                }}>
                  {h.text}
                </div>
              </div>
            ))}
            {loading && (
               <div style={{ alignSelf: 'flex-start', background: '#0a0a0a', padding: '12px 16px', borderRadius: '20px 20px 20px 4px', border: '1px solid #222' }}>
                 <div className="loading-dots"><span>.</span><span>.</span><span>.</span></div>
               </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: 16, borderTop: '1px solid #1a1a1a', display: 'flex', gap: 10 }}>
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask SoDoggy anything..." 
              style={{ flex: 1, background: '#111', border: '1px solid #222', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }} 
            />
            <button onClick={handleSend} style={{ background: '#f59e0b', border: 'none', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 15px rgba(245,158,11,0.3)' }}>
              <Send size={18} color="#000" />
            </button>
          </div>
        </div>
      )}

      {/* Dog Avatar Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
         {!chatOpen && isHovered && (
           <div className="fade-right" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b33', padding: '10px 16px', borderRadius: 16, fontSize: 12, color: '#f59e0b', fontWeight: 800, backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
             Woof! Click me for Analysis!
           </div>
         )}
         
         <div 
          onClick={() => { setChatOpen(!chatOpen); if (!chatOpen) playWoof(); }}
          className={`${isSpeaking ? 'cybonk-talk' : ''} ${isWaving ? 'wave-animation' : 'cybonk-float'}`}
          style={{ 
            width: 100, 
            height: 100, 
            background: `url('/cybonk_dog.png') center/cover no-repeat`,
            backgroundColor: '#050505',
            borderRadius: '50%', 
            border: '3px solid #f59e0b',
            boxShadow: chatOpen ? '0 0 40px rgba(245,158,11,0.6)' : '0 0 20px rgba(245, 158, 11, 0.4)',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          {/* Wave/Hi Indicator */}
          {isWaving && !chatOpen && (
            <div style={{ position: 'absolute', top: -10, left: -10, fontSize: 32, animation: 'bounce-1 0.5s infinite alternate' }}>👋</div>
          )}

          {/* HUD Circles */}
          <div style={{ position: 'absolute', inset: -10, border: '2px dashed rgba(245, 158, 11, 0.2)', borderRadius: '50%', animation: 'spin 12s linear infinite' }} />
          
          <img 
            src="/cybonk_dog.png" 
            alt="SoDoggy" 
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
            onError={(e) => { 
              e.currentTarget.style.display='none'; 
              if (e.currentTarget.parentElement) e.currentTarget.parentElement.innerHTML += '<div style="font-size:40px">🐕</div>';
            }} 
          />

          {/* Emotion Emoji */}
          {emotion && (
            <div className="fade-up" style={{ position: 'absolute', top: -15, right: -5, fontSize: 24, background: '#000', borderRadius: '50%', padding: 4, border: '1px solid #f59e0b' }}>
              {emotion}
            </div>
          )}
        </div>
      </div>

      <button onClick={() => setMuted(!muted)} style={{ position: 'absolute', top: -30, right: 0, background: 'transparent', border: 'none', color: '#333', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='#f59e0b'} onMouseLeave={e => e.currentTarget.style.color='#333'}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <style jsx>{`
        @keyframes wave-animation {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(15deg) scale(1.1); }
          50% { transform: rotate(-15deg) scale(1.1); }
          75% { transform: rotate(15deg) scale(1.1); }
        }
        .wave-animation {
          animation: wave-animation 1s ease-in-out infinite;
          border-color: #00e676 !important;
          box-shadow: 0 0 40px rgba(0, 230, 118, 0.5) !important;
        }
      `}</style>
    </div>
  );
}
