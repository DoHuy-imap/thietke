
import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
    const blob = new Blob([uInt8Array], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
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
  const [filterMine, setFilterMine] = useState(false);

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const data = await getAllDesigns();
      setDesigns(data);
    } catch (e) { console.error("Fetch error", e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDesigns(); }, []);

  const filteredDesigns = useMemo(() => {
    if (!filterMine || !user) return designs;
    return designs.filter(d => d.author === user.displayName);
  }, [designs, filterMine, user]);

  const handleDeleteItem = async (id: number) => {
    if(window.confirm('Xóa vĩnh viễn thiết kế này?')) {
        try {
          await deleteDesign(id);
          setDesigns(prev => prev.filter(d => d.id !== id));
          if (selectedDesign?.id === id) setSelectedDesign(null);
        } catch (err) { alert("Không thể xóa."); }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if(window.confirm(`Xóa ${selectedIds.length} thiết kế?`)) {
        try {
          for (const id of selectedIds) await deleteDesign(id);
          setDesigns(prev => prev.filter(d => !selectedIds.includes(d.id!)));
          setSelectedIds([]);
          setIsSelectMode(false);
        } catch (err) { alert("Lỗi xóa hàng loạt."); }
    }
  };

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const handleCardClick = (design: DesignDNA) => {
    if (isSelectMode) {
      handleToggleSelect(design.id!);
    } else {
      setSelectedDesign(design);
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('vi-VN');
  
  const handleDownload4K = async (url: string, ratio: string) => {
      setIsUpscaling(true);
      try {
          const res = await upscaleImageTo4K(url, ratio as any);
          triggerDownload(res, `map-4k-${Date.now()}.png`);
      } catch (e) { alert("Lỗi 4K."); }
      finally { setIsUpscaling(false); }
  };

  return (
    <div className="h-full overflow-y-auto pr-2 flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md gap-4">
        <div><h2 className="text-xl font-black text-white uppercase tracking-tighter">Thư Viện Studio</h2></div>
        <div className="flex items-center gap-4">
            <button onClick={() => setFilterMine(!filterMine)} className={`text-[10px] px-5 py-2.5 rounded-xl font-black uppercase tracking-widest border transition-all ${filterMine ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{filterMine ? 'Của tôi' : 'Tất cả'}</button>
            <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }} className={`text-[10px] px-5 py-2.5 rounded-xl font-black uppercase tracking-widest transition-all ${isSelectMode ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{isSelectMode ? 'Hủy' : 'Chọn'}</button>
            {isSelectMode && selectedIds.length > 0 && <button onClick={handleBulkDelete} className="text-[10px] px-5 py-2.5 bg-red-600 text-white font-black rounded-xl">Xóa ({selectedIds.length})</button>}
        </div>
      </div>

      {loading ? (<div className="flex items-center justify-center flex-grow"><div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 pb-10">
          {filteredDesigns.map((design) => (
            <div 
              key={design.id} 
              onClick={() => handleCardClick(design)} 
              className={`group relative bg-slate-900 rounded-[2.5rem] overflow-hidden border cursor-pointer transition-all duration-500 ${isSelectMode && selectedIds.includes(design.id!) ? 'border-purple-500 ring-4 ring-purple-500/20 scale-95' : 'border-slate-800 hover:border-slate-600'}`}
            >
              <div className="w-full aspect-square bg-slate-950 relative overflow-hidden">
                 <img src={design.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="Thumb" />
                 {isSelectMode && (
                   <div 
                    onClick={(e) => { e.stopPropagation(); handleToggleSelect(design.id!); }} 
                    className={`absolute top-4 right-4 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${selectedIds.includes(design.id!) ? 'bg-purple-500 border-purple-500' : 'bg-black/40 border-white'}`}
                   >
                     {selectedIds.includes(design.id!) && <div className="w-2 h-2 bg-white rounded-full" />}
                   </div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 flex flex-col justify-end p-5 opacity-0 group-hover:opacity-100 transition-opacity"><p className="text-[10px] text-white font-black uppercase tracking-widest line-clamp-1">{design.requestData.mainHeadline}</p></div>
              </div>
              <div className="p-5 flex justify-between items-center bg-slate-900">
                 <div><span className="text-[8px] text-[#FFD300] font-black uppercase tracking-widest">{design.author}</span><p className="text-[8px] text-slate-600 font-bold uppercase">{formatDate(design.createdAt)}</p></div>
                 {!isSelectMode && (
                   <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(design.id!); }} 
                    className="p-2 text-red-500/50 hover:text-red-500 transition-colors"
                   >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDesign && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4" onClick={() => { setSelectedDesign(null); setEditResult(null); }}>
           <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-[3rem] border border-white/5 flex flex-col md:flex-row overflow-hidden shadow-2xl animate-scale-up" onClick={e => e.stopPropagation()}>
               <div className="w-full md:w-1/2 bg-black/40 flex items-center justify-center p-8 relative border-r border-white/5">
                 <img src={editResult || selectedDesign.thumbnail} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt="Preview" />
               </div>
               <div className="w-full md:w-1/2 flex flex-col p-12 bg-slate-900/50">
                   <div className="flex justify-between items-start mb-10">
                       <div><h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight">{selectedDesign.requestData.mainHeadline}</h3><p className="text-[10px] text-slate-500 font-black uppercase mt-2 tracking-widest">{selectedDesign.author} ● {formatDate(selectedDesign.createdAt)}</p></div>
                       <button onClick={() => { setSelectedDesign(null); setEditResult(null); }} className="p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                   </div>
                   <div className="flex-grow space-y-8 overflow-y-auto pr-4 scrollbar-hide">
                       <div className="bg-slate-800/50 p-8 rounded-[2rem] border border-white/5 space-y-4"><h4 className="text-[10px] font-black text-[#FFD300] uppercase tracking-widest">Design Plan Analysis</h4><p className="text-[11px] text-slate-300 leading-relaxed font-bold"><span className="text-white opacity-40 uppercase mr-2">Subject:</span> {selectedDesign.designPlan.subject}</p><p className="text-[11px] text-slate-300 leading-relaxed font-bold"><span className="text-white opacity-40 uppercase mr-2">Style:</span> {selectedDesign.designPlan.styleContext}</p></div>
                       <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setIsEditing(true)} className="py-5 bg-slate-950 border border-red-500/30 text-red-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all">🪄 AI Eraser</button>
                            <button onClick={() => triggerDownload(editResult || selectedDesign.thumbnail, 'original.png')} className="py-5 bg-slate-950 border border-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800">Tải Bản Gốc</button>
                       </div>
                       <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(selectedDesign.id!); }} 
                        className="w-full py-4 bg-red-900/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-500/10 transition-all"
                       >
                        Xóa Thiết Kế
                       </button>
                   </div>
                   <div className="mt-10 pt-10 border-t border-white/5"><button onClick={() => handleDownload4K(editResult || selectedDesign.thumbnail, selectedDesign.recommendedAspectRatio || "1:1")} disabled={isUpscaling} className="w-full py-6 bg-gradient-to-r from-[#FFD300] to-[#FFA000] text-black font-black rounded-3xl shadow-2xl shadow-[#FFD300]/20 uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border-t-2 border-white/30">{isUpscaling ? 'Nâng cấp 4K...' : 'Xuất File In (4K)'}</button></div>
               </div>
           </div>
        </div>
      )}

      {isEditing && selectedDesign && (
          <SmartRemover 
            imageUrl={editResult || selectedDesign.thumbnail} 
            onClose={() => setIsEditing(false)} 
            isProcessing={isProcessingEdit} 
            onProcess={async (mask, text) => {
              setIsProcessingEdit(true);
              try {
                const res = await removeObjectWithMask(editResult || selectedDesign.thumbnail, mask, text);
                if (res) { setEditResult(res); }
              } catch(e) { 
                console.error("Smart Remover Error:", e);
                alert("Lỗi xử lý xóa thông minh."); 
              }
              finally { setIsProcessingEdit(false); }
            }} 
            resultUrl={editResult}
            aspectRatio={selectedDesign.recommendedAspectRatio}
          />
      )}
    </div>
  );
};

export default GalleryView;
