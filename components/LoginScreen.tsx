
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
  const [loading, setLoading] = useState(true);
  const [isApiKeyFound, setIsApiKeyFound] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const active = await checkApiKeyStatus();
      setIsApiKeyFound(active);
      setLoading(false);
    };
    checkKey();
  }, [checkApiKeyStatus]);

  // FIX: Replace manual API key entry with platform openSelectKey() dialog
  const handleStart = async () => {
    if (!name.trim()) {
      setError("Vui lòng nhập tên nhà thiết kế.");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const keyActive = await checkApiKeyStatus();
      if (!keyActive) {
        // Guideline: Trigger mandatory API Key selection for high-quality image generation
        if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
          // Guideline: Assume selection was successful to mitigate race condition
          login(name.trim());
        } else {
          throw new Error("Vui lòng truy cập ứng dụng qua AI Studio để sử dụng tính năng thiết kế.");
        }
      } else {
        login(name.trim());
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
      {/* Glow Effects */}
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
              placeholder="Tên của bạn..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-slate-950 border border-white/5 rounded-3xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-[#FFD300]/40 outline-none transition-all placeholder-slate-700"
            />
          </div>

          {!isApiKeyFound && (
              <div className="text-left space-y-2 animate-fade-in">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Cấu hình Gemini API</label>
                <div className="p-6 bg-blue-900/10 rounded-3xl border border-blue-500/20 text-center">
                   <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                     Mẫu thiết kế này sử dụng Gemini 3 Pro để đảm bảo chất lượng in ấn 4K. 
                     Vui lòng chọn API Key từ một <strong>GCP Project đã kích hoạt thanh toán (Paid)</strong>.
                   </p>
                   <a 
                     href="https://ai.google.dev/gemini-api/docs/billing" 
                     target="_blank" 
                     rel="noreferrer" 
                     className="text-[9px] text-blue-400 underline hover:text-blue-300 block mb-2"
                   >
                     Tìm hiểu về Billing & Quota
                   </a>
                </div>
              </div>
          )}

          {isApiKeyFound && (
              <div className="p-4 bg-emerald-900/20 rounded-2xl border border-emerald-500/20 flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <div className="text-left">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Hệ thống đã sẵn sàng</p>
                    <p className="text-[10px] text-slate-400">API Key đã được cấu hình.</p>
                 </div>
                 <button 
                  onClick={async () => {
                    if ((window as any).aistudio?.openSelectKey) {
                      await (window as any).aistudio.openSelectKey();
                    }
                  }} 
                  className="ml-auto text-[9px] text-slate-500 hover:text-white underline"
                >
                  Thay đổi
                </button>
              </div>
          )}

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
                   Checking...
                </>
            ) : (
                <>
                    {isApiKeyFound ? 'Kết nối Studio' : 'Chọn Key & Bắt đầu'}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </>
            )}
          </button>
        </div>
        
        <div className="mt-12 flex justify-center gap-4 opacity-50">
             <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
             <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
             <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;