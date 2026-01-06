
import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';

interface SettingsModalProps {
  onClose: () => void;
  isStrict?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isStrict = false }) => {
  const { settings, updateSettings } = useUser();
  const [name, setName] = useState(settings.displayName);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [nanoKey, setNanoKey] = useState(settings.nanoKey || '');
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [showNanoKey, setShowNanoKey] = useState(false);

  useEffect(() => {
    setName(settings.displayName);
    setApiKey(settings.apiKey);
    setNanoKey(settings.nanoKey || '');
  }, [settings]);

  const handleSave = () => {
    if (!name.trim() || !apiKey.trim()) {
        alert("Vui lòng nhập Tên và Gemini API Key!");
        return;
    }
    
    // Logic: Nếu Nano Key để trống, tự động dùng API Key để người dùng đỡ phải nhập 2 lần
    // Nếu nhập khác thì dùng cái khác.
    const finalNanoKey = nanoKey.trim() === '' ? apiKey.trim() : nanoKey.trim();

    updateSettings({
      displayName: name,
      apiKey: apiKey.trim(),
      nanoKey: finalNanoKey
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={!isStrict ? onClose : undefined}>
      <div className={`bg-slate-900 border ${isStrict ? 'border-red-500/50 shadow-red-900/20' : 'border-slate-700'} w-full max-w-md rounded-2xl shadow-2xl overflow-hidden`} onClick={e => e.stopPropagation()}>
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
           <h3 className="text-white font-bold text-lg flex items-center gap-2">
             {isStrict ? (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                 </svg>
             ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
             )}
             {isStrict ? "Cấu hình hệ thống M.A.P" : "Cài Đặt Cá Nhân"}
           </h3>
           {!isStrict && (
               <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
               </button>
           )}
        </div>

        <div className="p-6 space-y-5">
           {isStrict && (
               <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-sm text-blue-200 mb-4">
                   Để sử dụng, vui lòng nhập API Key của riêng bạn. Dữ liệu được lưu an toàn trên trình duyệt của bạn.
               </div>
           )}

           {/* Display Name */}
           <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tên hiển thị (Tác giả)</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
           </div>

           {/* API Key */}
           <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                 <span>Gemini API Key (Bắt buộc)</span>
                 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">Lấy key ở đâu?</a>
              </label>
              <div className="relative">
                 <input 
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Bắt đầu bằng AIza..."
                    className={`w-full bg-slate-950 border rounded-lg px-4 py-3 text-white focus:ring-2 outline-none pr-10 ${apiKey ? 'border-emerald-500/50 focus:ring-emerald-500' : 'border-red-500/50 focus:ring-red-500'}`}
                 />
                 <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    {showApiKey ? "👁️" : "👁️‍🗨️"}
                 </button>
              </div>
           </div>

           {/* Nano Banana Key */}
           <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                 <span>Nano Banana Key (Tạo ảnh)</span>
                 <span className="text-[10px] text-slate-500">Nếu trống sẽ dùng Gemini Key</span>
              </label>
              <div className="relative">
                 <input 
                    type={showNanoKey ? "text" : "password"}
                    value={nanoKey}
                    onChange={(e) => setNanoKey(e.target.value)}
                    placeholder="Key riêng cho Model tạo ảnh (Tùy chọn)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none pr-10"
                 />
                 <button onClick={() => setShowNanoKey(!showNanoKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    {showNanoKey ? "👁️" : "👁️‍🗨️"}
                 </button>
              </div>
           </div>
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
           {!isStrict && (
               <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium">Hủy bỏ</button>
           )}
           <button 
             onClick={handleSave}
             disabled={!apiKey || !name}
             className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isStrict ? "Lưu & Bắt đầu" : "Lưu Cài Đặt"}
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
