
import React, { useEffect, useState, useMemo } from 'react';
import { getAllDesigns, deleteDesign } from '../services/historyDb';
import { DesignDNA } from '../types';
import SmartRemover from './SmartRemover';
import { removeObjectWithMask, upscaleImageTo4K } from '../services/geminiService';
import { useAuth } from '../contexts/UserContext';

const triggerDownload = (base64Data: string, fileName: string) => {
  try {
    const parts = base64Data.split(';base64,');
    if (parts.length !== 2) return false;
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    const blob = new Blob([uInt8Array], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
    return true;
  } catch (e) { return false; }
};

const GalleryView: React.FC = () => {
  const { user } = useAuth();
  const [designs, setDesigns] = useState<DesignDNA[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState<DesignDNA | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editResult, setEditResult] = useState<string | null>(null);
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  
  // Filter state
  const [filterMine, setFilterMine] = useState(false);

  const fetchDesigns = async () => {
    setLoading(true);
    const data = await getAllDesigns();
    setDesigns(data);
    setLoading(false);
  };

  useEffect(() => { fetchDesigns(); }, []);

  const filteredDesigns = useMemo(() => {
    if (!filterMine || !user) return designs;
    return designs.filter(d => d.author === user.displayName);
  }, [designs, filterMine, user]);

  const toggleSelect = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await deleteDesign(id);
    await fetchDesigns();
    if (selectedDesign?.id === id) setSelectedDesign(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) await deleteDesign(id);
    setSelectedIds([]);
    setIsSelectMode(false);
    await fetchDesigns();
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  const handleDownload4K = async (url: string, ratio: string) => {
      setIsUpscaling(true);
      try {
          const upscaleUrl = await upscaleImageTo4K(url, ratio as any);
          triggerDownload(upscaleUrl, `gallery-4k-${Date.now()}.png`);
      } catch (e) { alert("Lỗi nâng cấp 4K."); }
      finally { setIsUpscaling(false); }
  };

  return (
    <div className="h-full overflow-y-auto pr-2 animate-fade-in flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 shrink-0 bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md gap-4">
        <div>
           <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">Thư Viện Sáng Tạo</h2>
           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Lưu trữ các thiết kế đã hoàn thiện</p>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
            <button 
              onClick={() => setFilterMine(!filterMine)}
              className={`flex-1 sm:flex-none text-[10px] px-5 py-2.5 rounded-xl font-black uppercase tracking-widest border transition-all ${filterMine ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
                {filterMine ? 'Đang lọc: Của tôi' : 'Tất cả tác giả'}
            </button>
            <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }} className={`flex-1 sm:flex-none text-[10px] px-5 py-2.5 rounded-xl font-black uppercase tracking-widest transition-all ${isSelectMode ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {isSelectMode ? 'Hủy' : 'Chọn Nhiều'}
            </button>
            {isSelectMode && selectedIds.length > 0 && (
                <button onClick={handleBulkDelete} className="text-[10px] px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl shadow-lg uppercase tracking-widest animate-scale-up">Xóa ({selectedIds.length})</button>
            )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-grow"><div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : filteredDesigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 bg-slate-800/20 rounded-[3rem] border border-slate-700/50 border-dashed text-slate-600 uppercase font-black text-xs tracking-widest">Không tìm thấy thiết kế nào.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 pb-10">
          {filteredDesigns.map((design) => (
            <div key={design.id} onClick={() => !isSelectMode && setSelectedDesign(design)} className={`group relative bg-slate-900 rounded-[2.5rem] overflow-hidden border transition-all duration-500 cursor-pointer shadow-2xl flex flex-col ${isSelectMode && selectedIds.includes(design.id!) ? 'border-purple-500 ring-4 ring-purple-500/20 scale-95' : 'border-slate-800 hover:border-slate-600'}`}>
              <div className="w-full aspect-square bg-slate-950 relative overflow-hidden">
                 <img src={design.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="Thumbnail" />
                 
                 {/* Author Badge */}
                 <div className="absolute top-4 left-4 z-10">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                       <span className="text-[9px] text-white font-black uppercase tracking-widest">{design.author}</span>
                    </div>
                 </div>

                 {isSelectMode && (
                     <div onClick={(e) => toggleSelect(e, design.id!)} className={`absolute top-4 right-4 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.includes(design.id!) ? 'bg-purple-500 border-purple-500' : 'bg-black/40 border-white'}`}>
                        {selectedIds.includes(design.id!) && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                     </div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-5">
                    <p className="text-[11px] text-white font-black uppercase tracking-widest line-clamp-2">{design.requestData.mainHeadline}</p>
                 </div>
              </div>
              <div className="p-5 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                 <div>
                    <span className="text-[9px] text-purple-400 font-black uppercase tracking-widest">{design.requestData.productType}</span>
                    <p className="text-[9px] text-slate-600 font-bold mt-1 uppercase tracking-tighter">{formatDate(design.createdAt)}</p>
                 </div>
                 {!isSelectMode && (
                     <button onClick={(e) => handleDeleteItem(e, design.id!)} className="p-2.5 bg-red-900/10 hover:bg-red-900/40 text-red-500 rounded-xl transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDesign && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedDesign(null)}>
           <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-[3rem] border border-white/5 flex overflow-hidden shadow-2xl animate-scale-up" onClick={e => e.stopPropagation()}>
               <div className="w-1/2 bg-black/40 flex items-center justify-center p-12 relative border-r border-white/5">
                   <img src={editResult || selectedDesign.thumbnail} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt="Preview" />
               </div>
               <div className="w-1/2 flex flex-col p-12 bg-slate-900/50 backdrop-blur-xl">
                   <div className="flex justify-between items-start mb-10">
                       <div>
                           <div className="flex items-center gap-3 mb-2">
                               <span className="px-3 py-1 bg-purple-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">{selectedDesign.requestData.productType}</span>
                               <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{formatDate(selectedDesign.createdAt)}</span>
                           </div>
                           <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-tight">{selectedDesign.requestData.mainHeadline}</h3>
                           <p className="text-xs text-slate-400 font-bold uppercase mt-2 tracking-widest">Tác giả: <span className="text-emerald-400">{selectedDesign.author}</span></p>
                       </div>
                       <button onClick={() => setSelectedDesign(null)} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                   </div>
                   <div className="flex-grow space-y-8 overflow-y-auto pr-6 scroll-smooth">
                       <div className="bg-slate-800/50 p-8 rounded-[2rem] border border-white/5 space-y-4">
                            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Cấu trúc thiết kế (DNA)</h4>
                            <p className="text-xs text-slate-300 leading-relaxed font-bold"><span className="text-white uppercase mr-2 opacity-50">Chủ thể:</span> {selectedDesign.designPlan.subject}</p>
                            <p className="text-xs text-slate-300 leading-relaxed font-bold"><span className="text-white uppercase mr-2 opacity-50">Style:</span> {selectedDesign.designPlan.styleContext}</p>
                            <p className="text-xs text-slate-300 leading-relaxed font-bold"><span className="text-white uppercase mr-2 opacity-50">Màu sắc:</span> {selectedDesign.designPlan.colorLighting}</p>
                            <p className="text-xs text-slate-300 leading-relaxed font-bold"><span className="text-white uppercase mr-2 opacity-50">Bố cục:</span> {selectedDesign.designPlan.composition}</p>
                            <p className="text-xs text-slate-300 leading-relaxed font-bold"><span className="text-white uppercase mr-2 opacity-50">Typography:</span> {selectedDesign.designPlan.typography}</p>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setIsEditing(true)} className="py-5 bg-slate-950 border border-red-500/30 text-red-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all">🪄 Hậu kỳ xóa AI</button>
                            <button onClick={() => triggerDownload(editResult || selectedDesign.thumbnail, `design-orig-${Date.now()}.png`)} className="py-5 bg-slate-950 border border-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">Tải Bản Gốc</button>
                       </div>
                   </div>
                   <div className="mt-10 pt-10 border-t border-white/5">
                       <button onClick={() => handleDownload4K(editResult || selectedDesign.thumbnail, selectedDesign.recommendedAspectRatio || "1:1")} disabled={isUpscaling} className="w-full py-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-3xl shadow-2xl shadow-emerald-900/40 uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50">
                           {isUpscaling ? 'Đang Nâng Cấp 4K...' : 'Xuất File In (4K)'}
                       </button>
                   </div>
               </div>
           </div>
        </div>
      )}

      {isEditing && selectedDesign && (
          <SmartRemover imageUrl={editResult || selectedDesign.thumbnail} onClose={() => setIsEditing(false)} isProcessing={isProcessingEdit} onProcess={async (mask, text) => {
              setIsProcessingEdit(true);
              try {
                const res = await removeObjectWithMask(editResult || selectedDesign.thumbnail, mask, text);
                if (res) { setEditResult(res); setIsEditing(false); }
              } finally { setIsProcessingEdit(false); }
          }} />
      )}
    </div>
  );
};

export default GalleryView;
