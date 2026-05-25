'use client';
import { useState, useEffect } from 'react';
import { Mic, Volume2, Square, Loader2 } from 'lucide-react';

interface VoiceBriefingProps {
  data?: any;
}

export default function VoiceBriefing({ data }: VoiceBriefingProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis.speaking) {
      setIsSpeaking(true);
    }
  }, []);

  const startBriefing = async () => {
    if (isLoading || isSpeaking) return;
    setIsLoading(true);

    try {
      // 1. Fetch Latest News for Podcast
      let newsText = "";
      try {
        const newsRes = await fetch('/api/news');
        const newsData = await newsRes.json();
        if (newsData.news && newsData.news.length > 0) {
          const topNews = newsData.news.slice(0, 3).map((n: any) => n.title).join(". Next headline: ");
          newsText = ` Here are the top 3 breaking news stories: ${topNews}. `;
        }
      } catch (e) {
        console.error("News fetch error for podcast:", e);
      }

      // 2. Prepare data summary
      const btc = data?.btc ? `Bitcoin is currently at ${data.btc.toLocaleString()} dollars.` : '';
      const eth = data?.eth ? `Ethereum is trading at ${data.eth.toLocaleString()} dollars.` : '';
      const sentiment = "The overall market sentiment is bullish with high social activity.";
      
      const script = `Welcome to This Quick Market Podcast by SoSo Smart Money Research Engine. Here is your daily alpha. ${btc} ${eth} ${newsText} ${sentiment} Our AI models recommend looking for buy zones in the next one hour. Happy trading!`;

      // 3. Browser Speech Synthesis
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(script);
      
      // Set BEST human-like voice for Podcast
      const voices = synth.getVoices();
      // Look for high-quality natural voices first
      const professionalVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Premium') || v.name.includes('Natural')) || voices[0];
      
      if (professionalVoice) {
        utterance.voice = professionalVoice;
        // Human-like settings
        utterance.pitch = 1.0; 
        utterance.rate = 0.95; // Slightly slower for clear understanding
      }
      
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsLoading(false);
      };

      synth.speak(utterance);
    } catch (error) {
      console.error("Speech error:", error);
      setIsLoading(false);
    }
  };

  const stopBriefing = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  return (
    <div className="neon-border glass" style={{ 
      padding: '16px 20px', 
      borderRadius: 16, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      gap: 16,
      background: 'var(--bg-card)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: '50%', 
          background: isSpeaking ? 'var(--accent-orange)' : 'rgba(249,115,22,0.1)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          transition: 'all 0.3s'
        }}>
          {isLoading ? <Loader2 size={18} color="var(--accent-orange)" className="spin" /> : 
           isSpeaking ? <Volume2 size={18} color="#fff" /> : 
           <Mic size={18} color="var(--accent-orange)" />}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {isSpeaking ? 'Podcast in Progress...' : 'THIS QUICK MARKET PODCAST'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
            {isSpeaking ? 'Listening to market alpha...' : 'Listen to your daily AI-powered market alpha'}
          </div>
        </div>
      </div>

      {isSpeaking ? (
        <button 
          onClick={stopBriefing}
          style={{ 
            padding: '8px 16px', 
            borderRadius: 10, 
            background: 'var(--accent-red)', 
            color: '#fff', 
            border: 'none', 
            fontSize: 11, 
            fontWeight: 800, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Square size={12} fill="#fff" /> STOP PODCAST
        </button>
      ) : (
        <button 
          onClick={startBriefing}
          disabled={isLoading}
          style={{ 
            padding: '10px 20px', 
            borderRadius: 12, 
            background: 'var(--text-primary)', 
            color: 'var(--bg-main)', 
            border: 'none', 
            fontSize: 12, 
            fontWeight: 900, 
            cursor: 'pointer',
            transition: 'transform 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
        >
          <Volume2 size={16} /> PLAY PODCAST
        </button>
      )}
    </div>
  );
}
