
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
  const [isKeySelected, setIsKeySelected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const status = await checkApiKeyStatus();
      setIsKeySelected(status);
      setLoading(false);
    };
    init();
  }, []);

  const handleConnectKey = async () => {
    await requestApiKey();
    // Giả định thành công ngay sau khi click theo rules của AI Studio
    setIsKeySelected(true);
  };

  const handleStart = () => {
    if (name.trim() && isKeySelected) {
      login(name.trim());
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#FFD300]/10 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="bg-slate-900/80 border border-white/10 p-8 sm:p-12 rounded-[3.5rem] w-full max-w-xl shadow-2xl backdrop-blur-3xl relative z-10 animate-fade-in border-t-white/20">
        <div className="flex flex-col items-center mb-10">
          <MapLogo className="w-24 h-28 mb-4 transform hover:scale-105 transition-transform duration-500" />
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter text-center">Chào mừng đến với M.A.P</h1>
          <p className="text-[#FFD300] text-[9px] font-black uppercase tracking-[0.4em] mt-3 opacity-80">Creativity Is Endless</p>
        </div>

        <div className="space-y-8">
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
                placeholder="Nhập tên hiển thị của bạn..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950/60 border border-white/5 rounded-3xl pl-14 pr-6 py-5 text-white font-bold focus:ring-2 focus:ring-[#FFD300]/50 outline-none transition-all placeholder-slate-700 text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cấu hình API Key (Paid)</label>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-[8px] text-blue-400 font-bold hover:text-blue-300">Google Billing</a>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div 
                onClick={handleConnectKey}
                className={`cursor-pointer p-5 rounded-[2rem] border transition-all flex flex-col gap-3 relative overflow-hidden group
                  ${isKeySelected ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-950/40 border-white/5 hover:border-white/20'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-white uppercase tracking-tighter">Gemini Brain</p>
                  <div className={`w-2 h-2 rounded-full ${isKeySelected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`}></div>
                </div>
                <p className="text-[11px] font-mono text-slate-500">
                   {isKeySelected ? 'sk-••••CONNECTED' : 'no-key-selected'}
                </p>
              </div>

              <div 
                onClick={handleConnectKey}
                className={`cursor-pointer p-5 rounded-[2rem] border transition-all flex flex-col gap-3 relative overflow-hidden group
                  ${isKeySelected ? 'bg-blue-500/5 border-blue-500/30' : 'bg-slate-950/40 border-white/5 hover:border-white/20'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-white uppercase tracking-tighter">Image Engine</p>
                  <div className={`w-2 h-2 rounded-full ${isKeySelected ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-red-500'}`}></div>
                </div>
                <p className="text-[11px] font-mono text-slate-500">
                   {isKeySelected ? 'sk-••••CONNECTED' : 'no-key-selected'}
                </p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleStart}
            disabled={!name.trim() || !isKeySelected}
            className="w-full py-6 bg-[#FFD300] hover:bg-[#FFC000] text-black font-black rounded-3xl shadow-2xl shadow-[#FFD300]/20 uppercase tracking-[0.3em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 text-sm mt-4 border-t border-white/40"
          >
            Bắt đầu Sáng tạo
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
