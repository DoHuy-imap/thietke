
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/UserContext';

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
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl backdrop-blur-xl relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/20 mb-6">
            <span className="text-white font-black text-4xl">M</span>
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter text-center">Thiết kế M.A.P</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-2">Nền tảng sáng tạo AI cho quảng cáo</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Danh tính nhà thiết kế</label>
            <input 
              type="text" 
              placeholder="Nhập tên của bạn (Vd: Huy Designer)..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            />
          </div>

          <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Trạng thái API Key</span>
              {isKeySelected ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-black uppercase">Đã kết nối</span>
              ) : (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-black uppercase">Chưa kết nối</span>
              )}
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Vui lòng chọn <strong>Google API Key</strong> của bạn để bắt đầu sử dụng các mô hình Gemini 3.0. Chúng tôi không bao giờ lưu trữ Key của bạn.
            </p>

            <button 
              onClick={handleConnectKey}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all text-sm flex items-center justify-center gap-3
                ${isKeySelected ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-black hover:bg-slate-200 shadow-xl'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              {isKeySelected ? 'Đổi API Key' : 'Kết nối API Key'}
            </button>
          </div>

          <button 
            onClick={handleStart}
            disabled={!name.trim() || !isKeySelected}
            className="w-full py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black rounded-2xl shadow-2xl shadow-purple-900/40 uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all active:scale-95 text-lg mt-4"
          >
            Đăng nhập & Bắt đầu
          </button>
        </div>

        <p className="text-[10px] text-slate-600 mt-10 text-center font-bold uppercase tracking-widest">
          By continuing, you agree to our Creative Terms.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
