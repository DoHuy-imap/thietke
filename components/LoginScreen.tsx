
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/UserContext';

const MapLogo = ({ className }: { className?: string }) => (
  <div className={`relative ${className}`}>
    <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="5" y="5" width="90" height="90" rx="15" fill="black" stroke="#FFD300" strokeWidth="4"/>
      <path d="M50 20C40 20 32 28 32 38C32 44 35 49 40 52V65H60V52C65 49 68 44 68 38C68 28 60 20 50 20Z" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M40 65L32 85L50 95L68 85L60 65H40Z" fill="#FFD300" stroke="white" strokeWidth="2"/>
      <path d="M40 65L32 85" stroke="#E91E63" strokeWidth="4"/>
      <path d="M50 65V95" stroke="#FFD300" strokeWidth="4"/>
      <path d="M60 65L68 85" stroke="#00BCD4" strokeWidth="4"/>
      <text x="50" y="115" fill="#FFD300" fontSize="16" fontWeight="900" textAnchor="middle" fontFamily="Arial">M.A.P</text>
    </svg>
  </div>
);

const LoginScreen: React.FC = () => {
  const { login, checkApiKeyStatus, requestApiKey } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isApiKeyActive, setIsApiKeyActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const active = await checkApiKeyStatus();
      setIsApiKeyActive(active);
      setLoading(false);
    };
    checkKey();
  }, [checkApiKeyStatus]);

  const handleStart = async () => {
    if (!name.trim()) {
      setError("Vui lòng cho biết tên nhà thiết kế của bạn.");
      return;
    }

    try {
      const active = await checkApiKeyStatus();
      if (!active) {
        // Nếu chưa kết nối key, yêu cầu chọn ngay lập tức
        await requestApiKey();
      }
      // Lưu tên và vào app
      login(name.trim());
    } catch (e) {
      setError("Có lỗi khi kết nối AI Studio. Vui lòng thử lại.");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#FFD300] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-['Inter']">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#FFD300]/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>

      <div className="bg-slate-900/80 border border-white/5 p-10 sm:p-14 rounded-[3.5rem] w-full max-w-lg shadow-2xl backdrop-blur-3xl relative z-10 animate-fade-in text-center">
        <div className="flex flex-col items-center mb-12">
          <MapLogo className="w-24 h-28 mb-6" />
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">AI ART DIRECTOR</h1>
          <p className="text-[#FFD300] text-[10px] font-black uppercase tracking-[0.5em] mt-3 opacity-60">Creative Intelligence Studio</p>
        </div>

        <div className="space-y-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-xs font-bold animate-shake">
              {error}
            </div>
          )}

          <div className="text-left space-y-3">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-5">Tên nhà thiết kế</label>
            <input 
              type="text" 
              placeholder="Vd: Nguyễn Văn A..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-slate-950 border border-white/5 rounded-3xl px-8 py-5 text-white font-bold focus:ring-2 focus:ring-[#FFD300]/40 outline-none transition-all placeholder-slate-800"
            />
          </div>

          <div className="p-6 bg-slate-950/50 rounded-3xl border border-white/5 flex items-center justify-between">
             <div className="text-left">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trạng thái API Key</p>
                <p className={`text-xs font-bold mt-1 ${isApiKeyActive ? 'text-emerald-500' : 'text-slate-400'}`}>
                   {isApiKeyActive ? '● Đã sẵn sàng' : '○ Chờ kết nối'}
                </p>
             </div>
             {!isApiKeyActive && (
                <span className="text-[9px] bg-slate-800 text-slate-500 px-3 py-1.5 rounded-full font-black uppercase">Auto-Secure</span>
             )}
          </div>

          <button 
            onClick={handleStart}
            className="w-full py-6 bg-[#FFD300] hover:bg-[#FFC000] text-black font-black rounded-3xl shadow-xl shadow-[#FFD300]/20 uppercase tracking-[0.2em] active:scale-95 transition-all text-sm group flex items-center justify-center gap-3"
          >
            Lưu & Bắt đầu
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
        
        <p className="text-[9px] text-slate-700 mt-12 font-black uppercase tracking-widest">
           Powered by Google Gemini 2.5/3.0
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
