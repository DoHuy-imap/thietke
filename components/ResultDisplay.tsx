
import React, { useState, useEffect } from 'react';
import { ArtDirectionRequest, ArtDirectionResponse, ImageGenerationResult, SeparatedAssets, DesignPlan, LayoutSuggestion } from '../types';
import LayoutEditor from './LayoutEditor';
import SmartRemover from './SmartRemover';
import { convertLayoutToPrompt, upscaleImageTo4K } from '../services/geminiService';

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
  } catch (e) {
    console.error("Download failed", e);
    return false;
  }
};

interface ResultDisplayProps {
  request: ArtDirectionRequest;
  artDirection: ArtDirectionResponse | null;
  imageResult: ImageGenerationResult;
  refinementResult: ImageGenerationResult;
  isAnalyzing: boolean;
  analysisError: string | null;
  isUpdatingPlan: boolean;
  onGenerateImages: (finalPrompt: string, append?: boolean, layoutMask?: string | null) => void;
  onUpdatePlan: (updatedPlan: DesignPlan) => void;
  onRegenerateImage: (prompt: string) => void;
  onSeparateLayout: (selectedImage: string, mode: 'full' | 'background') => void;
  onRefineImage: (sourceImage: string, instruction: string) => void;
  onSmartRemove: (sourceImage: string, maskBase64: string, textDescription: string) => void;
  onResetRefinement: () => void;
  separatedAssets: SeparatedAssets;
  onSaveDesign: (selectedImageUrl: string, finalPromptUsed: string) => void;
  isSaving: boolean;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ 
  request,
  artDirection, 
  imageResult, 
  refinementResult,
  isAnalyzing,
  analysisError,
  isUpdatingPlan,
  onGenerateImages,
  onUpdatePlan,
  onSeparateLayout,
  onRefineImage,
  onSmartRemove,
  onResetRefinement,
  separatedAssets,
  onSaveDesign,
  isSaving
}) => {
  const [editablePrompt, setEditablePrompt] = useState('');
  const [localPlan, setLocalPlan] = useState<DesignPlan | null>(null);
  const [localLayout, setLocalLayout] = useState<LayoutSuggestion | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showSmartRemover, setShowSmartRemover] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [layoutMask, setLayoutMask] = useState<string | null>(null);

  const criteriaList: { key: keyof DesignPlan; label: string }[] = [
      { key: 'subject', label: 'Chủ thể & Nội dung' },
      { key: 'styleContext', label: 'Phong cách & Bối cảnh' },
      { key: 'composition', label: 'Bố cục & Góc nhìn' },
      { key: 'colorLighting', label: 'Màu sắc & Ánh sáng' },
      { key: 'decorElements', label: 'Chi tiết trang trí' },
      { key: 'typography', label: 'Typography & Font' },
  ];

  useEffect(() => {
    if (artDirection) {
      setEditablePrompt(artDirection.final_prompt);
      setLocalPlan(artDirection.designPlan);
      setLocalLayout(artDirection.layout_suggestion);
      setLayoutMask(null); 
    }
  }, [artDirection]);

  useEffect(() => {
    setSelectedImage(null);
    setShowSmartRemover(false);
    onResetRefinement();
  }, [imageResult.imageUrls, onResetRefinement]);

  const handleLayoutConfirm = (mask: string) => {
      if (!localLayout) return;
      setLayoutMask(mask);
      const layoutInstruction = convertLayoutToPrompt(localLayout);
      setEditablePrompt(prev => prev.split('\n\n### SPATIAL LAYOUT ###')[0] + layoutInstruction);
  };
  
  const handleGenerateClick = (append: boolean) => {
      onGenerateImages(editablePrompt, append, layoutMask);
  };

  const handleDownload4K = async (url: string) => {
      if (!artDirection) return;
      setIsUpscaling(true);
      try {
          const upscaleUrl = await upscaleImageTo4K(url, artDirection.recommendedAspectRatio);
          triggerDownload(upscaleUrl, `map-design-4k-${Date.now()}.png`);
      } catch (error) {
          alert("Lỗi nâng cấp 4K.");
      } finally {
          setIsUpscaling(false);
      }
  };

  if (analysisError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-red-950/20 rounded-[3rem] border border-red-500/30 p-12 animate-fade-in text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-red-500 mb-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <h3 className="text-2xl font-black text-white uppercase mb-4 tracking-tighter">Lỗi Phân Tích Kỹ Thuật</h3>
        <p className="text-red-400 font-bold max-w-md mx-auto">{analysisError}</p>
        <button onClick={() => window.location.reload()} className="mt-10 px-10 py-3 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 shadow-xl transition-all active:scale-95">Tải lại Studio</button>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-900/40 rounded-[3.5rem] border border-white/5 backdrop-blur-xl">
             <div className="relative">
                <div className="w-24 h-24 border-4 border-[#FFD300]/20 rounded-full"></div>
                <div className="absolute inset-0 w-24 h-24 border-4 border-[#FFD300] border-t-transparent rounded-full animate-spin"></div>
             </div>
             <h3 className="text-xl font-black text-white uppercase mt-12 tracking-[0.2em] animate-pulse">Director đang xử lý...</h3>
             <p className="text-[10px] text-slate-500 font-black uppercase mt-4 tracking-widest">Lập kế hoạch thiết kế tối ưu</p>
        </div>
    );
  }

  if (!artDirection && imageResult.imageUrls.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900/30 rounded-[3.5rem] border border-white/5 border-dashed p-10 backdrop-blur-md">
        <div className="text-center opacity-30">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto text-slate-500 mb-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
           <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Trung Tâm Điều Hành Thiết Kế</h3>
           <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-widest leading-loose">Vui lòng nhập dữ liệu và nhấn phân tích để bắt đầu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-8 overflow-y-auto pr-3 relative scrollbar-hide">
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center p-6 backdrop-blur-3xl animate-fade-in" onClick={() => setLightboxImage(null)}>
            <img src={lightboxImage} alt="Full view" className="max-h-[88vh] max-w-full rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10" />
            <p className="text-[10px] text-slate-500 font-black uppercase mt-6 tracking-[0.5em]">Nhấn bất kỳ đâu để đóng</p>
        </div>
      )}
      
      {showSmartRemover && selectedImage && (
          <SmartRemover imageUrl={selectedImage} onClose={() => setShowSmartRemover(false)} isProcessing={refinementResult.loading} onProcess={(mask, text) => onSmartRemove(selectedImage, mask, text)} />
      )}

      {artDirection && localPlan && (
        <div className="bg-slate-900/80 rounded-[3.5rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-3xl flex-shrink-0 animate-fade-in-down">
           {/* MOODBOARD SUMMARY HEADER */}
           <div className="p-10 pb-6 border-b border-white/5 bg-slate-950/50">
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Moodboard Summary</h3>
                    <p className="text-[10px] text-[#FFD300] font-black uppercase tracking-widest mt-1.5 opacity-80">Phân tích dữ liệu & Tham chiếu sáng tạo</p>
                 </div>
                 <div className="flex items-center gap-4">
                    <span className="text-[10px] text-white font-black uppercase bg-slate-800/80 px-5 py-2.5 rounded-2xl border border-white/10 shadow-lg">{request.productType}</span>
                    <span className="text-[10px] text-emerald-400 font-black uppercase bg-emerald-500/10 px-5 py-2.5 rounded-2xl border border-emerald-500/20 shadow-lg">Tỷ lệ: {artDirection.recommendedAspectRatio}</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="p-6 bg-slate-950/80 rounded-[2.5rem] border border-white/5 shadow-inner group flex gap-4">
                       <div className="flex-1">
                          <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block mb-2 group-hover:text-blue-400 transition-colors">Tiêu đề & Nội dung chính</span>
                          <h4 className="text-white font-black text-xl uppercase leading-tight tracking-tight mb-2">{request.mainHeadline}</h4>
                          <p className="text-xs text-slate-400 font-bold italic leading-relaxed line-clamp-2">"{request.secondaryText}"</p>
                       </div>
                       {request.mainHeadlineImage && (
                          <div className="w-20 h-20 bg-slate-800 rounded-2xl overflow-hidden border border-white/10 shadow-lg group-hover:scale-110 transition-transform">
                             <img src={request.mainHeadlineImage} className="w-full h-full object-cover" alt="Typo Ref" />
                          </div>
                       )}
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                       {request.logoImage && (
                          <div className="w-20 h-20 bg-white rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl p-1.5 transition-transform hover:scale-105">
                             <img src={request.logoImage} className="w-full h-full object-contain" alt="Logo" />
                          </div>
                       )}
                       <div className="flex gap-2.5">
                           {request.assetImages.map((img, i) => (
                              <div key={i} className="w-20 h-20 bg-slate-800 rounded-3xl overflow-hidden border-2 border-white/5 shadow-2xl group relative transition-transform hover:scale-105">
                                 <img src={img} className="w-full h-full object-cover" alt="Product" />
                                 <div className="absolute inset-0 bg-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              </div>
                           ))}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block ml-2">Moodboard References ({request.referenceImages.length})</span>
                    <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                       {request.referenceImages.map((ref, i) => (
                          <div key={i} className="flex-shrink-0 group relative w-28 h-28 rounded-[2rem] overflow-hidden border-2 border-white/5 shadow-2xl cursor-help">
                             <img src={ref.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Reference" />
                             <div className="absolute inset-0 bg-black/70 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]">
                                {ref.attributes.map(attr => (
                                   <span key={attr} className="text-[8px] text-[#FFD300] font-black uppercase tracking-tighter truncate leading-tight">✦ {attr}</span>
                                ))}
                             </div>
                          </div>
                       ))}
                       {request.referenceImages.length === 0 && (
                          <div className="w-full py-10 text-center bg-slate-950/30 rounded-[2rem] border border-white/5 border-dashed">
                             <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest italic">Không có ảnh tham chiếu</p>
                          </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
           
           {/* DESIGN PLAN CRITERIA */}
           <div className="p-10 space-y-10">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {criteriaList.map((item) => (
                    <div key={item.key} className="bg-slate-950/60 p-7 rounded-[2.5rem] border border-white/5 hover:border-[#FFD300]/20 transition-all shadow-inner group">
                        <h4 className="text-[10px] text-slate-600 font-black uppercase mb-4 tracking-[0.2em] flex items-center gap-2 group-hover:text-slate-400 transition-colors">
                           <div className="w-2 h-2 bg-[#FFD300] rounded-full shadow-[0_0_10px_rgba(255,211,0,0.5)]"></div>
                           {item.label}
                        </h4>
                        <textarea 
                          value={localPlan[item.key] || ''} 
                          onChange={(e) => setLocalPlan(prev => prev ? {...prev, [item.key]: e.target.value} : null)} 
                          className="w-full bg-transparent text-slate-300 text-[11px] font-bold outline-none resize-none min-h-[85px] leading-relaxed placeholder-slate-800 scrollbar-hide" 
                        />
                    </div>
                ))}
             </div>

             {localLayout && (
                 <LayoutEditor 
                    layout={localLayout} 
                    onLayoutChange={(updated) => setLocalLayout(updated)} 
                    onConfirm={handleLayoutConfirm} 
                    onUpdateDescription={() => {}} 
                    isUpdatingDescription={false} 
                 />
             )}

             {/* PROMPT BOX UI */}
             <div className="space-y-5">
                <div className="flex justify-between items-center px-6">
                    <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-3">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                       AI Final Design Prompt
                    </h4>
                    <button onClick={() => { navigator.clipboard.writeText(editablePrompt); alert('Đã sao chép prompt!'); }} className="text-[10px] text-[#FFD300] hover:text-[#FFC000] font-black uppercase flex items-center gap-2.5 transition-all active:scale-95 group">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        <span className="border-b-2 border-transparent group-hover:border-[#FFD300]">Sao chép Prompt</span>
                    </button>
                </div>
                <div className="bg-slate-950 rounded-[3rem] p-10 border border-white/5 shadow-[inset_0_20px_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#FFD300] via-blue-500 to-purple-600 opacity-40"></div>
                    <textarea 
                       className="w-full bg-transparent text-slate-400 text-[12px] font-mono leading-loose outline-none resize-none min-h-[180px] relative z-10 scrollbar-hide focus:text-blue-200 transition-colors"
                       value={editablePrompt}
                       onChange={(e) => setEditablePrompt(e.target.value)}
                       placeholder="Đang trích xuất prompt thiết kế..."
                    />
                    <div className="absolute bottom-6 right-8 text-[10px] text-slate-800 font-black uppercase tracking-[0.2em] select-none">M.A.P Studio Engine</div>
                </div>
             </div>

             <div className="flex gap-6">
                 <button onClick={() => localPlan && onUpdatePlan(localPlan)} disabled={isUpdatingPlan} className="flex-1 py-7 bg-slate-800/80 hover:bg-slate-700 text-white rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 border border-white/5 shadow-xl active:scale-95">
                    {isUpdatingPlan ? "Đang đồng bộ..." : "Cập nhật DNA Thiết kế"}
                 </button>
                 <button onClick={() => handleGenerateClick(false)} className="flex-[2] py-7 bg-[#FFD300] hover:bg-[#FFC000] text-black font-black rounded-3xl shadow-2xl shadow-[#FFD300]/20 transition-all active:scale-95 uppercase tracking-[0.2em] text-[11px] border-t-2 border-white/20">
                    Sản Xuất Hình Ảnh Kết Quả
                 </button>
             </div>
           </div>
        </div>
      )}

      {imageResult.imageUrls.length > 0 && (
          <div className="flex-grow flex flex-col gap-10 animate-fade-in-up pb-32">
            <div className="flex items-center justify-between px-6">
                <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Studio Portfolio Output</h3>
                <button onClick={() => handleGenerateClick(true)} className="text-[10px] text-[#FFD300] hover:text-white border-2 border-[#FFD300]/20 px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all backdrop-blur-3xl hover:bg-[#FFD300]/10">Tạo thêm biến thể</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 px-4">
                {imageResult.imageUrls.map((url, idx) => (
                <div 
                  key={idx} 
                  className={`group relative rounded-[3.5rem] overflow-hidden border-2 transition-all duration-700 cursor-pointer bg-slate-900 shadow-2xl ${selectedImage === url ? 'border-[#FFD300] ring-[12px] ring-[#FFD300]/5 scale-[0.98]' : 'border-white/5 hover:border-white/20'}`} 
                  onClick={() => setSelectedImage(selectedImage === url ? null : url)}
                >
                    <div className="w-full aspect-square relative overflow-hidden">
                        <img src={url} alt="Result" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[3px]">
                            <button onClick={(e) => { e.stopPropagation(); setLightboxImage(url); }} className="p-6 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-3xl border border-white/20 shadow-2xl transition-all active:scale-75">🔍</button>
                        </div>
                    </div>
                </div>
                ))}
            </div>
          </div>
      )}

      {selectedImage && (
        <div className="bg-slate-950/90 border-t border-white/10 p-10 fixed bottom-0 left-0 right-0 z-[60] backdrop-blur-3xl animate-fade-in-up shadow-[0_-30px_60px_rgba(0,0,0,0.8)]">
           <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
             <div className="flex items-center gap-8">
                <div className="w-20 h-20 rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-2xl transform -rotate-3">
                   <img src={selectedImage} className="w-full h-full object-cover" alt="Selected" />
                </div>
                <div>
                   <h3 className="text-white font-black text-2xl uppercase tracking-tighter">Xác Nhận Thiết Kế</h3>
                   <p className="text-[10px] text-[#FFD300] font-black uppercase tracking-widest mt-1.5 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      Chế độ hậu kỳ & xuất bản chuyên nghiệp
                   </p>
                </div>
             </div>
             
             <div className="flex flex-wrap justify-center gap-5">
                 <button onClick={() => onSaveDesign(selectedImage, editablePrompt)} disabled={isSaving} className="px-10 py-5 bg-slate-900 hover:bg-slate-850 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-white/10 transition-all disabled:opacity-50 shadow-xl">Lưu Portfolio</button>
                 <button onClick={() => onSeparateLayout(selectedImage, 'background')} className="px-10 py-5 bg-slate-950 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-2xl hover:bg-blue-500/10 transition-all uppercase tracking-[0.2em] shadow-xl">Tách Nền Layer</button>
                 <button onClick={() => setShowSmartRemover(true)} className="px-10 py-5 bg-slate-950 border border-red-500/20 text-red-400 text-[10px] font-black rounded-2xl hover:bg-red-500/10 transition-all uppercase tracking-[0.2em] shadow-xl">AI Eraser</button>
                 <button onClick={() => handleDownload4K(selectedImage)} disabled={isUpscaling} className="px-12 py-5 bg-gradient-to-br from-[#FFD300] to-[#FFA000] text-black text-[11px] font-black uppercase tracking-[0.25em] rounded-2xl shadow-2xl shadow-[#FFD300]/20 transition-all active:scale-95 disabled:opacity-50 border-t-2 border-white/30">
                   {isUpscaling ? 'Đang Nâng Cấp...' : 'Tải File In 4K'}
                 </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
