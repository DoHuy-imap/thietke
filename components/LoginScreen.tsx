
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
  const { login, checkApiKeyStatus } = useAuth();
  const [name, setName] = useState('');
  const [manualApiKey, setManualApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [isApiKeyFound, setIsApiKeyFound] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const active = await checkApiKeyStatus();
      setIsApiKeyFound(active);
      const savedKey = localStorage.getItem('map_app_api_key');
      if (savedKey) setManualApiKey(savedKey);
      setLoading(false);
    };
    checkKey();
  }, [checkApiKeyStatus]);

  const handleStart = async () => {
    if (!name.trim()) {
      setError("Vui lòng nhập tên nhà thiết kế.");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const currentActive = await checkApiKeyStatus();
      const finalApiKey = manualApiKey.trim();

      if (!currentActive && !finalApiKey) {
        if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
          login(name.trim());
        } else {
          throw new Error("Vui lòng nhập Gemini API Key để tiếp tục.");
        }
      } else {
        login(name.trim(), finalApiKey || undefined);
      }
    } catch (e: any) {
      setError(e.message || "Kết nối thất bại. Vui lòng kiểm tra API Key.");
    } finally {
      setIsValidating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#FFD300] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-['Inter']">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#FFD300]/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>

      <div className="bg-slate-900/80 border border-white/5 p-10 sm:p-14 rounded-[3.5rem] w-full max-w-lg shadow-2xl backdrop-blur-3xl relative z-10 animate-fade-in text-center">
        <div className="flex flex-col items-center mb-10">
          <MapLogo className="w-24 h-28 mb-6" />
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">AI ART DIRECTOR</h1>
          <p className="text-[#FFD300] text-[10px] font-black uppercase tracking-[0.5em] mt-3 opacity-60">Creative Intelligence Studio</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-xs font-bold animate-shake text-left">
              ⚠ {error}
            </div>
          )}

          <div className="text-left space-y-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Định danh nhà thiết kế</label>
            <input 
              type="text" 
              placeholder="Nhập tên của bạn..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-slate-950 border border-white/5 rounded-3xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-[#FFD300]/40 outline-none transition-all placeholder-slate-700"
            />
          </div>

          <div className="text-left space-y-2">
            <div className="flex justify-between items-center px-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Gemini API Key</label>
              <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Mã hóa cục bộ
              </span>
            </div>
            <input 
              type="password" 
              placeholder="Nhập API Key của bạn..."
              value={manualApiKey}
              onChange={(e) => {
                setManualApiKey(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-slate-950 border border-white/5 rounded-3xl px-6 py-4 text-white font-mono text-sm focus:ring-2 focus:ring-[#FFD300]/40 outline-none transition-all placeholder-slate-800"
            />
            <p className="text-[9px] text-slate-600 px-4 mt-1 leading-relaxed">
              API Key sẽ được lưu trữ an toàn trong <strong>Local Storage</strong> của trình duyệt và chỉ dùng để gọi API từ máy của bạn.
            </p>
          </div>

          <button 
            onClick={handleStart}
            disabled={isValidating || !name}
            className={`w-full py-5 font-black rounded-3xl shadow-xl uppercase tracking-[0.2em] transition-all text-sm group flex items-center justify-center gap-3
                ${isValidating 
                    ? 'bg-slate-800 text-slate-500 cursor-wait' 
                    : 'bg-[#FFD300] hover:bg-[#FFC000] text-black shadow-[#FFD300]/20 active:scale-95'
                }`}
          >
            {isValidating ? (
                <>
                   <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                   Đang xác thực...
                </>
            ) : (
                <>
                    Kết nối Studio
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </>
            )}
          </button>
        </div>
        
        <div className="mt-12 flex justify-center gap-4 opacity-30">
             <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
             <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
             <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
