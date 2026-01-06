
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/UserContext';

const MapLogo = ({ className }: { className?: string }) => (
  <div className={`relative ${className}`}>
    <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Khung bo góc như trong ảnh */}
      <rect x="5" y="5" width="90" height="90" rx="15" fill="black" stroke="#FFD300" strokeWidth="4"/>
      {/* Biểu tượng bóng đèn / bút chì stylized */}
      <path d="M50 20C40 20 32 28 32 38C32 44 35 49 40 52V65H60V52C65 49 68 44 68 38C68 28 60 20 50 20Z" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M40 65L32 85L50 95L68 85L60 65H40Z" fill="#FFD300" stroke="white" strokeWidth="2"/>
      <path d="M40 65L32 85" stroke="#E91E63" strokeWidth="4"/> {/* Pink line */}
      <path d="M50 65V95" stroke="#FFD300" strokeWidth="4"/> {/* Yellow line */}
      <path d="M60 65L68 85" stroke="#00BCD4" strokeWidth="4"/> {/* Blue line */}
      <text x="50" y="115" fill="#FFD300" fontSize="16" fontWeight="900" textAnchor="middle" fontFamily="Arial">M.A.P</text>
    </svg>
  </div>
);

const LoginScreen: React.FC = () => {
  const { login, checkApiKeyStatus, requestApiKey } = useAuth();
  const [name, setName] = useState('');
  const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const status = await checkApiKeyStatus();
      setIsKeySelected(status);
    };
    check();
  }, [checkApiKeyStatus]);

  const handleConnectKey = async () => {
    await requestApiKey();
    setIsKeySelected(true);
  };

  const handleStart = () => {
    if (name.trim() && isKeySelected) {
      login(name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Hiệu ứng nền Blur theo tone màu mới */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#FFD300]/10 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="bg-slate-900/60 border border-white/10 p-8 sm:p-10 rounded-[3.5rem] w-full max-w-lg shadow-2xl backdrop-blur-3xl relative z-10 animate-fade-in border-t-white/20">
        <div className="flex flex-col items-center mb-10">
          <MapLogo className="w-24 h-28 mb-4 transform hover:scale-105 transition-transform duration-500" />
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter text-center">Thiết kế M.A.P</h1>
          <p className="text-[#FFD300] text-[9px] font-black uppercase tracking-[0.4em] mt-3 opacity-80">Creativity is endless</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Nhà thiết kế (Display Name)</label>
            <div className="relative group">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#FFD300] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Nhập tên của bạn..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950/40 border border-white/5 rounded-3xl pl-14 pr-6 py-4 text-white font-bold focus:ring-2 focus:ring-[#FFD300]/50 outline-none transition-all placeholder-slate-700 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cấu hình API (Paid Key)</label>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[8px] text-blue-400 font-bold hover:text-blue-300 transition-colors">Bảng giá & Thanh toán</a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div 
                onClick={handleConnectKey}
                className={`group cursor-pointer p-4 rounded-3xl border transition-all duration-300 flex flex-col items-center text-center gap-2 ${isKeySelected ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-950/40 border-white/5 hover:border-white/20'}`}
              >
                <div className={`w-8 h-8 rounded-2xl flex items-center justify-center mb-1 ${isKeySelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p className="text-[9px] font-black text-white uppercase tracking-tighter">Gemini Brain</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isKeySelected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`}></div>
                  <span className={`text-[8px] font-black uppercase ${isKeySelected ? 'text-emerald-400' : 'text-slate-600'}`}>{isKeySelected ? 'Connected' : 'Missing'}</span>
                </div>
              </div>

              <div 
                onClick={handleConnectKey}
                className={`group cursor-pointer p-4 rounded-3xl border transition-all duration-300 flex flex-col items-center text-center gap-2 ${isKeySelected ? 'bg-blue-500/5 border-blue-500/30' : 'bg-slate-950/40 border-white/5 hover:border-white/20'}`}
              >
                <div className={`w-8 h-8 rounded-2xl flex items-center justify-center mb-1 ${isKeySelected ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-[9px] font-black text-white uppercase tracking-tighter">Image Engine</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isKeySelected ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-slate-600'}`}></div>
                  <span className={`text-[8px] font-black uppercase ${isKeySelected ? 'text-blue-400' : 'text-slate-600'}`}>{isKeySelected ? 'Connected' : 'Missing'}</span>
                </div>
              </div>
            </div>
            
            {!isKeySelected && (
              <p className="text-center text-[8px] text-red-400/80 font-bold uppercase tracking-widest pt-2">Vui lòng click vào các ô trên để liên kết API Key</p>
            )}
          </div>

          <button 
            onClick={handleStart}
            disabled={!name.trim() || !isKeySelected}
            className="w-full py-5 bg-gradient-to-r from-[#FFD300] to-[#FFA000] hover:from-[#FFB300] hover:to-[#FF8000] text-black font-black rounded-[2rem] shadow-2xl shadow-[#FFD300]/20 uppercase tracking-[0.3em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 text-[11px] mt-6 border-t border-white/20"
          >
            Vào Studio Sáng Tạo
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex justify-center gap-6 opacity-20 hover:opacity-50 transition-opacity text-white">
           <img src="https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg" className="h-3 grayscale invert" alt="Gemini" />
           <img src="https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Imagen_logo.svg" className="h-3 grayscale invert" alt="Imagen" />
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
